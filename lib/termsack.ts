/**
 * Platform terms acknowledgement — bands and artists.
 *
 * The mymymy side auto-applies its disclaimer at signup and stamps the version.
 * ROADIE is where the rights-holders actually live and work, so here we ask for
 * an explicit acknowledgement instead of assuming it: a band or artist confirms
 * they have read the terms, and we record WHO, WHEN and WHICH VERSION.
 *
 * Why explicit here and automatic there: mymymy has no signup form to attach a
 * checkbox to — accounts appear on first login. ROADIE has a real session and a
 * real profile, so an acknowledgement is both possible and worth having. A
 * platform that asks people to put their catalogue on it should be able to say
 * exactly what each rights-holder agreed to and when.
 *
 * Scope note: this is the PLATFORM terms. The Ring Contractor Agreement is a
 * separate document, per ring, tracked in lib/agreements.ts — do not conflate
 * the two. Acknowledging the platform terms does not commit anyone to a ring.
 *
 * Fans, venues, sponsors and crew are covered by the same general terms but are
 * not prompted: they are not putting a catalogue at risk, and nagging everyone
 * devalues the prompt for the people it matters for.
 */
import { getDb } from "./db";

/** Must match the published terms. Bump together. */
export const PLATFORM_TERMS_VERSION = "2026-08-draft-1";

/** Account kinds we ask to acknowledge. */
export const ACK_KINDS = ["band", "artist"] as const;

let ready = false;

export function ensureTermsAckSchema() {
  if (ready) return;
  const db = getDb();
  // Guarded ALTERs — CREATE TABLE IF NOT EXISTS never adds a column to an
  // existing table, and this app has no migration framework.
  for (const col of [
    "terms_ack_at TEXT",
    "terms_ack_version TEXT",
    "terms_ack_name TEXT",     // what they typed as their name when confirming
    "terms_ack_source TEXT",   // self | operator_backfill
  ]) {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* exists */ }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS terms_ack_log (
      id         INTEGER PRIMARY KEY,
      user_id    INTEGER,
      email      TEXT,
      version    TEXT,
      typed_name TEXT DEFAULT '',
      source     TEXT DEFAULT 'self',
      note       TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  ready = true;
}

/**
 * Record an acknowledgement.
 *
 * The log is append-only and keeps every acknowledgement, including ones
 * against superseded versions. The column on `users` holds the latest. Both
 * matter: the column answers "are they current", the log answers "what did they
 * agree to in March".
 */
export function recordAck(a: {
  userId: number; email: string; typedName?: string;
  source?: "self" | "operator_backfill"; note?: string;
}) {
  ensureTermsAckSchema();
  const db = getDb();
  const src = a.source || "self";
  db.prepare(
    `UPDATE users
        SET terms_ack_at=datetime('now'), terms_ack_version=?,
            terms_ack_name=?, terms_ack_source=?
      WHERE id=?`
  ).run(PLATFORM_TERMS_VERSION, a.typedName || "", src, a.userId);
  db.prepare(
    `INSERT INTO terms_ack_log (user_id, email, version, typed_name, source, note)
     VALUES (?,?,?,?,?,?)`
  ).run(a.userId, a.email || "", PLATFORM_TERMS_VERSION,
        a.typedName || "", src, a.note || "");
  return ackState(a.userId);
}

export function ackState(userId: number) {
  ensureTermsAckSchema();
  const u = getDb().prepare(
    `SELECT id, email, role, band_id, terms_ack_at, terms_ack_version,
            terms_ack_name, terms_ack_source
       FROM users WHERE id=?`
  ).get(userId) as any;
  if (!u) return null;
  return {
    acknowledged: !!u.terms_ack_at,
    at: u.terms_ack_at || null,
    version: u.terms_ack_version || null,
    name: u.terms_ack_name || "",
    source: u.terms_ack_source || null,
    current_version: PLATFORM_TERMS_VERSION,
    // A revised document invalidates the old acknowledgement — they agreed to
    // different words. Surfaced, never auto-carried forward.
    outdated: !!u.terms_ack_at && u.terms_ack_version !== PLATFORM_TERMS_VERSION,
  };
}

/** Should this account be prompted? */
export function needsAck(user: any, activeKind?: string | null) {
  if (!user) return false;
  const kind = String(activeKind || "").toLowerCase();
  const isRightsHolder =
    (ACK_KINDS as readonly string[]).includes(kind) || !!user.band_id;
  if (!isRightsHolder) return false;
  const st = ackState(Number(user.id));
  return !st || !st.acknowledged || st.outdated;
}

/** Operator view: who has, who has not. */
export function ackRoster() {
  ensureTermsAckSchema();
  return getDb().prepare(
    `SELECT u.id, u.email, u.role, u.band_id, b.name AS band_name,
            u.terms_ack_at, u.terms_ack_version, u.terms_ack_source
       FROM users u
       LEFT JOIN bands b ON b.id = u.band_id
      WHERE u.band_id IS NOT NULL OR u.role IN ('band','artist')
      ORDER BY (u.terms_ack_at IS NULL) DESC, u.email`
  ).all() as any[];
}
