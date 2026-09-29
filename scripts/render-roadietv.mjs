// Render a RoadieTV episode once, at approval time.
//
// Everything a visitor can hear is baked here: the 10 spine beats, the answer
// atoms, and the connectors. Nothing is synthesised at play time, which is what
// makes an interrupt answer start instantly instead of after 3-5 seconds of
// dead air. Only a genuinely novel question falls through to live generation.
//
//   node scripts/render-roadietv.mjs            # audio only
//   node scripts/render-roadietv.mjs --clips    # audio + the 10 beat visuals
//   node scripts/render-roadietv.mjs --force    # re-render everything
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "content", "roadietv-ep01.json");
const OUT = path.join(ROOT, "public", "roadietv", "ep01");
const HOST = "https://generativelanguage.googleapis.com/v1beta";
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-fast-generate-preview";
const BRAND = "mymymy.studio";

const args = process.argv.slice(2);
const WANT_CLIPS = args.includes("--clips");
const FORCE = args.includes("--force");
let QUOTA_HIT = false;

function keys() {
  const fromEnv = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) {
    const out = [];
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.trim().match(/^(GEMINI_API_KEY2?)=(.+)$/);
      if (m) out.push(m[2].trim());
    }
    if (out.length) return out;
  }
  console.error("No GEMINI_API_KEY found."); process.exit(1);
}
const KEYS = keys();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function wrapWav(pcm, rate = 24000, ch = 1, bits = 16) {
  const blockAlign = ch * bits / 8, byteRate = rate * blockAlign;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function tts(text, voice) {
  for (const key of KEYS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(`${HOST}/models/${TTS_MODEL}:generateContent?key=${key}`, {
          method: "POST", headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          }),
        });
        if (!r.ok) {
          if (r.status === 429 || r.status >= 500) { await sleep(4000 * attempt); continue; }
          break;
        }
        const d = await r.json();
        const b64 = d?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (b64) return wrapWav(Buffer.from(b64, "base64"));
      } catch { await sleep(3000 * attempt); }
    }
  }
  return null;
}

/** WAV is 4x the bytes of mp3 for identical speech — ship mp3 to the browser. */
function toMp3(wav, dest) {
  const tmp = dest.replace(/\.mp3$/, ".wav");
  fs.writeFileSync(tmp, wav);
  const r = spawnSync("ffmpeg", ["-y", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", dest],
    { encoding: "utf8" });
  fs.unlinkSync(tmp);
  return r.status === 0 && fs.existsSync(dest);
}

function durationOf(file) {
  const r = spawnSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration",
    "-of", "csv=p=0", file], { encoding: "utf8" });
  return r.status === 0 ? Math.round(parseFloat(r.stdout.trim()) * 100) / 100 : null;
}

async function renderVoice(items, voice, dir, label) {
  fs.mkdirSync(dir, { recursive: true });
  const meta = {};
  for (const [i, it] of items.entries()) {
    const dest = path.join(dir, `${it.id}.mp3`);
    if (fs.existsSync(dest) && !FORCE) {
      meta[it.id] = { file: path.basename(dest), sec: durationOf(dest) };
      console.log(`  [${i + 1}/${items.length}] ${it.id} — cached`);
      continue;
    }
    const wav = await tts(it.vo, voice);
    if (!wav) { console.log(`  [${i + 1}/${items.length}] ${it.id} — FAILED`); continue; }
    if (!toMp3(wav, dest)) { console.log(`  [${i + 1}/${items.length}] ${it.id} — encode failed`); continue; }
    const sec = durationOf(dest);
    meta[it.id] = { file: path.basename(dest), sec };
    console.log(`  [${i + 1}/${items.length}] ${it.id} — ${sec}s`);
  }
  console.log(`${label}: ${Object.keys(meta).length}/${items.length}`);
  return meta;
}

// Every shot has to read as LIVE MUSIC. The first pass said things like "trucks
// on a gravel road" and "crew coiling cable" with no music context at all, and
// the model gave back road construction and a camping tent. Say it explicitly.
const LOOK =
  "Live music documentary photography — concert touring world. Natural light or " +
  "stage lighting, slow steady camera, shallow depth, film grain, grounded and real. " +
  "NOT road construction, NOT roadworks, NOT camping or hiking, NOT a generic worksite. " +
  "No text, no lettering, no watermark, no logo anywhere.";

