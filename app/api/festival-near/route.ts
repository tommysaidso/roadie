import { NextRequest, NextResponse } from "next/server";
import { all, one } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
export const dynamic="force-dynamic";
// Around a festival: local venues, open slots and bands within a radius.
export async function GET(req:NextRequest){
  const id=Number(req.nextUrl.searchParams.get("id"));
  const radius=Number(req.nextUrl.searchParams.get("km")||120);
  const fest:any=one("SELECT * FROM festivals WHERE id=?", id);
  if(!fest) return NextResponse.json({ error:"not found" },{status:404});
  const c:[number,number]=[fest.lat,fest.lng];
  const near=(rows:any[])=>rows.filter(r=>r.lat&&r.lng&&haversineKm(c,[r.lat,r.lng])<=radius)
    .map(r=>({...r,km:Math.round(haversineKm(c,[r.lat,r.lng]))})).sort((a,b)=>a.km-b.km);
  const venues=near(all("SELECT id,name,city,lat,lng,capacity,contact FROM venues"));
  const bands=near(all("SELECT id,name,home_city,genre,lat,lng FROM bands WHERE lat IS NOT NULL"));
  const slots=all("SELECT s.id,s.date,s.genre_wanted,s.guarantee,v.name venue,v.city,v.lat,v.lng FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open'");
  const nearSlots=slots.filter((r:any)=>r.lat&&r.lng&&haversineKm(c,[r.lat,r.lng])<=radius);
  return NextResponse.json({ fest, venues, bands, slots:nearSlots });
}
