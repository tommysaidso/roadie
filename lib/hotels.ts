import { getDb, all, one, run } from "./db";

// The hotel lane — chains + independents along the corridor as claimable
// sponsor listings, with the three revenue models wired:
//   1. placement fees   → existing ad_placements (surface: tour_map etc.)
//   2. perk trade       → existing perks (hotel_night), now with booking links
//   3. percentage deal  → affiliate/booking URLs + room-night attribution,
//                         so we can show a GM "$X in room-nights routed to you
//                         in 90 days" — the ROI proof that converts to paid.

export function ensureHotelSchema() {
  const db = getDb();
  for (const col of [
    "member_status TEXT DEFAULT 'member'",  // member | sample (scraped, unclaimed)
    "lat REAL", "lng REAL",
    "booking_url TEXT",                      // direct booking / group-desk link
    "affiliate_code TEXT",                   // our affiliate tag (Marriott/Choice/…)
    "band_rate TEXT",                        // e.g. "15% off rack" | "$89 flat crew rate"
    "user_id INTEGER",                       // claim linkage (matches bands/venues)
  ]) {
    try { db.exec(`ALTER TABLE sponsors ADD COLUMN ${col}`); } catch {}
  }
  for (const col of ["booking_url TEXT", "affiliate_code TEXT"]) {
    try { db.exec(`ALTER TABLE perks ADD COLUMN ${col}`); } catch {}
    try { db.exec(`ALTER TABLE tour_amenities ADD COLUMN ${col}`); } catch {}
  }
  try { db.exec(`ALTER TABLE tour_amenities ADD COLUMN sponsor_id INTEGER`); } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS room_nights (
    id INTEGER PRIMARY KEY,
    sponsor_id INTEGER REFERENCES sponsors(id),
    band_id INTEGER REFERENCES bands(id),
    tour_id INTEGER,
    city TEXT,
    date TEXT,
    nights INTEGER DEFAULT 1,
    rooms INTEGER DEFAULT 1,
    rate_usd REAL,
    source TEXT DEFAULT 'manual',          -- manual | perk | affiliate
    created_at TEXT DEFAULT (datetime('now')))`);
}

export function hotelList(opts: { city?: string; hubId?: number; claimedOnly?: boolean } = {}) {
  ensureHotelSchema();
  const where = ["kind='hotel'"]; const p: any[] = [];
  if (opts.city) { where.push("lower(city)=lower(?)"); p.push(opts.city); }
  if (opts.hubId) { where.push("hub_id=?"); p.push(opts.hubId); }
  if (opts.claimedOnly) where.push("member_status='member' AND user_id IS NOT NULL");
  return all(`SELECT * FROM sponsors WHERE ${where.join(" AND ")} ORDER BY member_status='member' DESC, city, name`, ...p);
}

// Attribution rollup — the number we show the GM (and the participation trigger).
export function hotelRoi(sponsorId: number, days = 90) {
  ensureHotelSchema();
  const r = one<any>(`SELECT COUNT(*) stays, COALESCE(SUM(nights*rooms),0) room_nights,
    COALESCE(SUM(nights*rooms*COALESCE(rate_usd,0)),0) est_revenue
    FROM room_nights WHERE sponsor_id=? AND date >= date('now','-${Math.max(1, days)} days')`, sponsorId);
  const perkClaims = one<any>(`SELECT COALESCE(SUM(qty_claimed),0) n FROM perks WHERE sponsor_id=? AND kind='hotel_night'`, sponsorId);
  return {
    days, stays: Number(r?.stays || 0), room_nights: Number(r?.room_nights || 0),
    est_revenue_usd: Math.round(Number(r?.est_revenue || 0)),
    perk_nights_claimed: Number(perkClaims?.n || 0),
  };
}