async function renderShot(beat, shotIdx, dir) {
  const name = `${beat.id}-${shotIdx + 1}.mp4`;
  const dest = path.join(dir, name);
  if (fs.existsSync(dest) && !FORCE) { console.log(`    ${name} — cached`); return name; }
  const prompt = `${beat.shots[shotIdx]} ${LOOK}`;
  let why = "";
  for (const key of KEYS) {
    try {
      const op = await (await fetch(`${HOST}/models/${VIDEO_MODEL}:predictLongRunning?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt }] }),
      })).json();
      if (!op?.name) {
        // This used to `continue` with no message, so a quota wall looked
        // identical to nothing happening — the beat header printed and the
        // run moved on in silence. Always say why.
        why = op?.error?.message || "job did not start";
        continue;
      }
      for (let i = 0; i < 60; i++) {
        await sleep(10000);
        const st = await (await fetch(`${HOST}/${op.name}?key=${key}`)).json();
        if (!st.done) continue;
        if (st.error) { console.log(`    ${name} — ${st.error.message?.slice(0, 90)}`); break; }
        const s = st.response?.generateVideoResponse?.generatedSamples
          || st.response?.generatedSamples || [];
        const uri = s[0]?.video?.uri;
        if (!uri) break;
        const buf = Buffer.from(await (await fetch(`${uri}${uri.includes("?") ? "&" : "?"}key=${key}`)).arrayBuffer());
        fs.writeFileSync(dest, buf);
        // strip Veo's own audio — the voice-over is the only audio track
        const muted = dest.replace(/\.mp4$/, "-m.mp4");
        const r = spawnSync("ffmpeg", ["-y", "-i", dest, "-an", "-vf", "scale=1280:-2",
          "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-movflags", "+faststart",
          "-metadata", `title=RoadieTV EP01 ${beat.cue} shot ${shotIdx + 1}`, "-metadata", `copyright=${BRAND}`, muted],
          { encoding: "utf8" });
        if (r.status === 0 && fs.existsSync(muted)) { fs.unlinkSync(dest); fs.renameSync(muted, dest); }
        console.log(`    ${name} — ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB`);
        return name;
      }
    } catch (e) { why = String(e.message); }
  }
  const quota = /quota|429|rate limit/i.test(why);
  console.log(`    ${name} — ${quota ? "QUOTA EXHAUSTED for today — rerun tomorrow to fill the gaps" : (why || "failed").slice(0, 110)}`);
  if (quota) QUOTA_HIT = true;
  return null;
}

const ep = JSON.parse(fs.readFileSync(SRC, "utf8"));
if (ep.status !== "approved" && !FORCE) {
  console.error(`Episode is "${ep.status}" — approve it in ${path.relative(ROOT, SRC)} before rendering.`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const voice = ep.voice?.name || "Charon";

console.log(`[roadietv] ${ep.title}\n  voice: ${voice}\n  out:   ${path.relative(ROOT, OUT)}\n`);

console.log("Spine beats:");
const beats = await renderVoice(ep.beats, voice, path.join(OUT, "vo"), "  beats");
console.log("\nAnswer atoms:");
const atoms = await renderVoice(ep.atoms, voice, path.join(OUT, "atoms"), "  atoms");
console.log("\nConnectors:");
const conns = await renderVoice(ep.connectors, voice, path.join(OUT, "conn"), "  connectors");

let clips = {};
if (WANT_CLIPS) {
  console.log("\nBeat visuals:");
  const dir = path.join(OUT, "clips");
  fs.mkdirSync(dir, { recursive: true });
  for (const b of ep.beats) {
    console.log(`  ${b.id} ${b.cue}`);
    const got = [];
    for (let i = 0; i < (b.shots || []).length; i++) {
      if (QUOTA_HIT) { console.log(`    ${b.id}-${i + 1}.mp4 — skipped (quota)`); continue; }
      const f = await renderShot(b, i, dir);
      if (f) got.push(f);
    }
    if (got.length) clips[b.id] = got;
  }
}

const manifest = {
  id: ep.id, title: ep.title, voice,
  approved_at: ep.approved_at, rendered_at: new Date().toISOString(),
  beats: ep.beats.map(b => ({
    id: b.id, cue: b.cue, vo: b.vo, shots: b.shots, grounds: b.grounds,
    audio: beats[b.id] ? `vo/${beats[b.id].file}` : null,
    sec: beats[b.id]?.sec ?? null,
    clips: (clips[b.id] || []).map((f) => `clips/${f}`),
  })),
  atoms: ep.atoms.map(a => ({
    id: a.id, topic: a.topic, intent: a.intent, vo: a.vo, grounds: a.grounds,
    audio: atoms[a.id] ? `atoms/${atoms[a.id].file}` : null,
    sec: atoms[a.id]?.sec ?? null,
  })),
  connectors: ep.connectors.map(c => ({
    id: c.id, vo: c.vo,
    audio: conns[c.id] ? `conn/${conns[c.id].file}` : null,
    sec: conns[c.id]?.sec ?? null,
  })),
  policy: ep.interrupt_policy,
  playback: ep.playback,
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));

const total = manifest.beats.reduce((t, b) => t + (b.sec || 0), 0);
console.log(`\n[roadietv] done — spine ${Math.round(total)}s · ${manifest.atoms.filter(a => a.audio).length} atoms · ${manifest.connectors.filter(c => c.audio).length} connectors`);
console.log(`manifest: ${path.relative(ROOT, path.join(OUT, "manifest.json"))}`);
