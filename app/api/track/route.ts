import { NextRequest, NextResponse } from "next/server";
import { getDb, run, all } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";

export const dynamic = "force-dynamic";

// A tiny counter for front-of-house choices — which door a visitor took, and
// under which wording.
//
// Deliberately NOT analytics. No identity, no IP, no fingerprint, no third
// party. Three short strings and a timestamp, so a question like "does the
// advertising door out-pull the sponsor door" can be answered from our own
// database instead of guessed at.
//
// Open to anonymous visitors by necessity — the whole point is measuring people
// who have not signed in — so everything is length-capped and the write is
// best-effort. A tracking beacon must never be able to break a page or become
// a way to fill the disk.

let ready = false;
function ensure() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS ui_events (
      id INTEGER PRIMARY KEY,
      what TEXT NOT NULL,
      door TEXT,
      variant TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ui_events_what ON ui_events(what);
  `);
  ready = true;
}

const clean = (v: any, max = 40) =>
  String(v ?? "").replace(/[^\w .:-]/g, "").slice(0, max);

export async function POST(req: NextRequest) {
  try {
    ensure();
    const b = await req.json().catch(() => ({} as any));
    const what = clean(b?.what);
    if (!what) return NextResponse.json({ ok: false }, { status: 204 });
    run("INSERT INTO ui_events(what,door,variant) VALUES(?,?,?)",
      what, clean(b?.door), clean(b?.variant, 8));
  } catch {
    // Swallow. A counter is never worth a 500 in front of a buyer.
  }
  // 204 so sendBeacon has nothing to parse.
  return new NextResponse(null, { status: 204 });
}

// The read side is operator-only — it is our numbers, not the public's.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Operator-only.");
  ensure();
  return NextResponse.json({
    doors: all<any>(
      `SELECT what, door, variant, COUNT(*) n
         FROM ui_events GROUP BY what, door, variant ORDER BY n DESC LIMIT 50`),
  });
}
