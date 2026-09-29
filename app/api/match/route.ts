import { NextRequest, NextResponse } from "next/server";
import { rankBandsForSlot, rankSlotsForBand } from "@/lib/match";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  const sp = req.nextUrl.searchParams;
  const slotId = sp.get("slotId"); const bandId = sp.get("bandId");
  if(slotId) return NextResponse.json({ results: rankBandsForSlot(Number(slotId)).slice(0,6) });
  if(bandId) return NextResponse.json({ results: rankSlotsForBand(Number(bandId)).slice(0,8) });
  return NextResponse.json({ results: [] });
}
