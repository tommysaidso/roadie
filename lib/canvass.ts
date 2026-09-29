// Canvassing / outreach — the admin/dev-team surface for working an area.
//
// One shared dataset feeds LocalJams AND ROADIE. Canvassing an area = reach out
// to local businesses, track it, and (floor goal) sign them up to JamPoints —
// which is free: they just give a discount. A JamPoints signup is simply a
// standing `vendor_offers` row (built-but-off elsewhere); the loyalty + tracking
// ride the existing vendor_offer_redemptions. See
// [jampoints-canvassing-loyalty-doctrine].
import { getDb, all, one, run } from "./db";

let ensured = false;
export function ensureCanvassSchema() {
  if (ensured) return;
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS outreach (
    id INTEGER PRIMARY KEY,
    hub_id INTEGER,
    business_name TEXT NOT NULL,
    city TEXT, region TEXT,
    venue_id INTEGER,                 -- links to a known room when the target is one
    email TEXT, contact TEXT,
    status TEXT DEFAULT 'target',     -- target | contacted | interested | signed | declined
    channel TEXT,                     -- door | email | phone | event
    note TEXT,
    assigned_to TEXT,
    offer_id INTEGER,                 -- vendor_offers.id once signed to JamPoints
    contacted_at TEXT, signed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  ensured = true;
}

export type OutreachRow = {
  id?: number; hub_id?: number|null; business_name: string; city?: string|null;
  region?: string|null; venue_id?: number|null; email?: string|null; contact?: string|null;
  status: string; channel?: string|null; note?: string|null; assigned_to?: string|null;
  offer_id?: number|null; contacted_at?: string|null; signed_at?: string|null;
};

// Targets for an area = outreach rows already logged, PLUS unclaimed rooms
// ('sample') in that hub not yet on the list, surfaced as implicit targets so
// the team can start working them. One list, no double entry.
export function listArea(hubId: number) {
  ensureCanvassSchema();
  const rows = all<any>("SELECT * FROM outreach WHERE hub_id=? ORDER BY status='signed' DESC, updated_at DESC", hubId);
  const haveVenue = new Set(rows.filter(r => r.venue_id).map(r => Number(r.venue_id)));
  let venues: any[] = [];
  try {
    venues = all<any>(
      "SELECT id,name,city,region,contact FROM venues WHERE hub_id=? AND (member_status='sample' OR user_id IS NULL) ORDER BY city,name",
      hubId);
  } catch { venues = []; }
  const implicit = venues
    .filter(v => !haveVenue.has(Number(v.id)))
    .map(v => ({ id: null, hub_id: hubId, business_name: v.name, city: v.city, region: v.region,
      venue_id: v.id, email: null, contact: v.contact, status: "target", note: null, offer_id: null } as OutreachRow));
  return { logged: rows as OutreachRow[], targets: implicit };
}

export function saveOutreach(o: OutreachRow): number {
  ensureCanvassSchema();
  const now = new Date().toISOString();
  const contactedAt = (o.status && o.status !== "target") ? (o.contacted_at || now) : o.contacted_at || null;
  if (o.id) {
    run(`UPDATE outreach SET business_name=?, city=?, region=?, venue_id=?, email=?, contact=?,
         status=?, channel=?, note=?, assigned_to=?, contacted_at=COALESCE(contacted_at,?), updated_at=?
         WHERE id=?`,
      o.business_name, o.city ?? null, o.region ?? null, o.venue_id ?? null, o.email ?? null, o.contact ?? null,
      o.status, o.channel ?? null, o.note ?? null, o.assigned_to ?? null, contactedAt, now, o.id);
    return o.id;
  }
  run(`INSERT INTO outreach(hub_id,business_name,city,region,venue_id,email,contact,status,channel,note,assigned_to,contacted_at,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    o.hub_id ?? null, o.business_name, o.city ?? null, o.region ?? null, o.venue_id ?? null,
    o.email ?? null, o.contact ?? null, o.status || "target", o.channel ?? null, o.note ?? null,
    o.assigned_to ?? null, contactedAt, now, now);
  return one<any>("SELECT last_insert_rowid() id")!.id;
}

// Sign a business up to JamPoints: free, they set the discount %. That is a
// standing vendor_offers row; tracking rides vendor_offer_redemptions.
export function signupJamPoints(args: {
  outreachId?: number; hub_id?: number|null; business_name: string; city?: string|null;
  region?: string|null; discountPct: number; title?: string|null; terms?: string|null;
  scope?: string; email?: string|null; contact?: string|null; created_by?: number|null;
}): { offer_id: number; outreach_id: number } {
  ensureCanvassSchema();
  const now = new Date().toISOString();
  const title = args.title || `${args.discountPct}% off for the JamPoints community`;
  run(`INSERT INTO vendor_offers(business_name,city,region,scope,for_bands,for_fans,kind,value,currency,title,terms,active,created_by,created_at)
       VALUES(?,?,?,?,1,1,'percent',?,?,?,?,1,?,?)`,
    args.business_name, args.city ?? null, args.region ?? null, args.scope || "city",
    Math.max(0, Math.round(args.discountPct)), "CAD", title, args.terms ?? null, args.created_by ?? null, now);
  const offer_id = one<any>("SELECT last_insert_rowid() id")!.id;
  let outreach_id = args.outreachId || 0;
  if (outreach_id) {
    run(`UPDATE outreach SET status='signed', offer_id=?, signed_at=?, updated_at=? WHERE id=?`,
      offer_id, now, now, outreach_id);
  } else {
    run(`INSERT INTO outreach(hub_id,business_name,city,region,email,contact,status,offer_id,contacted_at,signed_at,created_at,updated_at)
         VALUES(?,?,?,?,?,?, 'signed', ?, ?, ?, ?, ?)`,
      args.hub_id ?? null, args.business_name, args.city ?? null, args.region ?? null,
      args.email ?? null, args.contact ?? null, offer_id, now, now, now, now);
    outreach_id = one<any>("SELECT last_insert_rowid() id")!.id;
  }
  return { offer_id, outreach_id };
}

// The measurement the fine print promises: redemptions per signed business.
export function liftFor(offerId: number) {
  try {
    return one<any>("SELECT COUNT(*) redemptions, MAX(redeemed_at) last FROM vendor_offer_redemptions WHERE offer_id=?", offerId)
      || { redemptions: 0, last: null };
  } catch { return { redemptions: 0, last: null }; }
}
