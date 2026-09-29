import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/guard";
export const dynamic="force-dynamic";
export async function GET(){ return NextResponse.json({ needs: all("SELECT * FROM needs WHERE status='open' ORDER BY created_at DESC") }); }
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const n=await req.json();
  const tag=String(n.tag||"").replace(/[^a-z]/gi,"").toLowerCase();
  const authorName = g.user.display_name || g.user.email;
  // author_id comes from the SESSION, never the body — taking n.author_id let
  // any signed-in user post a need attributed to somebody else's band.
  const r=run(`INSERT INTO needs(tag,author_kind,author_id,author_name,city,region,country,note) VALUES(?,?,?,?,?,?,?,?)`,
    tag, n.author_kind||"band", g.user.band_id||null, authorName, n.city||"", n.region||"", n.country||"", n.note||"");
  return NextResponse.json({ id:r.lastInsertRowid });
}
