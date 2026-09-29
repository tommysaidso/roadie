import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { atomsFor, saveAtoms, reviewAtoms, readJson, manifestPath, sourcePath } from "@/lib/atoms";

export const dynamic = "force-dynamic";

// Audio for one atom, from Ben's own mouth.
//
// Two modes, and they answer different needs:
//
//   "use"     — keep the recording as it is. Right when the point lands better
//               in his own voice than the narrator's: a founder saying the
//               thing directly carries weight a synthetic read cannot.
//
//   "revoice" — transcribe what he said and render THAT in the episode's voice.
//               This is the honest version of "morph my voice to our speaker".
//               Charon is a Gemini prebuilt voice with no conversion endpoint,
//               so the timbre cannot be transferred — but the words, phrasing
//               and emphasis of a real take can, and that is what actually
//               makes a line sound written by a person. Talk it out, get it
//               back in the show's voice.
//
// Either way the mp3 lands where the renderer would have put it and the
// manifest is synced with a real measured duration, so the player cannot tell
// the difference between this and a scripted render.

const ROOT = process.cwd();
const HOST = "https://generativelanguage.googleapis.com/v1beta";
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const MAX = 40 * 1024 * 1024;

const keys = () => [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean) as string[];
const safeEp = (s: string) => String(s || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 24);

function wrapWav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function haveFfmpeg() {
  try { return spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0; }
  catch { return false; }
}

/** Duration of our own WAV from its header — ffprobe is not installed here. */
function wavSeconds(buf: Buffer) {
  try {
    const rate = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34);
    const sec = (buf.length - 44) / (rate * ch * (bits / 8));
    return Number.isFinite(sec) && sec > 0 ? Math.round(sec * 100) / 100 : null;
  } catch { return null; }
}

