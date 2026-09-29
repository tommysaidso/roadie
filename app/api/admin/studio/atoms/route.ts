import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import {
  listEpisodes, atomsFor, saveAtoms, reviewAtoms, readJson, manifestPath, Atom,
} from "@/lib/atoms";

export const dynamic = "force-dynamic";

// The atom bank, from the editor.
//
// GET  ?ep=ep01           -> atoms merged with what is rendered, plus a review
// GET                     -> the episodes available to edit
// POST {ep, atoms}        -> save text to the SOURCE
// POST {ep, render:"id"}  -> render one atom's audio and sync the manifest

const ROOT = process.cwd();
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const HOST = "https://generativelanguage.googleapis.com/v1beta";

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const ep = new URL(req.url).searchParams.get("ep");
  if (!ep) return NextResponse.json({ episodes: listEpisodes() });

  const { atoms, title, status } = atomsFor(ep);
  return NextResponse.json({ ep, title, status, atoms, review: reviewAtoms(atoms) });
}

/** Gemini TTS returns raw PCM; browsers want a container. */
function wrapWav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function tts(text: string, voice: string): Promise<Buffer | null> {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean) as string[];
  for (const key of keys) {
    for (let attempt = 1; attempt <= 3; attempt++) {
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
        if (!r.ok) {
          if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 4000 * attempt)); continue; }
          break;
        }
        const d: any = await r.json();
        const b64 = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        if (b64) return wrapWav(Buffer.from(b64, "base64"));
      } catch { await new Promise(s => setTimeout(s, 3000 * attempt)); }
    }
  }
  return null;
}


/** Is ffmpeg actually on this box? The container does not ship it. */
function haveFfmpeg() {
  try { return spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0; }
  catch { return false; }
}

/**
 * Duration of our own 24kHz mono 16-bit WAV, straight from the header.
 *
 * ffprobe is the general answer but it is not installed here, and for audio we
 * generated ourselves the arithmetic is exact: bytes / (rate * channels * 2).
 */
function wavSeconds(buf: Buffer) {
  try {
    const rate = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34);
    const bytes = buf.length - 44;
    const sec = bytes / (rate * ch * (bits / 8));
    return Number.isFinite(sec) && sec > 0 ? Math.round(sec * 100) / 100 : null;
  } catch { return null; }
}

/**
 * Write voiced audio in the best format this box can produce.
 *
 * mp3 when ffmpeg exists (a quarter the bytes for identical speech), WAV when
 * it does not. Browsers play both, so the only cost of the fallback is size —
 * far better than an editor button that always errors.
 */
