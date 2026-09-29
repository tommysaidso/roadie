import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";
export const dynamic = "force-dynamic";
export async function GET(){
  return NextResponse.json({
    maps: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    workspace: googleConfigured(),  // gmail + drive
  });
}
