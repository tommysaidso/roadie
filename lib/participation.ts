import { getDb, one } from "./db";

// The participation model — "we scraped, you claim, you're in free.
// The TOOLS are what cost — and only once the system provably pays you."
//
//  1. Join/claim free. Claiming (or creating) a band/venue/sponsor starts a
//     3-month full-tools trial (trial_started_at).
//  2. We track PLATFORM-ATTRIBUTED revenue: guarantees on confirmed+ bookings
//     made through ROADIE, trailing 90 days, per band and per venue.
//  3. When the trial is over AND trailing-90d platform revenue clears the
//     threshold, participation membership kicks in. Below threshold, you ride
//     free — we only charge people the system is demonstrably paying.
//  4. Soft enforcement first: `required=true` drives banners/nudges in the UI,
//     not a hard lockout. Flip PARTICIPATION_ENFORCE=1 later to gate tools.
//
//  Currency: CAD for Canadian members, USD for US members.
//  Threshold: $1,000 CAD / ~$730 USD (same purchasing power, different label).

export const TRIAL_DAYS       = Number(process.env.PARTICIPATION_TRIAL_DAYS    || 90);
export const THRESHOLD_CAD    = Number(process.env.PARTICIPATION_THRESHOLD_CAD  || 1000);
export const THRESHOLD_USD    = Number(process.env.PARTICIPATION_THRESHOLD_USD  || 730);
export const ENFORCE          = process.env.PARTICIPATION_ENFORCE === "1";

// Rough CAD→USD rate for display only — not used for gate math.
const CAD_TO_USD = 0.73;

export function ensureParticipationSchema() {
  const db = getDb();
  for (const t of ["bands", "venues", "sponsors"]) {
    try { db.exec(`ALTER TABLE ${t} ADD COLUMN trial_started_at TEXT`); } catch {}
    try { db.exec(`ALTER TABLE ${t} ADD COLUMN participation_status TEXT DEFAULT 'free'`); } catch {}
    try { db.exec(`ALTER TABLE ${t} ADD COLUMN country TEXT DEFAULT 'CA'`); } catch {}
    // free | trial | required | member
  }
  // bookings needs a currency column for US guarantees
  try { db.exec(`ALTER TABLE bookings ADD COLUMN currency TEXT DEFAULT 'CAD'`); } catch {}
}

export function startTrial(kind: "band" | "venue" | "sponsor", id: number) {
  ensureParticipationSchema();
  const table = kind === "band" ? "bands" : kind === "venue" ? "venues" : "sponsors";
  getDb().prepare(`UPDATE ${table} SET trial_started_at=COALESCE(trial_started_at, datetime('now')),
    participation_status=CASE WHEN participation_status='free' THEN 'trial' ELSE participation_status END
    WHERE id=?`).run(id);
}

// Returns revenue in the member's native currency (CAD for CA, USD for US).
function revenue90d(kind: "band" | "venue", id: number, country = "CA"): number {
  const col = kind === "band" ? "band_id" : "venue_id";
  const currency = country === "US" ? "USD" : "CAD";
  const row = one<any>(
    `SELECT COALESCE(SUM(guarantee),0) v FROM bookings
     WHERE ${col}=? AND currency=? AND status IN ('confirmed','contract_sent','signed','settled')
     AND date >= date('now','-90 days')`,
    id, currency
  );
  return Number(row?.v || 0);
}

export function participationStatus(kind: "band" | "venue" | "sponsor", id: number) {
  ensureParticipationSchema();
  const table = kind === "band" ? "bands" : kind === "venue" ? "venues" : "sponsors";
  const rec = one<any>(`SELECT id, trial_started_at, participation_status, country FROM ${table} WHERE id=?`, id);
  if (!rec) return null;

  const country   = rec.country || "CA";
  const isUS      = country === "US";
  const threshold = isUS ? THRESHOLD_USD : THRESHOLD_CAD;
  const currLabel = isUS ? "USD" : "CAD";

  let trialDaysLeft: number | null = null;
  if (rec.trial_started_at) {
    const elapsed = (Date.now() - new Date(rec.trial_started_at + "Z").getTime()) / 86400000;
    trialDaysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
  }

  const rev         = kind === "sponsor" ? 0 : revenue90d(kind, id, country);
  const inTrial     = trialDaysLeft !== null && trialDaysLeft > 0;
  const overThreshold = rev >= threshold;
  const isMember    = rec.participation_status === "member";
  const required    = !isMember && !inTrial && overThreshold;

  const fmtRev = rev.toLocaleString("en-CA", { style: "currency", currency: currLabel });
  const fmtThr = threshold.toLocaleString("en-CA");

  return {
    kind, id, country, currency: currLabel,
    status: isMember ? "member" : inTrial ? "trial" : required ? "required" : "free",
    trial_days_left: trialDaysLeft,
    trial_days_total: TRIAL_DAYS,
    platform_revenue_90d: rev,
    threshold,
    required,
    enforce: ENFORCE,
    pitch: required
      ? `ROADIE has put ${fmtRev} in your pocket in the last 90 days. Time to lock in a participation membership — it's a business expense, typically tax-deductible (ask your accountant).`
      : inTrial
      ? `Full tools free for ${trialDaysLeft} more days. Get gigging.`
      : `You're riding free. Membership only kicks in once ROADIE books you past $${fmtThr} ${currLabel} per 90 days — until then, everything essential stays free.`,
  };
}
