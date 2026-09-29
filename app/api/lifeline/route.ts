import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { matchForNeed } from "@/lib/community";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
  const sp=req.nextUrl.searchParams;
  const id=sp.get("needId");
  const need = id? one("SELECT * FROM needs WHERE id=?", Number(id))
                 : { tag:sp.get("tag")||"needproducer", country:sp.get("country")||"", region:sp.get("region")||"", city:sp.get("city")||"" };
  return NextResponse.json({ need, match: matchForNeed(need) });
}
