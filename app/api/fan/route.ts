import { NextRequest, NextResponse } from "next/server";
import { run, all } from "@/lib/db";
import { rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";
// Fan follows/questions stay OPEN (fans should not need accounts) but are
// rate-limited per IP so a stranger cannot flood the table.
export async function POST(req:NextRequest){
  const limited = rateLimit(req, "fan", 20, 60*60*1000); if (limited) return limited;
  const b = await req.json();
  const kind = ["follow","tip_intent","signup"].includes(b.kind) ? b.kind : "question";
  if(kind==="question" && !(b.body||"").trim()) return NextResponse.json({ error:"message required" },{status:400});
  run(`INSERT INTO fan_messages(kind,band_id,venue_id,fan_name,fan_email,body) VALUES(?,?,?,?,?,?)`,
    kind, b.band_id||null, b.venue_id||null, (b.name||"").slice(0,120), (b.email||"").slice(0,160), (b.body||"").slice(0,2000));
  return NextResponse.json({ ok:true });
}
export async function GET(req:NextRequest){
  const bid = req.nextUrl.searchParams.get("bandId");
  const rows = bid ? all("SELECT kind,COUNT(*) n FROM fan_messages WHERE band_id=? GROUP BY kind", Number(bid))
                   : all("SELECT kind,COUNT(*) n FROM fan_messages GROUP BY kind");
  return NextResponse.json({ stats: rows });
}
