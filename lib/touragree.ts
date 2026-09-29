/**
 * Tour agreement acknowledgement — the gate on "ready to play".
 *
 * Ticking "available to tour" is an act with money behind it: it puts the act
 * into ring routing and host bidding, where the next thing that happens is
 * someone offers them dates. So the terms of that engagement have to be seen
 * BEFORE the flag goes on, not produced afterwards when a date is already
 * penciled.
 *
 * TURNING IT OFF IS NEVER GATED. An act that wants out gets out immediately —
 * making someone agree to something in order to stop being available would be
 * coercive and is the opposite of the point.
 *
 * WHAT THIS IS NOT: not a signature, and it does not execute the contract. It
 * records that the act read the terms and accepted them as the basis for
 * touring. Real execution is the band entity plus every member, on paper, after
 * legal review — see lib/agreements.ts for the per-ring tracking.
 *
 * DEVELOPMENT STATUS is recorded with the acknowledgement on purpose. These are
 * base template terms during build-out and they will change. Storing the
 * version against each acceptance is what lets us tell an act exactly what they
 * agreed to and alert them when it moves — rather than quietly swapping the
 * document under people who already said yes.
 */
import { getDb } from "./db";

/** Bump when the ring contract text changes. Keep in step with the document. */
export const TOUR_TERMS_VERSION = "2026-08-draft-1";

/** Base guarantee per SHOW, per ACT — see note below. */
export const BASE_GUARANTEE_CAD = 3000;

let ready = false;

export function ensureTourAgreeSchema() {
  if (ready) return;
  const db = getDb();
  for (const col of [
    "tour_terms_at TEXT",
    "tour_terms_version TEXT",
    "tour_terms_name TEXT",
    "tour_terms_by TEXT",     // account email that accepted, for attribution
  ]) {
    try { db.exec(`ALTER TABLE band_readiness ADD COLUMN ${col}`); } catch { /* exists */ }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS tour_terms_log (
      id         INTEGER PRIMARY KEY,
      band_id    INTEGER REFERENCES bands(id),
      version    TEXT,
      typed_name TEXT DEFAULT '',
      by_email   TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  ready = true;
}

export function tourAgreeState(bandId: number) {
  ensureTourAgreeSchema();
  const r = getDb().prepare(
    `SELECT tour_terms_at, tour_terms_version, tour_terms_name
       FROM band_readiness WHERE band_id=?`
  ).get(bandId) as any;
  const at = r?.tour_terms_at || null;
  const version = r?.tour_terms_version || null;
  return {
    accepted: !!at,
    at, version,
    name: r?.tour_terms_name || "",
    current_version: TOUR_TERMS_VERSION,
    // A revised contract is different words. The act agreed to the old ones,
    // so this surfaces rather than silently carrying forward.
    outdated: !!at && version !== TOUR_TERMS_VERSION,
    base_guarantee_cad: BASE_GUARANTEE_CAD,
  };
}

/** May this band switch availability ON right now? */
export function canGoAvailable(bandId: number) {
  const st = tourAgreeState(bandId);
  return { ok: st.accepted && !st.outdated, state: st };
}

export function acceptTourTerms(a: {
  bandId: number; typedName: string; byEmail: string;
}) {
  ensureTourAgreeSchema();
  const db = getDb();
  // The row may not exist yet — an act can accept the terms before ever having
  // saved readiness settings.
  db.prepare(
    `INSERT INTO band_readiness (band_id, active) VALUES (?, 0)
     ON CONFLICT(band_id) DO NOTHING`
  ).run(a.bandId);
  db.prepare(
    `UPDATE band_readiness
        SET tour_terms_at=datetime('now'), tour_terms_version=?,
            tour_terms_name=?, tour_terms_by=?, updated_at=datetime('now')
      WHERE band_id=?`
  ).run(TOUR_TERMS_VERSION, a.typedName || "", a.byEmail || "", a.bandId);
  db.prepare(
    `INSERT INTO tour_terms_log (band_id, version, typed_name, by_email)
     VALUES (?,?,?,?)`
  ).run(a.bandId, TOUR_TERMS_VERSION, a.typedName || "", a.byEmail || "");
  return tourAgreeState(a.bandId);
}

/** Acts on old terms — who to alert when the document moves. */
export function actsOnOutdatedTerms() {
  ensureTourAgreeSchema();
  return getDb().prepare(
    `SELECT r.band_id, b.name AS band_name, r.active,
            r.tour_terms_version, r.tour_terms_at
       FROM band_readiness r
       LEFT JOIN bands b ON b.id = r.band_id
      WHERE r.tour_terms_at IS NOT NULL AND r.tour_terms_version <> ?
      ORDER BY b.name`
  ).all(TOUR_TERMS_VERSION) as any[];
}
