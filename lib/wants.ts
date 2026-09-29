// THE WANTS LIST — what to go and get.
//
// The shelf only helps if you know what is missing. Ben has the Adobe and
// Storyblocks credits; what he does not have is a list telling him which four
// shots would finish the promo. So the AI reads the brief and writes the
// shopping list: plain descriptions you can paste into a stock search, each one
// a slot the download drops into.
//
// Deliberately search-phrase shaped, not prose. "wide aerial of a two-lane
// highway through pine forest, dusk, no vehicles" is something you can type
// into Storyblocks; "an evocative sense of the open road" is not.

import { all, one, run, getDb } from "./db";

let ready = false;

export function ensureWantsSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS stock_wants (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,              -- the promo this is for, when there is one
      brief TEXT DEFAULT '',           -- what was asked for
      description TEXT NOT NULL,       -- paste this into the stock search
      kind TEXT DEFAULT 'image',       -- image | video
      why TEXT DEFAULT '',             -- what it is for in the cut
      status TEXT DEFAULT 'wanted',    -- wanted | filled | skipped
      filled_with TEXT,                -- stock id once it lands
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wants_status ON stock_wants(status);
  `);
  ready = true;
}

export function wantsList(projectId?: number | null) {
  ensureWantsSchema();
  return projectId
    ? all<any>("SELECT * FROM stock_wants WHERE project_id=? ORDER BY status, position, id", projectId)
    : all<any>("SELECT * FROM stock_wants ORDER BY status, position, id LIMIT 100");
}

export function addWant(w: {
  project_id?: number | null; brief?: string; description: string;
  kind?: string; why?: string; position?: number;
}) {
  ensureWantsSchema();
  const kind = String(w.kind || "image").toLowerCase() === "video" ? "video" : "image";
  const r = run(
    `INSERT INTO stock_wants(project_id,brief,description,kind,why,position)
     VALUES(?,?,?,?,?,?)`,
    w.project_id ?? null, String(w.brief || ""), String(w.description).slice(0, 400),
    kind, String(w.why || "").slice(0, 300), Number(w.position) || 0);
  return one<any>("SELECT * FROM stock_wants WHERE id=?", Number(r.lastInsertRowid));
}

export function fillWant(id: number, stockId: string) {
  ensureWantsSchema();
  run("UPDATE stock_wants SET status='filled', filled_with=? WHERE id=?", stockId, id);
  return one<any>("SELECT * FROM stock_wants WHERE id=?", id);
}

/**
 * Ask the model for a stock shopping list.
 *
 * Returns [] rather than throwing when there is no key or the model wanders off
 * format — a missing list is a nuisance, a 500 in the middle of the studio is a
 * broken page.
 */
export async function suggestWants(brief: string, existing: string[] = []): Promise<any[]> {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
  if (!key) return [];

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const prompt = [
    "You are helping assemble a short sponsor promo for a Canadian touring music circuit",
    "through British Columbia and Alberta. Decide which STOCK shots are still needed.",
    "",
    `BRIEF: ${brief}`,
    existing.length ? `ALREADY ON THE SHELF (do not repeat): ${existing.join("; ")}` : "",
    "",
    "Rules:",
    "- 4 to 6 items, no more.",
    "- Each description must read like a stock-library SEARCH PHRASE, not prose.",
    "- Real, findable footage only. Nothing branded, no named venues, no logos.",
    "- Vehicles must read mid-1980s or newer. Never a 1970s van or a VW bus.",
    "- Prefer video for anything with movement, image for anything held.",
    "",
    'Reply with ONLY a JSON array, no prose, no code fence:',
    '[{"description":"...","kind":"video","why":"..."}]',
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(20000),
      });
    if (!r.ok) return [];
    const data: any = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Models add a fence even when told not to; take the array either way.
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x: any) => x && typeof x.description === "string" && x.description.trim())
      .slice(0, 8)
      .map((x: any) => ({
        description: String(x.description).trim().slice(0, 400),
        kind: String(x.kind || "image").toLowerCase() === "video" ? "video" : "image",
        why: String(x.why || "").trim().slice(0, 300),
      }));
  } catch {
    return [];
  }
}
