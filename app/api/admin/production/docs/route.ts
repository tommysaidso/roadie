import { NextRequest, NextResponse } from "next/server";
import { run, all } from "@/lib/db";
export const dynamic = "force-dynamic";

function ensureTable() {
  run(`CREATE TABLE IF NOT EXISTS production_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_type TEXT NOT NULL,
    crew_id INTEGER,
    crew_name TEXT,
    status TEXT DEFAULT 'pending',
    reference_number TEXT,
    issued_at TEXT,
    due_at TEXT,
    filed_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
}

export async function GET() {
  ensureTable();
  const rows = all<any>("SELECT * FROM production_docs ORDER BY doc_type, crew_name");
  return NextResponse.json({ docs: rows });
}

export async function POST(req: NextRequest) {
  ensureTable();
  const b = await req.json();
  if (b.id) {
    run(
      `UPDATE production_docs SET status=?,reference_number=?,issued_at=?,
       due_at=?,filed_at=?,notes=? WHERE id=?`,
      b.status, b.reference_number ?? null, b.issued_at ?? null,
      b.due_at ?? null, b.filed_at ?? null, b.notes ?? null, b.id
    );
    return NextResponse.json({ ok: true });
  }
  const r = run(
    `INSERT INTO production_docs (doc_type,crew_id,crew_name,status,reference_number,issued_at,due_at,filed_at,notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    b.doc_type, b.crew_id ?? null, b.crew_name ?? null,
    b.status ?? "pending", b.reference_number ?? null,
    b.issued_at ?? null, b.due_at ?? null, b.filed_at ?? null, b.notes ?? null
  );
  return NextResponse.json({ id: (r as any).lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  ensureTable();
  const { id } = await req.json();
  run("DELETE FROM production_docs WHERE id=?", id);
  return NextResponse.json({ ok: true });
}
