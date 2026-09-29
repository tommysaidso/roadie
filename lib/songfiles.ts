import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDb, one, run } from "./db";

// Storage + branding for song art. Two jobs:
//   1. keep a record of every piece so a band can find it again later
//   2. stamp mymymy.studio on anything that leaves the building
//
// Veo files sit behind the API key, so a clip has to be pulled server-side
// before it can be shared at all. ffmpeg is OPTIONAL — when it's missing the
// clip is still saved and served, just without the burned-in corner mark.

const DIR = path.join(process.cwd(), "data", "songart");
const BRAND = "mymymy.studio";

// Masters are heavy (~4 MB for 8s) and do not belong inside the app tree — set
// SONGART_MASTER_DIR to a NAS share and ROADIE keeps only the light preview.
// Measured on an 8s 720p clip: master 4.1 MB · GIF 9.5 MB (worse than the
// master) · animated WebP 2.4 MB · muted 640p mp4 372 KB. The small mp4 loops
// exactly like a GIF, plays on iOS, and is 25x smaller than the GIF.
const MASTER_DIR = process.env.SONGART_MASTER_DIR || "";

export function ensureSongArtSchema() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS song_art (
    id INTEGER PRIMARY KEY,
    share_id TEXT UNIQUE NOT NULL,
    band_id INTEGER REFERENCES bands(id),
    title TEXT,                -- song title
    hook TEXT,                 -- opening lines / chorus the band supplied
    prompt TEXT,
    kind TEXT NOT NULL,        -- image | clip
    file TEXT NOT NULL,        -- filename under data/songart
    mime TEXT,
    bytes INTEGER,
    watermarked INTEGER DEFAULT 0,
    operation TEXT,            -- veo operation name, for clips
    master_path TEXT,          -- full-quality original, parked on the NAS
    byok INTEGER DEFAULT 0,    -- 1 = ran on the band's own key, not metered
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  // existing installs predate these
  try { db.exec(`ALTER TABLE song_art ADD COLUMN master_path TEXT`); } catch {}
  try { db.exec(`ALTER TABLE song_art ADD COLUMN byok INTEGER DEFAULT 0`); } catch {}
  db.exec(`CREATE INDEX IF NOT EXISTS idx_song_art_band ON song_art(band_id, created_at DESC)`);
  fs.mkdirSync(DIR, { recursive: true });
}

