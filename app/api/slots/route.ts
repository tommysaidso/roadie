import { NextResponse } from "next/server";
import { all } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(){
  return NextResponse.json({ slots: all(
    `SELECT s.*, v.name venue, v.city, v.capacity FROM venue_slots s JOIN venues v ON v.id=s.venue_id
     WHERE s.status='open' AND s.date >= date('now') ORDER BY s.date`) });
}
