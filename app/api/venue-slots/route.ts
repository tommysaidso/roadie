import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser, ownsVenue, forbid } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  const vid = req.nextUrl.searchParams.get("venueId");
  const rows = vid
    ? all("SELECT * FROM venue_slots WHERE venue_id=? ORDER BY date", Number(vid))
    : all("SELECT s.*, v.name venue FROM venue_slots s JOIN venues v ON v.id=s.venue_id ORDER BY date");
  return NextResponse.json({ slots: rows });
}
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const s = await req.json();
  if (!ownsVenue(g.user, s.venue_id)) return forbid("You can only post slots for your own venue.");
  const r = run(`INSERT INTO venue_slots(venue_id,date,status,genre_wanted,guarantee,notes,source)
    VALUES(?,?, 'open', ?,?,?,?)`, s.venue_id, s.date, s.genre_wanted, s.guarantee, s.notes, s.source||"manual");
  return NextResponse.json({ id:r.lastInsertRowid });
}
