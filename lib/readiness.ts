// "We're ready to play."
//
// A FLAG, not a bid. A bid is an act asking for one specific night. A flag is a
// working act saying: we gig for real, we're here, and if the ring comes within
// this far of us, put us in the round. It stands until they turn it off.
//
// This is what makes the bill fill organically. The touring act is booked; the
// rest of the night is assembled from acts who have flagged themselves nearby —
// so a town with nobody coming still gets a local band on the stage, and a band
// two hours out gets a real gig they'd never have heard about.
import { all, one, run, getDb } from "./db";
import { billFit } from "./genres";

export const BILL_POSITIONS = ["local_host", "opener", "support", "direct_support", "headliner"] as const;
export type BillPosition = typeof BILL_POSITIONS[number];

// ~2 hours of driving. The distance a working act will go for a Friday.
export const DEFAULT_RADIUS_KM = 150;

let ensured = false;
export function ensureReadinessSchema() {
  if (ensured) return;
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS band_readiness (
    id INTEGER PRIMARY KEY,
    band_id INTEGER NOT NULL UNIQUE REFERENCES bands(id),
    active INTEGER DEFAULT 1,
    radius_km INTEGER DEFAULT ${DEFAULT_RADIUS_KM},
    positions TEXT DEFAULT 'local_host,opener,support',
    min_notice_days INTEGER DEFAULT 14,
    blackout TEXT,                       -- comma-separated YYYY-MM-DD the act can't do
    rate_min INTEGER,                    -- overrides bands.rate_min when set
    gig_ready INTEGER DEFAULT 1,         -- the act asserts it plays real, paid shows
    travel_overnight INTEGER DEFAULT 0,  -- will they stay over, or must it be same-night home
    note TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  ensured = true;
}

export type Readiness = {
  band_id: number; active: number; radius_km: number; positions: string;
  min_notice_days: number; blackout: string | null; rate_min: number | null;
  gig_ready: number; travel_overnight: number; note: string | null; updated_at?: string;
};

export function getReadiness(bandId: number): Readiness | null {
  ensureReadinessSchema();
  return one<Readiness>("SELECT * FROM band_readiness WHERE band_id=?", bandId) || null;
}

const clampInt = (v: any, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

export function setReadiness(bandId: number, patch: Partial<Readiness>): Readiness {
  ensureReadinessSchema();
  const cur = getReadiness(bandId);
  const positions = (String(patch.positions ?? cur?.positions ?? "local_host,opener,support")
    .split(",").map(s => s.trim()).filter(p => (BILL_POSITIONS as readonly string[]).includes(p)));
  const next = {
    active: patch.active != null ? (patch.active ? 1 : 0) : (cur?.active ?? 1),
    // 25km floor stops a "we only play our own block" flag; 600 ceiling stops
    // an act flagging the whole province and swamping every stop's shortlist.
    radius_km: clampInt(patch.radius_km ?? cur?.radius_km, 25, 600, DEFAULT_RADIUS_KM),
    positions: (positions.length ? positions : ["support"]).join(","),
    min_notice_days: clampInt(patch.min_notice_days ?? cur?.min_notice_days, 0, 180, 14),
    blackout: patch.blackout !== undefined ? (patch.blackout || null) : (cur?.blackout ?? null),
    rate_min: patch.rate_min !== undefined
      ? (patch.rate_min === null || patch.rate_min === ("" as any) ? null : clampInt(patch.rate_min, 0, 100000, 0))
      : (cur?.rate_min ?? null),
    gig_ready: patch.gig_ready != null ? (patch.gig_ready ? 1 : 0) : (cur?.gig_ready ?? 1),
    travel_overnight: patch.travel_overnight != null ? (patch.travel_overnight ? 1 : 0) : (cur?.travel_overnight ?? 0),
    note: patch.note !== undefined ? (patch.note || null) : (cur?.note ?? null),
  };
  if (cur) {
    run(`UPDATE band_readiness SET active=?, radius_km=?, positions=?, min_notice_days=?, blackout=?,
         rate_min=?, gig_ready=?, travel_overnight=?, note=?, updated_at=datetime('now') WHERE band_id=?`,
      next.active, next.radius_km, next.positions, next.min_notice_days, next.blackout,
      next.rate_min, next.gig_ready, next.travel_overnight, next.note, bandId);
  } else {
    run(`INSERT INTO band_readiness(band_id,active,radius_km,positions,min_notice_days,blackout,
         rate_min,gig_ready,travel_overnight,note) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      bandId, next.active, next.radius_km, next.positions, next.min_notice_days, next.blackout,
      next.rate_min, next.gig_ready, next.travel_overnight, next.note);
  }
  return getReadiness(bandId)!;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type Candidate = {
  band: any; km: number; score: number; position: BillPosition | null;
  reasons: string[]; blocked?: string;
};

/**
 * Who is available to fill the rest of a bill.
 *
 * Hard gates first — a candidate is dropped, not down-ranked, when it fails
 * one, because a shortlist you have to hand-filter is not a shortlist:
 *   · flag off, or not gig-ready
 *   · outside their own stated radius (their call, not ours)
 *   · date inside a blackout, or inside their notice window
 *   · genre distant from the headliner (unless the night allows a blend)
 *   · it's the headliner itself
 *
 * Then ranked: local acts first — the whole point is the hometown band on the
 * stage — then genre closeness, then draw, then how far they'd travel.
 */
export function candidatesForStop(opts: {
  lat: number; lng: number; date?: string | null; headlinerGenres?: string | null;
  headlinerBandId?: number | null; allowBlend?: boolean; position?: BillPosition; limit?: number;
}): Candidate[] {
  ensureReadinessSchema();
  const { lat, lng, date, headlinerGenres, headlinerBandId, allowBlend = false, position, limit = 25 } = opts;

  const rows = all<any>(`SELECT b.*, r.radius_km, r.positions, r.min_notice_days, r.blackout,
                                r.rate_min AS ready_rate_min, r.gig_ready, r.travel_overnight, r.note AS ready_note
                           FROM band_readiness r JOIN bands b ON b.id = r.band_id
                          WHERE r.active = 1`);

  const today = new Date();
  const showDate = date ? new Date(date) : null;
  const daysOut = showDate ? Math.round((showDate.getTime() - today.getTime()) / 86400000) : null;

  const out: Candidate[] = [];
  for (const b of rows) {
    if (headlinerBandId && Number(b.id) === Number(headlinerBandId)) continue;
    if (!b.gig_ready) continue;
    if (b.lat == null || b.lng == null) continue;

    const km = Math.round(haversineKm([lat, lng], [Number(b.lat), Number(b.lng)]));
    const radius = Number(b.radius_km || DEFAULT_RADIUS_KM);
    if (km > radius) continue;

    if (position && !String(b.positions || "").split(",").includes(position)) continue;
    if (date && String(b.blackout || "").split(",").map((s: string) => s.trim()).includes(String(date).slice(0, 10))) continue;
    if (daysOut != null && daysOut >= 0 && daysOut < Number(b.min_notice_days || 0)) continue;

    const fit = billFit(headlinerGenres || "", b.genres || b.genre || "");
    if (fit.verdict === "distant" && !allowBlend) continue;

    const reasons: string[] = [];
    let score = 0;

    // Hometown first — that is the point of the local slot.
    if (km <= 40) { score += 0.35; reasons.push(`hometown (${km}km)`); }
    else if (km <= 100) { score += 0.25; reasons.push(`local (${km}km)`); }
    else { score += 0.15; reasons.push(`${km}km out — inside their ${radius}km flag`); }

    score += fit.score * 0.35;
    reasons.push(fit.why);

    if (b.draw) { score += Math.min(0.15, Number(b.draw) / 2000); reasons.push(`draws ~${b.draw}`); }
    if (b.travel_overnight) { score += 0.05; reasons.push("will stay over"); }
    if (b.user_id) { score += 0.05; reasons.push("claimed profile"); }
    if (String(b.verification_status || "") === "verified") { score += 0.05; reasons.push("verified"); }

    const wants = String(b.positions || "").split(",").filter(Boolean) as BillPosition[];
    out.push({
      band: b, km, score: Math.min(1, Number(score.toFixed(2))),
      position: position || wants[0] || null, reasons,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.km - b.km).slice(0, limit);
}
