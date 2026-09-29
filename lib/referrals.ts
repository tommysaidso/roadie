// REFERRALS — a code you share, a month you earn.
//
// The mechanic, exactly as Ben set it:
//
//   * Billing runs in 3-MONTH BLOCKS. You pay for two, the third is free —
//     "buy 2 get the 3rd" — so a block is 3 months of service for 2 months of
//     money. That is the standing offer, not a promotion.
//
//   * A referral only counts WHEN THEY SIGN UP. A click is not a referral, a
//     shared link is not a referral. Money only moves for a conversion, which
//     is also the only version anyone can defend when asked.
//
//   * Each conversion pushes the referrer's CHARGE DATE out by one month. Not
//     a credit sitting in a wallet, not a discount to remember at renewal —
//     the date they next get billed simply moves. The person referred can then
//     refer too, on the same terms.
//
//   * The FOUNDING GROUP is the exception: right now only they carry the full
//     three months free, and Dewey can extend his own testers whenever he likes
//     (see beta levels — free_months is his to set).
//
// Everything here records WHY a month was granted. A free month nobody can
// explain later is indistinguishable from a billing bug.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureReferralSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      label TEXT DEFAULT '',
      -- Founding codes hand out the full three months. Ordinary ones give the
      -- standard block, and a month per conversion like everyone else.
      founding INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- One row per person who arrived on a code. Status tells you whether it
    -- actually counted: a visit is not a signup.
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      referrer_user_id INTEGER NOT NULL,
      invited_email TEXT DEFAULT '',
      referred_user_id INTEGER,
      status TEXT DEFAULT 'pending',    -- pending | signed_up | rejected
      signed_up_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(code, invited_email)
    );

    -- The ledger. Every month granted, to whom, and what earned it.
    CREATE TABLE IF NOT EXISTS month_grants (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      months REAL NOT NULL,
      reason TEXT NOT NULL,             -- referral | block_bonus | founding | manual
      referral_id INTEGER,
      granted_by INTEGER,
      note TEXT DEFAULT '',
      applied_at TEXT,                  -- set once billing has moved the date
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_grants_user ON month_grants(user_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
  `);
  ready = true;
}

/** Billing shape, in one place so nothing has to remember it. */
export const BLOCK_MONTHS = 3;      // you buy in threes
export const BLOCK_PAID_MONTHS = 2; // and pay for two of them
export const REFERRAL_MONTHS = 1;   // each conversion moves the date one month

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no I/O/0/1 — these get read aloud

function mint(seed: string) {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const tag = seed.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "ROAD";
  return `${tag}-${out}`;
}

/**
 * The code for a person. Made once and kept — a referral code that changes is
 * useless the moment it has been shared anywhere.
 */
export function codeFor(userId: number, seed = "ROAD", opts: { founding?: boolean; label?: string } = {}) {
  ensureReferralSchema();
  const existing = one<any>("SELECT * FROM referral_codes WHERE user_id=? AND active=1", userId);
  if (existing) return existing;
  let code = mint(seed);
  for (let i = 0; i < 5 && one<any>("SELECT 1 x FROM referral_codes WHERE code=?", code); i++) code = mint(seed);
  run("INSERT INTO referral_codes(code,user_id,label,founding) VALUES(?,?,?,?)",
    code, userId, String(opts.label || ""), opts.founding ? 1 : 0);
  return one<any>("SELECT * FROM referral_codes WHERE code=?", code);
}

export function codeRow(code: string) {
  ensureReferralSchema();
  return one<any>("SELECT * FROM referral_codes WHERE code=? AND active=1", String(code || "").toUpperCase().trim());
}

/** Someone was sent an invite on a code. Pending until they actually sign up. */
export function recordInvite(code: string, email: string) {
  ensureReferralSchema();
  const c = codeRow(code);
  if (!c) return { error: "That code isn't live." };
  const e = String(email || "").trim().toLowerCase();
  if (!e) return { error: "Need an email." };
  try {
    run("INSERT OR IGNORE INTO referrals(code,referrer_user_id,invited_email) VALUES(?,?,?)",
      c.code, c.user_id, e);
  } catch {}
  return { ok: true };
}

/**
 * A signup happened. THIS is where a referral becomes real and a month moves.
 *
 * Safe to call on every signup — it does nothing unless the address was
 * actually invited on a live code, and it will not pay twice for one person.
 */
export function convert(userId: number, email: string, code?: string) {
  ensureReferralSchema();
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;

  // Prefer the code they arrived with; otherwise find a pending invite.
  let r: any = null;
  if (code) {
    const c = codeRow(code);
    if (c && Number(c.user_id) !== Number(userId)) {    // no referring yourself
      r = one<any>("SELECT * FROM referrals WHERE code=? AND invited_email=?", c.code, e)
        || (run("INSERT INTO referrals(code,referrer_user_id,invited_email) VALUES(?,?,?)", c.code, c.user_id, e),
            one<any>("SELECT * FROM referrals WHERE code=? AND invited_email=?", c.code, e));
    }
  }
  if (!r) r = one<any>("SELECT * FROM referrals WHERE invited_email=? AND status='pending'", e);
  if (!r || r.status === "signed_up") return null;
  if (Number(r.referrer_user_id) === Number(userId)) return null;

  run("UPDATE referrals SET status='signed_up', referred_user_id=?, signed_up_at=datetime('now') WHERE id=?",
    userId, r.id);

  // The referrer's charge date moves out a month.
  run(`INSERT INTO month_grants(user_id,months,reason,referral_id,note)
       VALUES(?,?,'referral',?,?)`,
    r.referrer_user_id, REFERRAL_MONTHS, r.id, `${e} signed up`);

  // And the new arrival starts on the standard block: three months of service
  // for two months of money.
  const c = codeRow(r.code);
  const founding = !!c?.founding;
  run(`INSERT INTO month_grants(user_id,months,reason,note)
       VALUES(?,?,?,?)`,
    userId,
    founding ? BLOCK_MONTHS : BLOCK_MONTHS - BLOCK_PAID_MONTHS,
    founding ? "founding" : "block_bonus",
    founding ? "founding group — first three months on us"
             : "buy 2 get the 3rd — third month of the block free");

  return { referral_id: r.id, referrer_user_id: r.referrer_user_id, founding };
}

/** Months owed to someone that billing has not yet applied. */
export function unappliedMonths(userId: number) {
  ensureReferralSchema();
  const r = one<any>(
    "SELECT COALESCE(SUM(months),0) m FROM month_grants WHERE user_id=? AND applied_at IS NULL", userId);
  return Number(r?.m || 0);
}

export function grantsFor(userId: number) {
  ensureReferralSchema();
  return all<any>("SELECT * FROM month_grants WHERE user_id=? ORDER BY id DESC LIMIT 50", userId);
}

/** Mark grants as applied once the charge date has actually moved. */
export function markApplied(ids: number[]) {
  ensureReferralSchema();
  if (!ids.length) return;
  run(`UPDATE month_grants SET applied_at=datetime('now')
        WHERE id IN (${ids.map(() => "?").join(",")}) AND applied_at IS NULL`, ...ids);
}

/** What a referrer sees: who they brought, and what it earned. */
export function statsFor(userId: number) {
  ensureReferralSchema();
  const code = one<any>("SELECT * FROM referral_codes WHERE user_id=? AND active=1", userId);
  const rows = code
    ? all<any>("SELECT * FROM referrals WHERE code=? ORDER BY id DESC", code.code) : [];
  const signed = rows.filter(r => r.status === "signed_up");
  return {
    code: code?.code || null,
    founding: !!code?.founding,
    invited: rows.length,
    signed_up: signed.length,
    months_earned: signed.length * REFERRAL_MONTHS,
    months_unapplied: unappliedMonths(userId),
    people: rows.map(r => ({
      email: r.invited_email, status: r.status, signed_up_at: r.signed_up_at,
    })),
  };
}

/** Dewey extending his own testers — an explicit, logged, manual grant. */
export function grantMonths(userId: number, months: number, by: number, note = "") {
  ensureReferralSchema();
  const m = Math.max(0, Math.min(24, Number(months) || 0));
  if (!m) return { error: "How many months?" };
  run("INSERT INTO month_grants(user_id,months,reason,granted_by,note) VALUES(?,?,'manual',?,?)",
    userId, m, by, String(note || "").slice(0, 200));
  return { ok: true, months: m, unapplied: unappliedMonths(userId) };
}
