import { NextRequest, NextResponse } from "next/server";
import { run, all, one } from "@/lib/db";
export const dynamic = "force-dynamic";

function ensureTables() {
  run(`CREATE TABLE IF NOT EXISTS crew_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    email TEXT,
    phone TEXT,
    union_status TEXT DEFAULT 'non-union',
    rate_type TEXT DEFAULT 'daily',
    rate_cad INTEGER DEFAULT 0,
    contract_status TEXT DEFAULT 'none',
    t4_status TEXT DEFAULT 'none',
    worksafe_bc TEXT DEFAULT 'none',
    sin_on_file INTEGER DEFAULT 0,
    filming_province TEXT DEFAULT 'BC',
    emergency_contact TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  // Migrations — add columns if table already existed
  try { run("ALTER TABLE crew_members ADD COLUMN sin_on_file INTEGER DEFAULT 0"); } catch {}
  try { run("ALTER TABLE crew_members ADD COLUMN filming_province TEXT DEFAULT 'BC'"); } catch {}
}

export async function GET() {
  ensureTables();
  const rows = all<any>(
    "SELECT * FROM crew_members WHERE active=1 ORDER BY department, role"
  );
  return NextResponse.json({ crew: rows });
}

export async function POST(req: NextRequest) {
  ensureTables();
  const b = await req.json();
  if (b.id) {
    // Update
    run(
      `UPDATE crew_members SET name=?,role=?,department=?,email=?,phone=?,
       union_status=?,rate_type=?,rate_cad=?,contract_status=?,t4_status=?,
       worksafe_bc=?,sin_on_file=?,filming_province=?,emergency_contact=?,notes=? WHERE id=?`,
      b.name, b.role, b.department ?? null, b.email ?? null, b.phone ?? null,
      b.union_status ?? "non-union", b.rate_type ?? "daily", b.rate_cad ?? 0,
      b.contract_status ?? "none", b.t4_status ?? "none",
      b.worksafe_bc ?? "none", b.sin_on_file ? 1 : 0, b.filming_province ?? "BC",
      b.emergency_contact ?? null, b.notes ?? null, b.id
    );
    return NextResponse.json({ ok: true });
  }
  const r = run(
    `INSERT INTO crew_members
      (name,role,department,email,phone,union_status,rate_type,rate_cad,
       contract_status,t4_status,worksafe_bc,sin_on_file,filming_province,emergency_contact,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.name, b.role, b.department ?? null, b.email ?? null, b.phone ?? null,
    b.union_status ?? "non-union", b.rate_type ?? "daily", b.rate_cad ?? 0,
    b.contract_status ?? "none", b.t4_status ?? "none",
    b.worksafe_bc ?? "none", b.sin_on_file ? 1 : 0, b.filming_province ?? "BC",
    b.emergency_contact ?? null, b.notes ?? null
  );
  return NextResponse.json({ id: (r as any).lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  ensureTables();
  const { id } = await req.json();
  run("UPDATE crew_members SET active=0 WHERE id=?", id);
  return NextResponse.json({ ok: true });
}
