import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { requireUser, ownsSponsor, ownsBand, forbid, rateLimit } from "@/lib/guard";
import { ensureHotelSchema, hotelList, hotelRoi } from "@/lib/hotels";
import { startTrial } from "@/lib/participation";
export const dynamic = "force-dynamic";

// The hotel lane.
//   GET  ?city= | ?hubId= | ?claimed=1        → hotel listings for routing/maps
//   GET  ?roi=<sponsorId>                     → room-night attribution (owner/admin)
//   POST { action:"upsert", ... }             → hotel signs up / owner edits (booking_url, band_rate, affiliate_code)
//   POST { action:"room_night", ... }         → record a stay (band or hotel side) — feeds ROI + participation proof
// Claiming a scraped hotel = existing /api/auth/link { role:"sponsor", recordId } (starts trial, flips sample→member).

export async function GET(req: NextRequest) {
  ensureHotelSchema();
  const q = req.nextUrl.searchParams;
  const roiFor = Number(q.get("roi") || 0);
  if (roiFor) {
    const g = requireUser(req); if (g.deny) return g.deny;
    if (!ownsSponsor(g.user, roiFor)) return forbid("You can only view your own hotel's numbers.");
    return NextResponse.json({ sponsorId: roiFor, roi: hotelRoi(roiFor) });
  }
  const hotels = hotelList({
    city: q.get("city") || undefined,
    hubId: Number(q.get("hubId") || 0) || undefined,
    claimedOnly: q.get("claimed") === "1",
  });
  return NextResponse.json({ hotels });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "hotels", 60, 60 * 60 * 1000); if (limited) return limited;
  ensureHotelSchema();
  const b = await req.json();

  if (b.action === "room_night") {
    const sponsorId = Number(b.sponsorId || 0), bandId = Number(b.bandId || 0);
    if (!sponsorId || !b.date) return NextResponse.json({ error: "sponsorId + date required" }, { status: 400 });
    // Either side of the stay may record it: the hotel, or the band that stayed.
    if (!ownsSponsor(g.user, sponsorId) && !(bandId && ownsBand(g.user, bandId)))
      return forbid("Record stays for your own hotel or your own band only.");
    const h: any = one("SELECT id, city FROM sponsors WHERE id=? AND kind='hotel'", sponsorId);
    if (!h) return NextResponse.json({ error: "hotel not found" }, { status: 404 });
    const r = run(`INSERT INTO room_nights(sponsor_id,band_id,tour_id,city,date,nights,rooms,rate_usd,source)
      VALUES(?,?,?,?,?,?,?,?,?)`, sponsorId, bandId || null, Number(b.tourId || 0) || null,
      b.city || h.city || "", String(b.date), Math.max(1, Number(b.nights || 1)),
      Math.max(1, Number(b.rooms || 1)), Number(b.rate_usd || 0) || null,
      ["manual", "perk", "affiliate"].includes(b.source) ? b.source : "manual");
    return NextResponse.json({ ok: true, id: r.lastInsertRowid, roi: hotelRoi(sponsorId) });
  }

  // default: upsert a hotel listing
  const id = Number(b.id || 0);
  if (id) {
    if (!ownsSponsor(g.user, id)) return forbid("You can only edit your own hotel.");
    run(`UPDATE sponsors SET booking_url=COALESCE(?,booking_url), affiliate_code=COALESCE(?,affiliate_code),
      band_rate=COALESCE(?,band_rate), contact=COALESCE(?,contact), budget_monthly=COALESCE(?,budget_monthly) WHERE id=?`,
      b.booking_url ?? null, b.affiliate_code ?? null, b.band_rate ?? null, b.contact ?? null, b.budget_monthly ?? null, id);
    return NextResponse.json({ ok: true, id });
  }
  if (!b.name || !b.city) return NextResponse.json({ error: "name + city required" }, { status: 400 });
  const r = run(`INSERT INTO sponsors(name,kind,city,budget_monthly,contact,member_status,user_id,booking_url,affiliate_code,band_rate,lat,lng)
    VALUES(?,?,?,?,?,'member',?,?,?,?,?,?)`,
    b.name, "hotel", b.city, b.budget_monthly || null, b.contact || "",
    g.user.id, b.booking_url || null, b.affiliate_code || null, b.band_rate || null, b.lat || null, b.lng || null);
  const newId = Number(r.lastInsertRowid);
  try { startTrial("sponsor", newId); } catch {}
  try { run("UPDATE users SET sponsor_id=?, role='sponsor' WHERE id=? AND sponsor_id IS NULL", newId, g.user.id); } catch {}
  return NextResponse.json({ ok: true, id: newId, trial: true });
}
