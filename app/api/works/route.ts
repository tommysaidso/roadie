import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getBandWorks, mymymyStatus } from "@/lib/mymymy";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  const bandId = Number(req.nextUrl.searchParams.get("bandId"));
  const band:any = one("SELECT id,mymymy_artist_id FROM bands WHERE id=?", bandId);
  const works = await getBandWorks(bandId, band?.mymymy_artist_id);
  return NextResponse.json({ works, mymymy: mymymyStatus() });
}
