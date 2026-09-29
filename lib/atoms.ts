// ATOMS — the answer bank, editable from the studio.
//
// An episode is two things: a fixed spine (beats, in order) and a bank of
// pre-rendered answers (atoms) the AI can reach for when a viewer interrupts.
// The editor has only ever known about the first one, which is why atoms have
// been hand-written in JSON and drift out of sync with what the episode
// actually says.
//
// Two files, and knowing which is which prevents most of the pain:
//
//   content/roadietv-epNN.json    THE SOURCE. Words live here. Editable.
//   public/roadietv/epNN/manifest.json   THE RENDER. Audio paths and measured
//                                        durations. Written by the renderer.
//
// The source is truth for text; the manifest is truth for what a browser can
// actually play. An atom that exists in the source but has no rendered audio is
// not yet real, and the editor has to show that difference rather than hide it.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

export type Atom = {
  id: string;
  topic?: string;
  intent: string[];
  vo: string;
  grounds?: string[];
  /** Which beat this subject lives in, so "take me there" is a lookup. */
  jump_to?: string;
  /**
   * A character. Absent means the episode's narrator.
   *
   * An ad or an episode is rarely one person talking. A second voice answering
   * a different kind of question — the promoter, the venue owner, the driver —
   * reads as a cast rather than a narrator doing accents, and it costs nothing
   * but naming a different prebuilt voice.
   */
  voice?: string;
  character?: string;          // who that voice IS, for the operator's own sanity
  /** Filled from the manifest — absent means the audio has not been rendered. */
  audio?: string;
  sec?: number;
};

const safeEp = (id: string) => String(id || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 24);

export const sourcePath = (ep: string) =>
  path.join(ROOT, "content", `roadietv-${safeEp(ep)}.json`);
export const manifestPath = (ep: string) =>
  path.join(ROOT, "public", "roadietv", safeEp(ep), "manifest.json");

export function readJson(p: string): any | null {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

/** Every episode the studio can edit. */
export function listEpisodes(): { id: string; title: string; status: string; atoms: number }[] {
  const dir = path.join(ROOT, "content");
  let files: string[] = [];
  try { files = fs.readdirSync(dir); } catch { return []; }
  return files
    .filter(f => /^roadietv-.+\.json$/.test(f) && !/TEMPLATE/i.test(f))
    .map(f => {
      const d = readJson(path.join(dir, f)) || {};
      return {
        id: String(d.id || f.replace(/^roadietv-|\.json$/g, "")),
        title: String(d.title || f),
        status: String(d.status || "draft"),
        atoms: Array.isArray(d.atoms) ? d.atoms.length : 0,
      };
    });
}

/**
 * Atoms for an episode, merged with what has actually been rendered.
 *
 * The merge is the point: the editor must be able to show "this atom exists but
 * has no audio", which is the single most common way an episode ships broken.
 */
export function atomsFor(ep: string): { atoms: Atom[]; title: string; status: string } {
  const src = readJson(sourcePath(ep));
  if (!src) return { atoms: [], title: "", status: "missing" };
  const man = readJson(manifestPath(ep)) || {};
  const rendered = new Map<string, any>((man.atoms || []).map((a: any) => [a.id, a]));

  const atoms: Atom[] = (src.atoms || []).map((a: any) => {
    const r = rendered.get(a.id);
    return {
      id: a.id, topic: a.topic, intent: a.intent || [], vo: a.vo || "",
      grounds: a.grounds || [], jump_to: a.jump_to,
      voice: a.voice, character: a.character,
      // Only report audio the manifest AND the disk agree on.
      audio: r?.audio && fs.existsSync(path.join(ROOT, "public", "roadietv", safeEp(ep), r.audio))
        ? r.audio : undefined,
      sec: r?.sec,
    };
  });
  return { atoms, title: String(src.title || ""), status: String(src.status || "draft") };
}

/** Write atoms back to the SOURCE. Never touches the manifest. */
export function saveAtoms(ep: string, atoms: Atom[]): { ok: boolean; error?: string } {
  const p = sourcePath(ep);
  const src = readJson(p);
  if (!src) return { ok: false, error: `No episode source at ${path.basename(p)}` };
  src.atoms = atoms.map(a => ({
    id: a.id, topic: a.topic || "", intent: a.intent || [],
    vo: a.vo || "", grounds: a.grounds || [],
    ...(a.jump_to ? { jump_to: a.jump_to } : {}),
    ...(a.voice ? { voice: a.voice } : {}),
    ...(a.character ? { character: a.character } : {}),
  }));
  try {
    // Write beside, then rename — a half-written episode source is worse than
    // no write at all.
    const tmp = p + ".part";
    fs.writeFileSync(tmp, JSON.stringify(src, null, 2), "utf8");
    fs.renameSync(tmp, p);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * The three ways an atom bank goes wrong, from EPISODE_TEMPLATE.md.
 *
 * These are warnings, never blocks. The editor's job is to tell him what will
 * feel flat before he renders it, not to refuse the render.
 */
export function reviewAtoms(atoms: Atom[]): { level: "warn" | "info"; msg: string }[] {
  const out: { level: "warn" | "info"; msg: string }[] = [];

  if (atoms.length < 12) {
    out.push({
      level: "warn",
      msg: `Only ${atoms.length} atoms. Under about a dozen and viewers hit "the plan doesn't cover that" quickly, which breaks the illusion faster than a wrong answer would.`,
    });
  }

  // Intents written as search terms rather than things people say. A spoken
  // question almost always has a space in it.
  const keywordy = atoms.filter(a =>
    (a.intent || []).length > 0 &&
    (a.intent || []).every(i => !/\s/.test(String(i).trim())));
  if (keywordy.length) {
    out.push({
      level: "warn",
      msg: `${keywordy.map(a => a.id).join(", ")} — intents look like keywords. "revenue" fails where "how does it pay" works, because people ask questions rather than type search terms.`,
    });
  }

  // An atom may be played first, or after another atom. Anything that opens by
  // referring backwards breaks the moment it leads.
  const dependent = atoms.filter(a =>
    /^(as (i|we) (mentioned|said)|like i said|again,|also,|and that|but that|so that)/i.test((a.vo || "").trim()));
  if (dependent.length) {
    out.push({
      level: "warn",
      msg: `${dependent.map(a => a.id).join(", ")} — opens by referring to something earlier. Atoms play in any order, so this breaks when it comes first.`,
    });
  }

  const noIntent = atoms.filter(a => !(a.intent || []).length);
  if (noIntent.length) {
    out.push({ level: "warn", msg: `${noIntent.map(a => a.id).join(", ")} — no intents, so nothing can route to them.` });
  }

  const unrendered = atoms.filter(a => !a.audio);
  if (unrendered.length) {
    out.push({
      level: "info",
      msg: `${unrendered.length} atom${unrendered.length === 1 ? "" : "s"} not rendered yet — they exist as text but the player has no audio to reach for.`,
    });
  }

  const noGround = atoms.filter(a => !(a.grounds || []).length);
  if (noGround.length) {
    out.push({ level: "info", msg: `${noGround.map(a => a.id).join(", ")} — no grounds. No source means nothing backs the claim if a viewer pushes.` });
  }

  return out;
}
