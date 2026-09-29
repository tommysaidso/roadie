import { NextRequest, NextResponse } from "next/server";
import { run, all } from "@/lib/db";
export const dynamic = "force-dynamic";

function ensureTable() {
  run(`CREATE TABLE IF NOT EXISTS production_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_type TEXT DEFAULT 'shoot',
    location TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT,
    crew_ids TEXT DEFAULT '[]',
    notes TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
}

export async function GET(req: NextRequest) {
  ensureTable();
  const from = req.nextUrl.searchParams.get("from") || "";
  const to   = req.nextUrl.searchParams.get("to")   || "";
  let rows;
  if (from && to) {
    rows = all<any>(
      "SELECT * FROM production_events WHERE start_at >= ? AND start_at <= ? ORDER BY start_at",
      from, to
    );
  } else {
    rows = all<any>("SELECT * FROM production_events ORDER BY start_at DESC LIMIT 60");
  }
  return NextResponse.json({ events: rows });
}

export async function POST(req: NextRequest) {
  ensureTable();
  const b = await req.json();
  if (b.id) {
    run(
      `UPDATE production_events SET title=?,event_type=?,location=?,start_at=?,
       end_at=?,crew_ids=?,notes=?,status=? WHERE id=?`,
      b.title, b.event_type ?? "shoot", b.location ?? null,
      b.start_at, b.end_at ?? null, JSON.stringify(b.crew_ids ?? []),
      b.notes ?? null, b.status ?? "scheduled", b.id
    );
    return NextResponse.json({ ok: true });
  }
  const r = run(
    `INSERT INTO production_events (title,event_type,location,start_at,end_at,crew_ids,notes,status)
     VALUES (?,?,?,?,?,?,?,?)`,
    b.title, b.event_type ?? "shoot", b.location ?? null,
    b.start_at, b.end_at ?? null, JSON.stringify(b.crew_ids ?? []),
    b.notes ?? null, b.status ?? "scheduled"
  );
  return NextResponse.json({ id: (r as any).lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  ensureTable();
  const { id } = await req.json();
  run("DELETE FROM production_events WHERE id=?", id);
  return NextResponse.json({ ok: true });
}