function writeVoiced(dir: string, id: string, wav: Buffer):
  { file: string; sec: number | null } | null {
  fs.mkdirSync(dir, { recursive: true });
  if (haveFfmpeg()) {
    const mp3 = path.join(dir, `${id}.mp3`);
    const tmp = mp3.replace(/\.mp3$/, ".src.wav");
    fs.writeFileSync(tmp, new Uint8Array(wav));
    const ff = spawnSync("ffmpeg", ["-y", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", mp3],
      { encoding: "utf8" });
    try { fs.unlinkSync(tmp); } catch {}
    if (ff.status === 0 && fs.existsSync(mp3)) {
      const d = spawnSync("ffprobe",
        ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" });
      const sec = d.status === 0 && d.stdout.trim()
        ? Math.round(parseFloat(d.stdout.trim()) * 100) / 100 : wavSeconds(wav);
      return { file: `${id}.mp3`, sec };
    }
  }
  const out = path.join(dir, `${id}.wav`);
  fs.writeFileSync(out, new Uint8Array(wav));
  return { file: `${id}.wav`, sec: wavSeconds(wav) };
}

const durationOf = (f: string) => {
  const r = spawnSync("ffprobe",
    ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? Math.round(parseFloat(r.stdout.trim()) * 100) / 100 : null;
};

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const b = await req.json().catch(() => ({} as any));
  const ep = String(b?.ep || "").trim();
  if (!ep) return NextResponse.json({ error: "Which episode?" }, { status: 400 });

  // --- save text -----------------------------------------------------------
  if (Array.isArray(b?.atoms)) {
    const clean: Atom[] = b.atoms
      .filter((a: any) => String(a?.id || "").trim() && String(a?.vo || "").trim())
      .map((a: any) => ({
        id: String(a.id).replace(/[^A-Za-z0-9_]+/g, "_").slice(0, 40),
        topic: String(a.topic || "").slice(0, 80),
        intent: (Array.isArray(a.intent) ? a.intent : String(a.intent || "").split("\n"))
          .map((x: any) => String(x).trim()).filter(Boolean).slice(0, 24),
        vo: String(a.vo).slice(0, 4000),
        grounds: (Array.isArray(a.grounds) ? a.grounds : []).map((x: any) => String(x).slice(0, 20)),
        jump_to: a.jump_to ? String(a.jump_to).slice(0, 12) : undefined,
        voice: a.voice ? String(a.voice).replace(/[^A-Za-z]/g, "").slice(0, 24) : undefined,
        character: a.character ? String(a.character).slice(0, 40) : undefined,
      }));
    const seen = new Set<string>();
    for (const a of clean) {
      if (seen.has(a.id)) return NextResponse.json({ error: `Two atoms share the id "${a.id}".` }, { status: 400 });
      seen.add(a.id);
    }
    const r = saveAtoms(ep, clean);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    const after = atomsFor(ep);
    return NextResponse.json({ ok: true, atoms: after.atoms, review: reviewAtoms(after.atoms) });
  }

  // --- render one atom's audio --------------------------------------------
  if (b?.render) {
    const id = String(b.render);
    const { atoms } = atomsFor(ep);
    const atom = atoms.find(a => a.id === id);
    if (!atom) return NextResponse.json({ error: `No atom "${id}".` }, { status: 404 });

    const src = readJson(path.join(ROOT, "content", `roadietv-${ep.replace(/[^A-Za-z0-9_-]/g, "")}.json`));
    // An atom may be a different character; fall back to the narrator.
    const voice = atom.voice || src?.voice?.name || "Charon";

    const wav = await tts(atom.vo, voice);
    if (!wav) {
      return NextResponse.json({
        error: "TTS gave nothing back — usually daily quota. Try again later; nothing was changed.",
      }, { status: 502 });
    }

    const dir = path.join(ROOT, "public", "roadietv", ep.replace(/[^A-Za-z0-9_-]/g, ""), "atoms");
    const written = writeVoiced(dir, id, wav);
    if (!written) return NextResponse.json({ error: "Couldn't write the audio." }, { status: 502 });

    // Sync the manifest so the player can actually reach it. Real measured
    // duration, never an estimate — the player schedules against it.
    const mp = manifestPath(ep);
    const man = readJson(mp);
    if (man) {
      const sec = written.sec;
      man.atoms = Array.isArray(man.atoms) ? man.atoms : [];
      const row = man.atoms.find((a: any) => a.id === id);
      const next = {
        id, topic: atom.topic || "", intent: atom.intent, vo: atom.vo,
        grounds: atom.grounds || [], audio: `atoms/${written.file}`, sec,
        ...(atom.jump_to ? { jump_to: atom.jump_to } : {}),
        ...(atom.voice ? { voice: atom.voice } : {}),
        ...(atom.character ? { character: atom.character } : {}),
      };
      if (row) Object.assign(row, next); else man.atoms.push(next);
      const tmp = mp + ".part";
      fs.writeFileSync(tmp, JSON.stringify(man, null, 2), "utf8");
      fs.renameSync(tmp, mp);
    }

    const after = atomsFor(ep);
    return NextResponse.json({ ok: true, atoms: after.atoms, review: reviewAtoms(after.atoms) });
  }

  return NextResponse.json({ error: "Nothing to do — send atoms to save, or render to voice one." }, { status: 400 });
}
