// SOUND BANK — the Blackmagic Fairlight library, on tap in the episode builder.
//
// 515 licensed effects that ship with Resolve. They already live on the NAS
// beside the render pool, so there is nothing to copy and nothing to license
// again — the builder just needs to be able to see them.
//
// Why the filenames are the index:
//
//   The library ships a SoundLib.db, but it is a Resolve project database — the
//   useful metadata is inside BLOB columns in Resolve's own serialisation, not
//   in queryable rows. Meanwhile the filenames are already written as plain
//   descriptions: "Aluminum Can Crush,Throw.M.wav", "Ants Scurrying About.M.wav".
//   That is exactly what a model needs to choose from, so we read the folder and
//   leave the database alone. Fewer moving parts, nothing to keep in sync.
//
// The AI picks first and places it; the pick is a suggestion, never a commit —
// every choice lands on the timeline where it can be moved, swapped or deleted.

import fs from "node:fs";
import path from "node:path";

export const SFX_DIR = process.env.ROADIE_SFX_DIR ||
  "\\\\DXP4800UARX\\Unreal_Nas\\GenAi\\Blackmagic_Fairlight_Sound_Library_Windows\\Media Files";

const AUDIO = /\.(wav|mp3|aiff?|m4a|flac|ogg)$/i;

export type SfxItem = {
  id: string;
  name: string;      // filename
  label: string;     // human form: "Aluminum Can Crush, Throw"
  folder: string;
  bytes: number;
};

export function sfxReachable(): { ok: boolean; detail: string } {
  try { fs.accessSync(SFX_DIR); return { ok: true, detail: SFX_DIR }; }
  catch (e: any) {
    return { ok: false, detail: `Sound bank not reachable at ${SFX_DIR} — ${e?.code || e?.message || e}` };
  }
}

/**
 * "Aluminum Can Crush,Throw.M.wav" -> "Aluminum Can Crush, Throw".
 *
 * The trailing ".M" / ".S" is Fairlight's mono/stereo marker, not part of the
 * name, and the commas are written without spaces throughout the library.
 */
export function sfxLabel(filename: string) {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\.(M|S|ST)$/i, "")
    .replace(/,(\S)/g, ", $1")
    .trim();
}

/** Read the bank. One level deep, same reasoning as the stock shelf. */
export function listSfx(limit = 2000): SfxItem[] {
  const out: SfxItem[] = [];
  if (!sfxReachable().ok) return out;

  const scan = (dir: string, folder: string, depth: number) => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth > 0) scan(full, folder ? `${folder}/${e.name}` : e.name, depth - 1);
        continue;
      }
      // .asd files are Ableton peak caches sitting next to the wavs. They are
      // not audio and must never reach the picker.
      if (!AUDIO.test(e.name)) continue;
      let st: fs.Stats;
      try { st = fs.statSync(full); } catch { continue; }
      out.push({
        id: folder ? `${folder}/${e.name}` : e.name,
        name: e.name, label: sfxLabel(e.name), folder, bytes: st.size,
      });
    }
  };

  scan(SFX_DIR, "", 1);
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function sfxPath(id: string): string | null {
  const clean = String(id || "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0")) return null;
  const root = path.resolve(SFX_DIR);
  const full = path.resolve(root, clean);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try { return fs.existsSync(full) ? full : null; } catch { return null; }
}

export function sfxUrl(id: string) {
  return `/api/admin/studio/sfx?file=${encodeURIComponent(id)}`;
}

/**
 * Ask the model to pick and place sound.
 *
 * It gets the beat list and the whole catalogue of labels, and answers with
 * picks tied to a time. The rule that matters: it may only return names that
 * are actually in the bank, and we drop anything that is not — a hallucinated
 * effect is a broken clip on the timeline, and hunting that down costs more
 * than the suggestion saved.
 *
 * Returns [] rather than throwing. A missing suggestion is a nuisance; a 500
 * mid-edit is a lost session.
 */
export async function suggestSfx(opts: {
  brief: string;
  seconds: number;
  beats?: { t: number; what: string }[];
  catalogue: SfxItem[];
}): Promise<{ id: string; label: string; t: number; why: string }[]> {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
  if (!key || !opts.catalogue.length) return [];

  const byLabel = new Map(opts.catalogue.map(i => [i.label.toLowerCase(), i]));
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

  const prompt = [
    "You are the sound editor on a short promo for a Canadian touring music circuit.",
    "Choose sound effects from the library below and say WHERE each one lands.",
    "",
    `PROMO: ${opts.brief}`,
    `LENGTH: ${opts.seconds.toFixed(1)} seconds`,
    opts.beats?.length
      ? "WHAT HAPPENS:\n" + opts.beats.map(b => `  ${b.t.toFixed(1)}s — ${b.what}`).join("\n")
      : "",
    "",
    "LIBRARY (choose ONLY from these exact names):",
    opts.catalogue.map(i => i.label).join(" | "),
    "",
    "Rules:",
    "- 3 to 6 picks. Sound should punctuate, not carpet the cut.",
    `- Every time must be between 0 and ${opts.seconds.toFixed(1)}.`,
    "- Use a name EXACTLY as written above. Do not invent or reword one.",
    "- No effect under music that is already carrying the moment.",
    "",
    "Reply with ONLY a JSON array, no prose, no code fence:",
    '[{"name":"...","t":1.5,"why":"..."}]',
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(25000),
      });
    if (!r.ok) return [];
    const data: any = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((x: any) => {
      const hit = byLabel.get(String(x?.name || "").trim().toLowerCase());
      if (!hit) return [];                       // not in the bank -> not a pick
      const t = Number(x?.t);
      if (!Number.isFinite(t) || t < 0 || t > opts.seconds) return [];
      return [{ id: hit.id, label: hit.label, t, why: String(x?.why || "").slice(0, 200) }];
    }).slice(0, 8);
  } catch {
    return [];
  }
}