const durationOf = (f: string) => {
  const r = spawnSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", f],
    { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? Math.round(parseFloat(r.stdout.trim()) * 100) / 100 : null;
};

/** What did he actually say? Gemini takes the audio directly. */
async function transcribe(buf: Buffer, mime: string): Promise<string | null> {
  for (const key of keys()) {
    try {
      const r = await fetch(`${HOST}/models/${TEXT_MODEL}:generateContent?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Transcribe this narration exactly as spoken. Return ONLY the words — " +
                      "no speaker labels, no timestamps, no commentary. Keep the sentences as " +
                      "they were said; do not tidy the phrasing." },
              { inlineData: { mimeType: mime, data: buf.toString("base64") } },
            ],
          }],
        }),
      });
      if (!r.ok) continue;
      const d: any = await r.json();
      const t = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join(" ").trim();
      if (t) return t;
    } catch { /* try the next key */ }
  }
  return null;
}

async function tts(text: string, voice: string): Promise<Buffer | null> {
  for (const key of keys()) {
    for (let a = 1; a <= 3; a++) {
      try {
        const r = await fetch(`${HOST}/models/${TTS_MODEL}:generateContent?key=${key}`, {
          method: "POST", headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(90000),
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          }),
        });
        if (!r.ok) { if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 4000 * a)); continue; } break; }
        const d: any = await r.json();
        const b64 = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        if (b64) return wrapWav(Buffer.from(b64, "base64"));
      } catch { await new Promise(s => setTimeout(s, 3000 * a)); }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const ep = safeEp(String(form?.get("ep") || ""));
  const id = String(form?.get("id") || "").replace(/[^A-Za-z0-9_]+/g, "_").slice(0, 40);
  const mode = String(form?.get("mode") || "use");

  if (!(file instanceof File)) return NextResponse.json({ error: "Attach the recording as `file`." }, { status: 400 });
  if (!ep || !id) return NextResponse.json({ error: "Need ep and atom id." }, { status: 400 });
  if (file.size > MAX) {
    return NextResponse.json({ error: `${(file.size / 1e6).toFixed(0)} MB is too big — keep a take under 40 MB.` }, { status: 413 });
  }
  const { atoms } = atomsFor(ep);
  if (!atoms.find(a => a.id === id)) return NextResponse.json({ error: `No atom "${id}".` }, { status: 404 });

  const raw = Buffer.from(await file.arrayBuffer());
  const dir = path.join(ROOT, "public", "roadietv", ep, "atoms");
  fs.mkdirSync(dir, { recursive: true });
  const mp3 = path.join(dir, `${id}.mp3`);

  let spoken: string | null = null;
  let outFile = `${id}.mp3`;
  let outSec: number | null = null;

  if (mode === "revoice") {
    spoken = await transcribe(raw, file.type || "audio/webm");
    if (!spoken) {
      return NextResponse.json({
        error: "Couldn't make out the recording — nothing was changed. Try again, or use it as-is.",
      }, { status: 502 });
    }
    const src = readJson(sourcePath(ep));
    // Re-voice into THIS atom's character if it has one — so he can perform a
    // line and get it back as whoever is meant to be saying it.
    const thisAtom = atoms.find(a => a.id === id);
    const voice = thisAtom?.voice || src?.voice?.name || "Charon";
    const wav = await tts(spoken, voice);
    if (!wav) {
      return NextResponse.json({
        error: `Transcribed it, but the voice render failed (usually daily quota). Nothing was changed. Heard: "${spoken.slice(0, 120)}"`,
      }, { status: 502 });
    }
    if (haveFfmpeg()) {
      const tmp = mp3.replace(/\.mp3$/, ".tts.wav");
      fs.writeFileSync(tmp, new Uint8Array(wav));
      const ff = spawnSync("ffmpeg", ["-y", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", mp3], { encoding: "utf8" });
      try { fs.unlinkSync(tmp); } catch {}
      if (ff.status !== 0) return NextResponse.json({ error: "ffmpeg failed on the re-voiced audio." }, { status: 502 });
      outFile = `${id}.mp3`; outSec = durationOf(mp3) ?? wavSeconds(wav);
    } else {
      // No ffmpeg on this box — ship the WAV. Bigger, but it plays.
      fs.writeFileSync(path.join(dir, `${id}.wav`), new Uint8Array(wav));
      outFile = `${id}.wav`; outSec = wavSeconds(wav);
    }

    // The words are now what he said, so the source has to agree with the audio
    // or the two drift immediately.
    const next = atoms.map(a => (a.id === id ? { ...a, vo: spoken! } : a));
    saveAtoms(ep, next);
  } else {
    // Use the take as it is.
    if (haveFfmpeg()) {
      const tmp = mp3.replace(/\.mp3$/, ".in");
      fs.writeFileSync(tmp, new Uint8Array(raw));
      const ff = spawnSync("ffmpeg", ["-y", "-i", tmp, "-ac", "1", "-ar", "24000",
        "-codec:a", "libmp3lame", "-b:a", "96k", mp3], { encoding: "utf8" });
      try { fs.unlinkSync(tmp); } catch {}
      if (ff.status !== 0 || !fs.existsSync(mp3)) {
        return NextResponse.json({ error: "ffmpeg couldn't read that recording." }, { status: 502 });
      }
      outFile = `${id}.mp3`; outSec = durationOf(mp3);
    } else {
      // Keep the operator's own container. A browser take is webm/opus and every
      // browser that recorded it can play it back, so transcoding is a nicety
      // rather than a requirement.
      const ext = /wav$/i.test(file.type) ? "wav"
                : /mpeg|mp3/i.test(file.type) ? "mp3"
                : /mp4|m4a/i.test(file.type) ? "m4a" : "webm";
      fs.writeFileSync(path.join(dir, `${id}.${ext}`), new Uint8Array(raw));
      outFile = `${id}.${ext}`;
      // No decoder here, so the player measures it on load rather than being lied to.
      outSec = null;
    }
  }

  // Sync the manifest — real measured duration, never an estimate.
  const mp = manifestPath(ep);
  const man = readJson(mp);
  if (man) {
    const after = atomsFor(ep).atoms.find(a => a.id === id)!;
    const sec = outSec;
    man.atoms = Array.isArray(man.atoms) ? man.atoms : [];
    const row = man.atoms.find((a: any) => a.id === id);
    const next = {
      id, topic: after.topic || "", intent: after.intent, vo: after.vo,
      grounds: after.grounds || [], audio: `atoms/${outFile}`, sec,
      ...(after.jump_to ? { jump_to: after.jump_to } : {}),
      ...(after.voice ? { voice: after.voice } : {}),
      ...(after.character ? { character: after.character } : {}),
      // Flag whose voice this is, so a human take is never mistaken for a
      // scripted render when someone comes back to it in six months.
      voiced: mode === "revoice" ? "narrator (from a live take)" : "operator",
    };
    if (row) Object.assign(row, next); else man.atoms.push(next);
    const tmp = mp + ".part";
    fs.writeFileSync(tmp, JSON.stringify(man, null, 2), "utf8");
    fs.renameSync(tmp, mp);
  }

  const out = atomsFor(ep);
  return NextResponse.json({
    ok: true, mode, heard: spoken || undefined,
    atoms: out.atoms, review: reviewAtoms(out.atoms),
  });
}
