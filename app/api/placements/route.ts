import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser, ownsSponsor, forbid } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  const sid = req.nextUrl.searchParams.get("sponsorId");
  const rows = sid
    ? all("SELECT * FROM ad_placements WHERE sponsor_id=? ORDER BY id DESC", Number(sid))
    : all("SELECT a.*, s.name sponsor FROM ad_placements a JOIN sponsors s ON s.id=a.sponsor_id ORDER BY a.id DESC");
  return NextResponse.json({ placements: rows });
}
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const p = await req.json();
  if (!ownsSponsor(g.user, p.sponsor_id)) return forbid("You can only add placements for your own sponsor account.");
  const r = run(`INSERT INTO ad_placements(sponsor_id,surface,label,cost,impressions,clicks,conversions,start_date,end_date)
    VALUES(?,?,?,?,0,0,0,?,?)`, p.sponsor_id, p.surface, p.label, p.cost, p.start_date, p.end_date);
  return NextResponse.json({ id:r.lastInsertRowid });
}
