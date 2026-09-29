/**
 * Ring Contractor Agreement — INTENT AND STATUS TRACKING.
 *
 * WHAT THIS IS NOT: this is not e-signature capture, and nothing here executes
 * a contract. The Ring Contractor Agreement is a real contract — guaranteed
 * pay, likeness rights, sync licence, advertiser buyout — and it is signed on
 * paper or through a proper e-sign service after legal review, by the band as
 * an entity AND by each individual member.
 *
 * WHAT THIS IS: the operator's answer to "is this band good to go?" It records
 * that the terms were sent, who on the band has read and confirmed intent, and
 * whether the band is clear to be routed onto a ring. An `acknowledged` row
 * means "they have read it and intend to proceed" — it is deliberately NOT
 * called `signed`, because calling it that would make an operator believe
 * something has legal force when it does not.
 *
 * Per-member rows exist because likeness and performance consent belong to each
 * human, not to a band name — so the readiness view has to show which members
 * are still outstanding, the same way the real signature block does.
 *
 * Bands can also file recommendations against a version. The terms are expected
 * to be revised after legal review (~3 months), and band feedback is the input
 * to that review rather than something to be argued with over email.
 *
 * Schema follows the sponsor_offers pattern in lib/studio.ts — status lifecycle,
 * unique share token, sent_at/decided_at.
 */
import { getDb } from "./db";

/** Must match the published terms document version. */
export const RING_TERMS_VERSION = "2026-08-draft-1";

export type AgreementStatus =
  | "draft"          // created, not yet sent to the band
  | "sent"           // band has the terms
  | "reviewing"      // band is reading / has questions or recommendations
  | "acknowledged"   // band + all members confirmed intent -- NOT signed
  | "declined";      // band passed

let ready = false;

