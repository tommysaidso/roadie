import { NextRequest, NextResponse } from "next/server";
import { gridGaps, gapAlerts, opportunitiesForBand, trackerSummary } from "@/lib/opportunities";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  const sp = req.nextUrl.searchParams;
  const bandId = sp.get("bandId");
  if(bandId) return NextResponse.json({ opportunities: opportunitiesForBand(Number(bandId)) });
  if(sp.get("alerts")) return NextResponse.json({ alerts: gapAlerts(), summary: trackerSummary() });
  return NextResponse.json({ gaps: gridGaps(), summary: trackerSummary() });
}
