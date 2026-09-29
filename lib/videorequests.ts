// MUSIC VIDEO REQUESTS — a band asking us to make them one.
//
// This is the front door to the production business from the band side. The
// advertising pages sell to businesses; this is the same crew and the same
// cameras pointed at the artists already on the platform.
//
// The brief is the whole point. "We want a music video" is not a brief and
// cannot be quoted or scheduled; "this song, this look, these three locations,
// the band plays live in a garage at night" is. So the form asks for the things
// that actually decide the shoot, and an AI pass can turn a rambling answer
// into a treatment the band still recognises as theirs.
//
// Nothing here auto-replies or auto-quotes. A request lands, we read it, we
// answer. Money and scheduling are human decisions.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureVideoSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS video_requests (
      id INTEGER PRIMARY KEY,
      band_id INTEGER,
      band_name TEXT DEFAULT '',       -- kept flat so a request survives a renamed band
      user_id INTEGER,
      contact_email TEXT DEFAULT '',
      song TEXT DEFAULT '',
      song_link TEXT DEFAULT '',
      kind TEXT DEFAULT 'performance', -- performance | narrative | lyric | live | mixed
      look TEXT DEFAULT '',            -- the feel: gritty, neon, daylight, black and white
      story TEXT DEFAULT '',           -- what happens in it
      locations TEXT DEFAULT '',       -- where they can actually shoot
      people TEXT DEFAULT '',          -- who is in it besides the band
      must_have TEXT DEFAULT '',       -- the one shot they will be upset to lose
      avoid TEXT DEFAULT '',           -- what they do NOT want
      refs TEXT DEFAULT '',            -- videos they like, links or names
      timing TEXT DEFAULT '',          -- when it needs to exist
      budget TEXT DEFAULT '',          -- their words, not a picklist
      diy INTEGER DEFAULT 0,           -- 1 = they want to make it themselves with our tools
      treatment TEXT DEFAULT '',       -- the AI-assembled version of the above
      status TEXT DEFAULT 'new',       -- new | reading | quoted | booked | done | declined
      note TEXT DEFAULT '',            -- our internal note back
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_video_requests_band ON video_requests(band_id);
    CREATE INDEX IF NOT EXISTS idx_video_requests_status ON video_requests(status);
  `);
  ready = true;
}

export type VideoBrief = Partial<{
  band_id: number; band_name: string; user_id: number; contact_email: string;
  song: string; song_link: string; kind: string; look: string; story: string;
  locations: string; people: string; must_have: string; avoid: string;
  refs: string; timing: string; budget: string; diy: number; treatment: string;
}>;

const FIELDS = ["band_id","band_name","user_id","contact_email","song","song_link","kind",
  "look","story","locations","people","must_have","avoid","refs","timing","budget",
  "diy","treatment"] as const;

export function createRequest(b: VideoBrief) {
  ensureVideoSchema();
  const cols = FIELDS.filter(f => b[f] !== undefined);
  const sql = `INSERT INTO video_requests(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`;
  const r = run(sql, ...cols.map(f => (b as any)[f] ?? null));
  return one<any>("SELECT * FROM video_requests WHERE id=?", Number(r.lastInsertRowid));
}

export function requestsForBand(bandId: number) {
  ensureVideoSchema();
  return all<any>("SELECT * FROM video_requests WHERE band_id=? ORDER BY id DESC", bandId);
}

export function allRequests(limit = 100) {
  ensureVideoSchema();
  return all<any>("SELECT * FROM video_requests ORDER BY id DESC LIMIT ?", limit);
}

export function setStatus(id: number, status: string, note?: string) {
  ensureVideoSchema();
  run("UPDATE video_requests SET status=?, note=COALESCE(?,note), updated_at=datetime('now') WHERE id=?",
    status, note ?? null, id);
  return one<any>("SELECT * FROM video_requests WHERE id=?", id);
}

/**
 * Turn the answers into a treatment.
 *
 * Deliberately a REWRITE, not an invention. The band's own words for the look,
 * the story and the must-have shot carry through — the model's job is to order
 * them into something a crew can shoot from, not to have its own ideas about
 * their song. A band that reads the treatment back and doesn't recognise it
 * will not book the shoot.
 *
 * Returns null rather than throwing: a missing treatment is a nuisance, a
 * failed submission loses the request.
 */
export async function draftTreatment(b: VideoBrief): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
  if (!key) return null;
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

  const said = [
    b.song && `SONG: ${b.song}`,
    b.kind && `TYPE: ${b.kind}`,
    b.look && `LOOK/FEEL: ${b.look}`,
    b.story && `WHAT HAPPENS: ${b.story}`,
    b.locations && `PLACES THEY CAN SHOOT: ${b.locations}`,
    b.people && `WHO'S IN IT: ${b.people}`,
    b.must_have && `MUST HAVE: ${b.must_have}`,
    b.avoid && `DO NOT: ${b.avoid}`,
    b.refs && `VIDEOS THEY LIKE: ${b.refs}`,
    b.timing && `TIMING: ${b.timing}`,
  ].filter(Boolean).join("\n");

  const prompt = [
    "Turn a band's answers into a short shooting treatment for a music video.",
    "",
    said,
    "",
    "Rules:",
    "- Use THEIR words for the look, the story and the must-have. Do not replace their idea with a better one.",
    "- 150 words maximum, plain sentences, no headings, no marketing language.",
    "- Then a line 'SHOTS:' and 4 to 6 shot lines, each one sentence: subject, place, time of day, what is happening.",
    "- Shots must be shootable with a small crew in the places they listed. No crowds, helicopters or road closures unless they said so.",
    "- Vehicles, if any, read as mid-1980s or newer. Never a 1970s van or a VW bus.",
    "- If something important is missing, end with one line starting 'NEEDS:' naming what to ask them.",
  ].join("\n");

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(30000),
      });
    if (!r.ok) return null;
    const d: any = await r.json();
    const t = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("").trim();
    return t || null;
  } catch { return null; }
}