export function ensureAgreementSchema() {
  if (ready) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ring_agreements (
      id            INTEGER PRIMARY KEY,
      route_id      INTEGER REFERENCES routes(id),
      band_id       INTEGER REFERENCES bands(id),
      band_name     TEXT DEFAULT '',      -- flat, so it survives a deleted band
      version       TEXT NOT NULL,
      status        TEXT DEFAULT 'draft', -- draft|sent|reviewing|acknowledged|declined
      token         TEXT,                 -- share slug; band opens without an account
      sent_at       TEXT,
      decided_at    TEXT,
      notes         TEXT DEFAULT '',
      created_by    TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(route_id, band_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ring_agreements_token
      ON ring_agreements(token);

    -- One row per touring member. "acknowledged" = read + intends to proceed.
    -- NOT a signature. The real signature block is on the executed paper.
    CREATE TABLE IF NOT EXISTS ring_agreement_acks (
      id              INTEGER PRIMARY KEY,
      agreement_id    INTEGER REFERENCES ring_agreements(id),
      band_member_id  INTEGER REFERENCES band_members(id),
      email           TEXT DEFAULT '',
      name            TEXT DEFAULT '',
      role            TEXT DEFAULT 'member',  -- controller | member
      acknowledged_at TEXT,
      note            TEXT DEFAULT '',
      UNIQUE(agreement_id, email)
    );

    -- Band recommendations on the terms. Feeds the post-legal-review revision.
    CREATE TABLE IF NOT EXISTS ring_agreement_feedback (
      id           INTEGER PRIMARY KEY,
      agreement_id INTEGER REFERENCES ring_agreements(id),
      band_id      INTEGER REFERENCES bands(id),
      version      TEXT DEFAULT '',
      section      TEXT DEFAULT '',   -- which clause, free text
      body         TEXT NOT NULL,
      author_email TEXT DEFAULT '',
      author_name  TEXT DEFAULT '',
      status       TEXT DEFAULT 'new', -- new | reviewed | actioned | declined
      response     TEXT DEFAULT '',
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  ready = true;
}

function token() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

/** Create (or fetch) the agreement record for a band on a ring. */
export function openAgreement(routeId: number, bandId: number, bandName: string, by = "") {
  ensureAgreementSchema();
  const db = getDb();
  const existing = db.prepare(
    `SELECT * FROM ring_agreements WHERE route_id=? AND band_id=?`
  ).get(routeId, bandId) as any;
  if (existing) return existing;

  db.prepare(
    `INSERT INTO ring_agreements (route_id, band_id, band_name, version, status, token, created_by)
     VALUES (?,?,?,?,'draft',?,?)`
  ).run(routeId, bandId, bandName || "", RING_TERMS_VERSION, token(), by);

  return db.prepare(
    `SELECT * FROM ring_agreements WHERE route_id=? AND band_id=?`
  ).get(routeId, bandId) as any;
}

/**
 * Seed one ack row per touring member, so the readiness view shows who is
 * outstanding rather than just a single band-level flag.
 */
export function seedMemberAcks(agreementId: number, bandId: number) {
  ensureAgreementSchema();
  const db = getDb();
  const members = db.prepare(
    `SELECT id, email, name, role FROM band_members
      WHERE band_id=? AND status IN ('active','invited')`
  ).all(bandId) as any[];

  const ins = db.prepare(
    `INSERT OR IGNORE INTO ring_agreement_acks
       (agreement_id, band_member_id, email, name, role)
     VALUES (?,?,?,?,?)`
  );
  for (const m of members) {
    ins.run(agreementId, m.id, m.email || "", m.name || "", m.role || "member");
  }
  return members.length;
}

export function markSent(agreementId: number) {
  ensureAgreementSchema();
  getDb().prepare(
    `UPDATE ring_agreements
        SET status='sent', sent_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?`
  ).run(agreementId);
}

/** A member confirms they have read the terms and intend to proceed. */
export function acknowledge(agreementId: number, email: string, note = "") {
  ensureAgreementSchema();
  const db = getDb();
  db.prepare(
    `UPDATE ring_agreement_acks
        SET acknowledged_at=datetime('now'), note=?
      WHERE agreement_id=? AND lower(email)=lower(?)`
  ).run(note, agreementId, email);

  // Band is only "acknowledged" once every seeded member has confirmed —
  // a partial band is not good to go.
  const row = db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) AS done
       FROM ring_agreement_acks WHERE agreement_id=?`
  ).get(agreementId) as any;

  if (row && row.total > 0 && row.done === row.total) {
    db.prepare(
      `UPDATE ring_agreements
          SET status='acknowledged', decided_at=datetime('now'), updated_at=datetime('now')
        WHERE id=?`
    ).run(agreementId);
  } else {
    db.prepare(
      `UPDATE ring_agreements
          SET status='reviewing', updated_at=datetime('now')
        WHERE id=? AND status IN ('sent','draft')`
    ).run(agreementId);
  }
  return row;
}

export function decline(agreementId: number, why = "") {
  ensureAgreementSchema();
  getDb().prepare(
    `UPDATE ring_agreements
        SET status='declined', decided_at=datetime('now'),
            notes=?, updated_at=datetime('now')
      WHERE id=?`
  ).run(why, agreementId);
}

/** File a band recommendation against the terms. */
export function addFeedback(a: {
  agreementId?: number; bandId?: number; section?: string;
  body: string; email?: string; name?: string;
}) {
  ensureAgreementSchema();
  getDb().prepare(
    `INSERT INTO ring_agreement_feedback
       (agreement_id, band_id, version, section, body, author_email, author_name)
     VALUES (?,?,?,?,?,?,?)`
  ).run(a.agreementId ?? null, a.bandId ?? null, RING_TERMS_VERSION,
        a.section || "", a.body, a.email || "", a.name || "");
}

/** Everything the operator console needs, per ring. */
export function agreementsForRoute(routeId: number) {
  ensureAgreementSchema();
  const db = getDb();
  const rows = db.prepare(
    `SELECT a.*,
            (SELECT COUNT(*) FROM ring_agreement_acks k WHERE k.agreement_id=a.id) AS members,
            (SELECT COUNT(*) FROM ring_agreement_acks k
              WHERE k.agreement_id=a.id AND k.acknowledged_at IS NOT NULL) AS members_ack,
            (SELECT COUNT(*) FROM ring_agreement_feedback f
              WHERE f.agreement_id=a.id AND f.status='new') AS open_feedback
       FROM ring_agreements a
      WHERE a.route_id=?
      ORDER BY a.band_name`
  ).all(routeId) as any[];

  for (const r of rows) {
    r.outstanding = db.prepare(
      `SELECT name, email, role FROM ring_agreement_acks
        WHERE agreement_id=? AND acknowledged_at IS NULL ORDER BY role DESC, name`
    ).all(r.id);
    // Good to go = every member confirmed intent AND the version they were sent
    // is still the current one. A revised document invalidates the readiness.
    r.good_to_go = r.status === "acknowledged" && r.version === RING_TERMS_VERSION;
    r.stale_version = r.version !== RING_TERMS_VERSION;
  }
  return rows;
}

export function feedbackForRoute(routeId: number) {
  ensureAgreementSchema();
  return getDb().prepare(
    `SELECT f.*, a.band_name
       FROM ring_agreement_feedback f
       LEFT JOIN ring_agreements a ON a.id = f.agreement_id
      WHERE a.route_id = ? OR f.agreement_id IS NULL
      ORDER BY f.created_at DESC`
  ).all(routeId) as any[];
}