// Short, unambiguous, URL-safe. No lookalike characters.
export function shareId(n = 10): string {
  const A = "23456789abcdefghjkmnpqrstuvwxyz";
  let s = ""; for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function ffmpeg(): string | null {
  const bin = process.env.FFMPEG_PATH || "ffmpeg";
  const probe = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return probe.status === 0 ? bin : null;
}

// drawtext needs a real font file and the path differs per OS, so try the
// usual suspects and give up gracefully rather than failing the whole save.
function fontFile(): string | null {
  const candidates = [
    process.env.WATERMARK_FONT,
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  ].filter(Boolean) as string[];
  return candidates.find(f => { try { return fs.existsSync(f); } catch { return false; } }) || null;
}

type Meta = { bandId?: number; title?: string; hook?: string; prompt?: string; operation?: string; byok?: boolean };

function record(kind: "image" | "clip", file: string, mime: string, bytes: number, wm: boolean, m: Meta) {
  const sid = shareId();
  run(
    `INSERT INTO song_art(share_id,band_id,title,hook,prompt,kind,file,mime,bytes,watermarked,operation,byok)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    sid, m.bandId || null, m.title || null, m.hook || null, m.prompt || null,
    kind, file, mime, bytes, wm ? 1 : 0, m.operation || null, m.byok ? 1 : 0
  );
  return sid;
}

/** Save a generated still, with the brand burned into the corner. */
export function saveImage(dataUrl: string, m: Meta): { shareId: string; watermarked: boolean } | null {
  ensureSongArtSchema();
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const ext = mime.includes("jpeg") ? "jpg" : "png";
  const name = `${Date.now()}-${shareId(6)}.${ext}`;
  const full = path.join(DIR, name);
  fs.writeFileSync(full, Buffer.from(b64, "base64"));

  const wm = stampImage(full, m);
  const bytes = fs.statSync(full).size;
  return { shareId: record("image", name, mime, bytes, wm, m), watermarked: wm };
}

function stampImage(file: string, m: Meta): boolean {
  const bin = ffmpeg(); const font = fontFile();
  if (!bin || !font) return false;
  const tmp = file.replace(/(\.\w+)$/, "-wm$1");
  const label = BRAND.replace(/:/g, "\\:");
  const r = spawnSync(bin, [
    "-y", "-i", file,
    "-vf",
    `drawtext=fontfile='${font.replace(/\\/g, "/").replace(/:/g, "\\:")}':text='${label}':` +
    `fontcolor=white@0.85:fontsize=h/34:x=w-tw-h/45:y=h-th-h/45:` +
    `box=1:boxcolor=black@0.35:boxborderw=h/110`,
    // NOTE: ffmpeg does not write generic -metadata into PNG output, so a still
    // is traced by its share_id row + the visible mark, not by embedded tags.
    // Clips are MP4 and do carry the tags (see stampClip).
    tmp,
  ], { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch {} return false; }
  fs.renameSync(tmp, file);
  return true;
}

/**
 * Pull a finished Veo clip (the URI needs the API key), brand it, tag it so it
 * can be traced back, and store it. Returns the share id.
 */
export async function saveClip(uri: string, m: Meta): Promise<{ shareId: string; watermarked: boolean } | null> {
  ensureSongArtSchema();
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
  if (!key) return null;

  const url = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());

  const raw = path.join(DIR, `${Date.now()}-${shareId(6)}.mp4`);
  fs.writeFileSync(raw, buf);

  const wm = stampClip(raw, m);
  const preview = makePreview(raw);   // what the app actually serves
  const master = offloadMaster(raw, !!preview);
  const served = preview || path.basename(raw);
  const bytes = fs.statSync(path.join(DIR, served)).size;

  const sid = record("clip", served, "video/mp4", bytes, wm, m);
  if (master) { try { run("UPDATE song_art SET master_path=? WHERE share_id=?", master, sid); } catch {} }
  return { shareId: sid, watermarked: wm };
}

/** 640p, muted, faststart — a GIF-style loop at a fraction of the size. */
function makePreview(src: string): string | null {
  const bin = ffmpeg(); if (!bin) return null;
  const out = src.replace(/\.mp4$/, "-p.mp4");
  const r = spawnSync(bin, [
    "-y", "-i", src,
    "-vf", "scale=640:-2",
    "-c:v", "libx264", "-crf", "30", "-preset", "slow",
    "-an", "-movflags", "+faststart", out,
  ], { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(out)) { try { fs.unlinkSync(out); } catch {} return null; }
  return path.basename(out);
}

/** Move the full-quality file to the NAS when one is configured. */
function offloadMaster(src: string, havePreview: boolean): string | null {
  if (!MASTER_DIR || !havePreview) return null;
  try {
    fs.mkdirSync(MASTER_DIR, { recursive: true });
    const dest = path.join(MASTER_DIR, path.basename(src));
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);          // app keeps the preview only
    return dest;
  } catch { return null; }       // NAS unreachable -> master stays local
}

function stampClip(file: string, m: Meta): boolean {
  const bin = ffmpeg(); const font = fontFile();
  if (!bin) return false;
  const tmp = file.replace(/\.mp4$/, "-wm.mp4");

  // Metadata rides along either way — that's how a clip gets traced back to the
  // song and the prompt that made it, independent of the visible mark.
  const tags = [
    "-metadata", `title=${m.title || "ROADIE song art"}`,
    "-metadata", `artist=${BRAND}`,
    "-metadata", `album=${m.title || ""}`,
    "-metadata", `comment=${(m.prompt || "").slice(0, 300)}`,
    "-metadata", `copyright=${BRAND}`,
  ];

  const args = font
    ? ["-y", "-i", file, "-vf",
       `drawtext=fontfile='${font.replace(/\\/g, "/").replace(/:/g, "\\:")}':text='${BRAND.replace(/:/g, "\\:")}':` +
       `fontcolor=white@0.85:fontsize=h/28:x=w-tw-h/40:y=h-th-h/40:` +
       `box=1:boxcolor=black@0.35:boxborderw=h/100`,
       "-c:a", "copy", ...tags, tmp]
    : ["-y", "-i", file, "-c", "copy", ...tags, tmp];

  const r = spawnSync(bin, args, { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch {} return false; }
  fs.renameSync(tmp, file);
  return !!font;
}

// ---- BYOK storage + metering -----------------------------------------
// A band's key is write-only: stored, used server-side, never returned. Only
// a masked hint goes back to the UI so they can confirm which key is loaded.
// BYOA — bring your own API, not just your own key. A band can hand us a key
// for a provider we already speak, OR point us at an endpoint they run
// themselves (a ComfyUI box, a RunPod pod, fal). Self-hosted means the work
// never touches our billing at all, which is the whole point.
export function ensureKeyStore() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS band_ai_keys (
    band_id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'gemini',  -- gemini | fal | comfyui | runpod | openai_compatible
    api_key TEXT,                             -- optional: a self-hosted box may need none
    base_url TEXT,                            -- set when they run the endpoint
    hint TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  try { db.exec(`ALTER TABLE band_ai_keys ADD COLUMN base_url TEXT`); } catch {}
}

export function setBandKey(bandId: number, provider: string, key: string, baseUrl?: string) {
  ensureSongArtSchema();
  ensureKeyStore();
  if (!key && !baseUrl) throw new Error("Need an API key or an endpoint URL.");
  const hint = key
    ? (key.length > 8 ? `…${key.slice(-4)}` : "…")
    : (baseUrl ? new URL(baseUrl).host : "");
  run(`INSERT INTO band_ai_keys(band_id,provider,api_key,base_url,hint) VALUES(?,?,?,?,?)
       ON CONFLICT(band_id) DO UPDATE SET provider=excluded.provider,
         api_key=excluded.api_key, base_url=excluded.base_url,
         hint=excluded.hint, updated_at=datetime('now')`,
      bandId, provider || "gemini", key || null, baseUrl || null, hint);
}

export function clearBandKey(bandId: number) {
  try { run("DELETE FROM band_ai_keys WHERE band_id=?", bandId); } catch {}
}

export type BandApi = { provider: string; key: string | null; baseUrl: string | null };

/** What this band brings, if anything. Never leaves the server. */
export function bandApi(bandId?: number | null): BandApi | null {
  if (!bandId) return null;
  try {
    const r: any = one("SELECT provider,api_key,base_url FROM band_ai_keys WHERE band_id=?", bandId);
    if (!r || (!r.api_key && !r.base_url)) return null;
    return { provider: r.provider || "gemini", key: r.api_key || null, baseUrl: r.base_url || null };
  } catch { return null; }
}

export function bandKey(bandId?: number | null): string | null {
  return bandApi(bandId)?.key ?? null;
}

/** Safe to show a client: provider, a masked hint, and whether it's self-hosted. */
export function bandKeyHint(bandId?: number | null):
  { provider: string; hint: string; selfHosted: boolean } | null {
  if (!bandId) return null;
  try {
    const r: any = one("SELECT provider,hint,base_url FROM band_ai_keys WHERE band_id=?", bandId);
    return r ? { provider: r.provider, hint: r.hint, selfHosted: !!r.base_url } : null;
  } catch { return null; }
}

/** Platform-key generations this calendar month (BYOK runs aren't counted). */
export function usedThisMonth(bandId?: number | null): number {
  if (!bandId) return 0;
  ensureSongArtSchema();
  try {
    const r: any = one(
      `SELECT COUNT(*) n FROM song_art
       WHERE band_id=? AND byok=0 AND created_at >= date('now','start of month')`, bandId);
    return Number(r?.n || 0);
  } catch { return 0; }
}

/**
 * Move any masters that stayed local (NAS was down) onto the share.
 * Safe to call repeatedly; does nothing when no MASTER_DIR is configured.
 */
export function sweepMasters(limit = 50): { moved: number; left: number } {
  ensureSongArtSchema();
  if (!MASTER_DIR) return { moved: 0, left: 0 };
  let moved = 0, left = 0;
  try { fs.mkdirSync(MASTER_DIR, { recursive: true }); } catch { return { moved: 0, left: 0 }; }
  const rows: any[] = getDb().prepare(
    `SELECT share_id,file FROM song_art WHERE kind='clip' AND master_path IS NULL LIMIT ?`
  ).all(limit);
  for (const r of rows) {
    const local = path.join(DIR, String(r.file).replace(/-p\.mp4$/, ".mp4"));
    if (!fs.existsSync(local)) { left++; continue; }
    try {
      const dest = path.join(MASTER_DIR, path.basename(local));
      fs.copyFileSync(local, dest);
      fs.unlinkSync(local);
      run("UPDATE song_art SET master_path=? WHERE share_id=?", dest, r.share_id);
      moved++;
    } catch { left++; }
  }
  return { moved, left };
}

export function getArt(sid: string): any {
  ensureSongArtSchema();
  return one("SELECT * FROM song_art WHERE share_id=?", sid);
}

export function readArt(rec: any): Buffer | null {
  const full = path.join(DIR, rec.file);
  try { return fs.readFileSync(full); } catch { return null; }
}
