import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser, ownsBand, forbid } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function GET(){ return NextResponse.json({ tours: all("SELECT * FROM tours"), stops: all("SELECT * FROM tour_stops ORDER BY tour_id,seq") }); }
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const { band_id, name, stops } = await req.json();
  if (!ownsBand(g.user, band_id)) return forbid("You can only plan tours for your own band.");
  const t = run("INSERT INTO tours(band_id,name,status) VALUES(?,?, 'planning')", band_id, name||"Untitled run");
  const tid = Number(t.lastInsertRowid);
  (stops||[]).forEach((s:any,i:number)=> run("INSERT INTO tour_stops(tour_id,seq,city,lat,lng,date,status) VALUES(?,?,?,?,?,?, 'target')", tid, i, s.city, s.lat, s.lng, s.date));
  return NextResponse.json({ tourId: tid });
}
