import { NextRequest, NextResponse } from "next/server";
import { run, all, one } from "@/lib/db";
export const dynamic = "force-dynamic";

const SLUG = "roadie_ring";

function ensureTable() {
  run(`CREATE TABLE IF NOT EXISTS pitch_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pitch_slug TEXT NOT NULL DEFAULT '${SLUG}',
    contact_name TEXT NOT NULL,
    contact_org  TEXT,
    contact_email TEXT,
    method TEXT DEFAULT 'call',
    notes TEXT,
    outcome TEXT DEFAULT 'pending',
    contacted_at TEXT NOT NULL,
    next_followup_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
}

export async function GET(req: NextRequest) {
  ensureTable();
  const slug = req.nextUrl.searchParams.get("slug") || SLUG;
  const rows = all<any>(
    "SELECT * FROM pitch_contacts WHERE pitch_slug=? ORDER BY contacted_at DESC",
    slug
  );
  return NextResponse.json({ contacts: rows });
}

export async function POST(req: NextRequest) {
  ensureTable();
  const b = await req.json();
  const {
    pitch_slug = SLUG,
    contact_name,
    contact_org,
    contact_email,
    method = "call",
    notes,
    outcome = "pending",
    contacted_at,
    next_followup_at,
    created_by,
  } = b;
  const r = run(
    `INSERT INTO pitch_contacts
      (pitch_slug, contact_name, contact_org, contact_email, method, notes, outcome, contacted_at, next_followup_at, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    pitch_slug, contact_name, contact_org ?? null, contact_email ?? null,
    method, notes ?? null, outcome,
    contacted_at, next_followup_at ?? null, created_by ?? null
  );
  return NextResponse.json({ id: (r as any).lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  ensureTable();
  const { id, outcome, notes, next_followup_at } = await req.json();
  run(
    "UPDATE pitch_contacts SET outcome=?, notes=?, next_followup_at=? WHERE id=?",
    outcome, notes ?? null, next_followup_at ?? null, id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  ensureTable();
  const { id } = await req.json();
  run("DELETE FROM pitch_contacts WHERE id=?", id);
  return NextResponse.json({ ok: true });
}
