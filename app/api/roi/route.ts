import { NextResponse } from "next/server";
import { all, one } from "@/lib/db";
import { ensureHotelSchema } from "@/lib/hotels";
export const dynamic = "force-dynamic";
export async function GET(){
  ensureHotelSchema();
  const hotelLane = one<any>(`SELECT COUNT(DISTINCT sponsor_id) hotels, COALESCE(SUM(nights*rooms),0) room_nights,
    COALESCE(SUM(nights*rooms*COALESCE(rate_usd,0)),0) est_revenue
    FROM room_nights WHERE date >= date('now','-90 days')`);
  const rows:any[] = all(`SELECT a.*, s.name sponsor, s.kind FROM ad_placements a JOIN sponsors s ON s.id=a.sponsor_id`);
  const enriched = rows.map(r=>{
    const ctr = r.impressions? r.clicks/r.impressions : 0;
    const cvr = r.clicks? r.conversions/r.clicks : 0;
    const cpa = r.conversions? r.cost/r.conversions : null;
    const cpm = r.impressions? (r.cost/r.impressions)*1000 : null;
    return { ...r, ctr, cvr, cpa, cpm };
  });
  const totals = enriched.reduce((t,r)=>({cost:t.cost+r.cost, impressions:t.impressions+r.impressions, clicks:t.clicks+r.clicks, conversions:t.conversions+r.conversions}),{cost:0,impressions:0,clicks:0,conversions:0});
  return NextResponse.json({ placements: enriched, totals, hotel_lane: { days:90, hotels:Number(hotelLane?.hotels||0), room_nights:Number(hotelLane?.room_nights||0), est_revenue_usd:Math.round(Number(hotelLane?.est_revenue||0)) } });
}
