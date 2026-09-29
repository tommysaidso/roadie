// Bidding a whole ring.
//
// Three different things, deliberately kept apart:
//   · READINESS  — a standing flag: "we're a working act, we're here, consider
//                  us when the ring comes near." Never expires. (lib/readiness)
//   · STOP INTEREST — "we want THAT night." One stop. (stop_interest)
//   · ROUTE BID  — "we'll do the run." An act putting its hand up for the whole
//                  ring, or a stretch of it, as a single ask. That's this file.
//
// A route bid is NOT fanned out into per-stop rows. Duplicating it into
// stop_interest would give us two records of the same intent that drift apart
// the moment one is edited. It stays one row and the stop views read through
// it — coversStop() decides whether a bid reaches a given night.
import { all, one, run, getDb } from "./db";

export const BILL_ASKS = ["headliner", "direct_support", "support", "opener", "any"] as const;
export const BID_STATUS = ["submitted", "shortlisted", "accepted", "declined", "withdrawn"] as const;

let ensured = false;
export function ensureRouteBidSchema() {
  if (ensured) return;
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS route_bids (
    id INTEGER PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id),
    band_id INTEGER NOT NULL REFERENCES bands(id),
    scope TEXT DEFAULT 'whole_ring',      -- whole_ring | dates
    from_date TEXT, to_date TEXT,         -- only meaningful when scope='dates'
    wants_bill TEXT DEFAULT 'any',
    ask INTEGER,                          -- their number for the run, per night
    travel_all INTEGER DEFAULT 1,         -- will they ride the whole thing
    note TEXT,
    status TEXT DEFAULT 'submitted',
    decided_by INTEGER, decided_at TEXT, decision_note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(route_id, band_id)             -- one standing bid per act per ring
  )`);
  ensured = true;
}

export type RouteBid = {
  id: number; route_id: number; band_id: number; scope: string;
  from_date: string | null; to_date: string | null; wants_bill: string;
  ask: number | null; travel_all: number; note: string | null; status: string;
  decision_note?: string | null; created_at?: string;
};

/** Does this bid reach that night? */
export function coversStop(bid: RouteBid, stop: { date?: string | null }): boolean {
  if (bid.status === "withdrawn" || bid.status === "declined") return false;
  if (bid.scope !== "dates") return true;
  const d = String(stop.date || "").slice(0, 10);
  if (!d) return false;
  if (bid.from_date && d < String(bid.from_date).slice(0, 10)) return false;
  if (bid.to_date && d > String(bid.to_date).slice(0, 10)) return false;
  return true;
}

export function getBid(routeId: number, bandId: number): RouteBid | null {
  ensureRouteBidSchema();
  return one<RouteBid>("SELECT * FROM route_bids WHERE route_id=? AND band_id=?", routeId, bandId) || null;
}

export function listBidsForRoute(routeId: number) {
  ensureRouteBidSchema();
  return all<any>(`SELECT rb.*, b.name band_name, b.genres, b.genre, b.home_city, b.draw, b.lat, b.lng
                     FROM route_bids rb JOIN bands b ON b.id = rb.band_id
                    WHERE rb.route_id = ?
                    ORDER BY CASE rb.status WHEN 'accepted' THEN 0 WHEN 'shortlisted' THEN 1
                                            WHEN 'submitted' THEN 2 ELSE 3 END, rb.created_at`, routeId);
}

export function listBidsForBand(bandId: number) {
  ensureRouteBidSchema();
  return all<any>(`SELECT rb.*, r.name route_name, r.arc, r.season, r.start_date, r.end_date, r.status route_status
                     FROM route_bids rb JOIN routes r ON r.id = rb.route_id
                    WHERE rb.band_id = ? ORDER BY r.start_date`, bandId);
}

const clean = (v: any, allowed: readonly string[], dflt: string) =>
  allowed.includes(String(v)) ? String(v) : dflt;

export function submitBid(routeId: number, bandId: number, input: any): RouteBid {
  ensureRouteBidSchema();
  const scope = input.scope === "dates" ? "dates" : "whole_ring";
  const wants = clean(input.wants_bill, BILL_ASKS, "any");
  const ask = input.ask === "" || input.ask == null ? null : Math.max(0, Math.round(Number(input.ask) || 0));
  const travelAll = input.travel_all == null ? 1 : (input.travel_all ? 1 : 0);
  const from = scope === "dates" ? (input.from_date || null) : null;
  const to = scope === "dates" ? (input.to_date || null) : null;
  const note = input.note || null;

  const existing = getBid(routeId, bandId);
  if (existing) {
    // Re-bidding after a decision puts it back in the pile rather than silently
    // editing an accepted booking out from under the operator.
    const status = ["accepted", "declined"].includes(existing.status) ? "submitted" : existing.status;
    run(`UPDATE route_bids SET scope=?, from_date=?, to_date=?, wants_bill=?, ask=?, travel_all=?,
         note=?, status=? WHERE id=?`,
      scope, from, to, wants, ask, travelAll, note, status, existing.id);
  } else {
    run(`INSERT INTO route_bids(route_id,band_id,scope,from_date,to_date,wants_bill,ask,travel_all,note)
         VALUES(?,?,?,?,?,?,?,?,?)`, routeId, bandId, scope, from, to, wants, ask, travelAll, note);
  }
  return getBid(routeId, bandId)!;
}

export function withdrawBid(routeId: number, bandId: number) {
  ensureRouteBidSchema();
  run("UPDATE route_bids SET status='withdrawn' WHERE route_id=? AND band_id=?", routeId, bandId);
  return getBid(routeId, bandId);
}

export function decideBid(bidId: number, status: string, userId: number, note?: string) {
  ensureRouteBidSchema();
  const s = clean(status, BID_STATUS, "submitted");
  run(`UPDATE route_bids SET status=?, decided_by=?, decided_at=datetime('now'), decision_note=? WHERE id=?`,
    s, userId, note || null, bidId);
  return one<RouteBid>("SELECT * FROM route_bids WHERE id=?", bidId);
}

/** Bids that reach a given stop — what the operator sees on the night. */
export function bidsForStop(routeId: number, stop: { date?: string | null }) {
  return listBidsForRoute(routeId).filter(b => coversStop(b as any, stop));
}
