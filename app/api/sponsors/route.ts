import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function GET(){ return NextResponse.json({ sponsors: all("SELECT * FROM sponsors"), perks: all("SELECT * FROM perks") }); }
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const s = await req.json();
  const r = run(
    `INSERT INTO sponsors(name,kind,city,budget_monthly,contact,rep_brand,rep_role) VALUES(?,?,?,?,?,?,?)`,
    s.name, s.kind||"other", s.city||"", s.budget_monthly||null, s.contact||"",
    s.rep_brand||null, s.rep_role||null
  );
  return NextResponse.json({ id:r.lastInsertRowid });
}
