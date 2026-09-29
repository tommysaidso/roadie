import { NextResponse } from "next/server";
import { all } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(){
  const bookings = all(`SELECT b.*, ba.name band, v.name venue, v.city FROM bookings b
    JOIN bands ba ON ba.id=b.band_id JOIN venues v ON v.id=b.venue_id ORDER BY b.date`);
  const open = all(`SELECT s.*, v.name venue, v.city FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open' ORDER BY s.date`);
  return NextResponse.json({ bookings, open });
}
