import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = all(`SELECT id, name, kind, city, region, gear_notes, ring_pref, created_at
    FROM filmmaker_calls ORDER BY created_at DESC`);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, kind = "filmmaker", email, phone, city, region = "BC", gear_notes, ring_pref } = body;
  if (!name || !email) return NextResponse.json({ error: "name and email required" }, { status: 400 });
  const r = run(
    `INSERT INTO filmmaker_calls(name,kind,email,phone,city,region,gear_notes,ring_pref)
     VALUES(?,?,?,?,?,?,?,?)`,
    name, kind, email, phone || null, city || null, region, gear_notes || null, ring_pref || "any",
  );
  return NextResponse.json({ id: r.lastInsertRowid });
}
