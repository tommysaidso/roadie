import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/guard";
export const dynamic="force-dynamic";
// Explicit member rank: lifetime members first, samples last. (A bare string
// DESC sort put "sample" above "lifetime_free" and buried Mose at the bottom.)
const RANK = "CASE member_status WHEN 'lifetime_free' THEN 0 WHEN 'member' THEN 1 ELSE 2 END";
export async function GET(req:NextRequest){
  const tag=req.nextUrl.searchParams.get("tag");
  const rows= tag? all("SELECT * FROM pros WHERE (','||lower(replace(tags,' ',''))||',') LIKE ? ORDER BY "+RANK+", name", `%,${tag},%`)
                 : all("SELECT * FROM pros ORDER BY "+RANK+", name");
  return NextResponse.json({ pros: rows });
}
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const p=await req.json();
  const r=run(`INSERT INTO pros(name,headline,kind,tags,city,region,country,remote,bio,links) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    p.name,p.headline||"",p.kind||"producer",p.tags||"",p.city||"",p.region||"",p.country||"CA",p.remote?1:0,p.bio||"",JSON.stringify(p.links||{}));
  return NextResponse.json({ id:r.lastInsertRowid });
}
