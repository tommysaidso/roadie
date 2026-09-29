import { one, run, getDb } from "./db";

// Vendor (pros-table) self-onboarding + participation.
// Vendors ride the same "free, then earn-to-pay" model as bands/venues:
// a 90-day full trial from onboarding, and a $1,000 CAD / 90-day threshold.
// Vendor revenue attribution (rentals/clinics) isn't wired yet, so vendors
// stay free past trial until that signal exists — the clock still runs.
export const VENDOR_TRIAL_DAYS = Number(process.env.PARTICIPATION_TRIAL_DAYS || 90);
export const VENDOR_THRESHOLD_CAD = Number(process.env.PARTICIPATION_THRESHOLD_CAD || 1000);

export function ensureVendorSchema() {
  const db = getDb();
  const cols: [string, string][] = [
    ["phone", "TEXT"], ["address", "TEXT"], ["hours", "TEXT"], ["website", "TEXT"],
    ["year_est", "TEXT"], ["services", "TEXT"], ["onboard_token", "TEXT"],
    ["onboard_done_at", "TEXT"], ["trial_started_at", "TEXT"],
    ["participation_status", "TEXT DEFAULT 'free'"],
  ];
  for (const [c, d] of cols) { try { db.exec(`ALTER TABLE pros ADD COLUMN ${c} ${d}`); } catch {} }
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS pro_clients(
      id INTEGER PRIMARY KEY AUTOINCREMENT, pro_id INTEGER NOT NULL,
      name TEXT, email TEXT, phone TEXT, city TEXT, note TEXT,
      source TEXT DEFAULT 'import', created_at TEXT DEFAULT (datetime('now')))`);
  } catch {}
}

export function proByToken(token: string) {
  if (!token) return undefined;
  ensureVendorSchema();
  return one<any>("SELECT * FROM pros WHERE onboard_token=?", token);
}

export function startProTrial(id: number) {
  ensureVendorSchema();
  run(`UPDATE pros SET trial_started_at=COALESCE(trial_started_at, datetime('now')),
       participation_status=CASE WHEN participation_status='free' OR participation_status IS NULL
         THEN 'trial' ELSE participation_status END WHERE id=?`, id);
}

export function proParticipation(id: number) {
  ensureVendorSchema();
  const rec = one<any>("SELECT id, trial_started_at, participation_status FROM pros WHERE id=?", id);
  if (!rec) return null;
  let daysLeft: number | null = null;
  if (rec.trial_started_at) {
    const elapsed = (Date.now() - new Date(rec.trial_started_at + "Z").getTime()) / 86400000;
    daysLeft = Math.max(0, Math.ceil(VENDOR_TRIAL_DAYS - elapsed));
  }
  const inTrial = daysLeft !== null && daysLeft > 0;
  const isMember = rec.participation_status === "member";
  return {
    status: isMember ? "member" : inTrial ? "trial" : "free",
    trial_days_left: daysLeft, trial_days_total: VENDOR_TRIAL_DAYS,
    threshold_usd: VENDOR_THRESHOLD_USD,
  };
}

function s(v: any) { return v == null ? "" : String(v).slice(0, 2000); }
function safeLinks(v: any) { try { return typeof v === "string" ? (JSON.parse(v || "{}") || {}) : (v || {}); } catch { return {}; } }

type ClientRow = { name?: string; email?: string; phone?: string; city?: string; note?: string };

export function saveVendorOnboarding(token: string, data: any) {
  const pro = proByToken(token);
  if (!pro) return { ok: false as const, error: "Invalid or expired setup link." };
  const links = safeLinks(pro.links);
  if (data.website) links.web = String(data.website).slice(0, 200);
  run(`UPDATE pros SET
       headline=COALESCE(NULLIF(?,''), headline),
       bio=COALESCE(NULLIF(?,''), bio),
       phone=?, address=?, hours=?, website=?, year_est=?, services=?,
       city=COALESCE(NULLIF(?,''), city), tags=COALESCE(NULLIF(?,''), tags),
       links=?, onboard_done_at=datetime('now') WHERE id=?`,
    s(data.headline), s(data.bio), s(data.phone), s(data.address), s(data.hours),
    s(data.website), s(data.year_est), s(data.services), s(data.city), s(data.tags),
    JSON.stringify(links), pro.id);
  startProTrial(pro.id);
  let added = 0;
  const rows: ClientRow[] = Array.isArray(data.clients) ? data.clients : [];
  const ins = getDb().prepare(`INSERT INTO pro_clients(pro_id,name,email,phone,city,note,source)
    VALUES(?,?,?,?,?,?, 'import')`);
  const tx = getDb().transaction((list: ClientRow[]) => {
    for (const r of list) {
      const name = s(r.name), email = s(r.email), phone = s(r.phone);
      if (!name && !email && !phone) continue;
      ins.run(pro.id, name, email, phone, s(r.city), s(r.note));
      added++;
    }
  });
  tx(rows.slice(0, 5000));
  return { ok: true as const, pro_id: pro.id, clients_added: added };
}
