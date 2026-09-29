import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { city, region = "BC", email, note } = await req.json();
  if (!city?.trim()) return NextResponse.json({ error: "city required" }, { status: 400 });

  const c = city.trim().toLowerCase();
  const r = region.trim().toUpperCase();
  const existing = one<any>("SELECT id, count FROM fan_stop_requests WHERE lower(city)=? AND region=?", c, r);
  if (existing) {
    run("UPDATE fan_stop_requests SET count=count+1 WHERE id=?", existing.id);
    return NextResponse.json({ id: existing.id, count: existing.count + 1 });
  }
  const result = run(
    "INSERT INTO fan_stop_requests(city,region,email,note) VALUES(?,?,?,?)",
    city.trim(), r, email || null, note || null
  );
  return NextResponse.json({ id: result.lastInsertRowid, count: 1 });
}
