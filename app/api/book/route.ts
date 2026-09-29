import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { generateContract } from "@/lib/contract";
import { requireUser, ownsBand, ownsVenue, forbid } from "@/lib/guard";
import { rankBandsForSlot } from "@/lib/match";
export const dynamic = "force-dynamic";
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const body = await req.json();
  const { slotId, auto } = body;
  let { bandId, score } = body;
  const slot:any = one("SELECT * FROM venue_slots WHERE id=?", slotId);
  if(!slot) return NextResponse.json({ error:"slot not found" },{status:404});

  if (auto) {
    // AI auto-fill: only the venue that owns this night may trigger it, and
    // the AI picks the band — venues never hand-place someone else's act.
    if (!ownsVenue(g.user, slot.venue_id)) return forbid("Only this venue can auto-fill its own night.");
    const ranked = rankBandsForSlot(Number(slotId));
    if (!ranked.length) return NextResponse.json({ error:"No matchable bands for this night yet." },{status:404});
    bandId = ranked[0].band.id; score = ranked[0].score;
  } else {
    // A band places ITSELF. Never someone else's band.
    if (!ownsBand(g.user, bandId)) return forbid("You can only book your own band. Venues: use AI auto-fill.");
  }
  // Atomic claim: only flip open->booked once - a second booker matches zero
  // rows and gets a 409 instead of silently double-booking the night.
  const claim = run("UPDATE venue_slots SET status='booked' WHERE id=? AND status='open'", slotId);
  if (claim.changes === 0) return NextResponse.json({ error:"That slot was just taken - pick another." },{status:409});
  const r = run(`INSERT INTO bookings(slot_id,band_id,venue_id,date,status,guarantee,ai_match_score)
    VALUES(?,?,?,?, 'confirmed', ?, ?)`, slotId, bandId, slot.venue_id, slot.date, slot.guarantee, score??null);
  const contract = generateContract(Number(r.lastInsertRowid));
  return NextResponse.json({ bookingId: r.lastInsertRowid, contract });
}
