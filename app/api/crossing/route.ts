import { NextRequest, NextResponse } from "next/server";
import { all, one } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  const sp=req.nextUrl.searchParams;
  const from=sp.get("from"), to=sp.get("to");
  let crossings:any[];
  if(from&&to){
    crossings = all("SELECT * FROM crossings WHERE (from_country=? OR from_country='ANY') AND to_country=? ORDER BY CASE category WHEN 'visa' THEN 0 WHEN 'tax' THEN 1 WHEN 'gear' THEN 2 WHEN 'port_entry' THEN 3 ELSE 4 END", from, to);
  } else {
    crossings = all("SELECT * FROM crossings ORDER BY to_country, category");
  }
  const contact = one("SELECT * FROM contacts WHERE role='immigration_help' LIMIT 1");
  return NextResponse.json({ crossings, contact });
}
