// SPONSORED BACKLINE — the shoppable "what's that on stage?" layer.
//
// A venue declares the gear on its stage: item + brand + a buy link (and the
// sponsor behind it). That becomes an always-on QR/shop list — in the room and
// on the LocalJams/multicam video: someone hears the guitar, asks "what's that",
// scans, buys one. An ad layer beyond the video collective.
// See [localjams-shoppable-content-aware-video], [jampoints-canvassing-loyalty-doctrine].
import { getDb, all, one, run } from "./db";

export const BACKLINE_CATEGORIES = [
  "guitar", "bass", "drums", "cymbals", "sticks", "amp", "keys", "mic", "pa", "other",
] as const;

let ensured = false;
export function ensureBacklineSchema() {
  if (ensured) return;
  getDb().exec(`CREATE TABLE IF NOT EXISTS backline(
    id INTEGER PRIMARY KEY,
    venue_id INTEGER,
    stop_id INTEGER,
    category TEXT,
    item TEXT NOT NULL,
    brand TEXT,
    sponsor_id INTEGER,
    buy_url TEXT,
    price TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  ensured = true;
}

export type BacklineItem = {
  id?: number; venue_id?: number | null; stop_id?: number | null; category?: string | null;
  item: string; brand?: string | null; sponsor_id?: number | null; buy_url?: string | null;
  price?: string | null; notes?: string | null; active?: number;
};

export function listForVenue(venueId: number) {
  ensureBacklineSchema();
  return all<any>(
    `SELECT b.*, s.name AS sponsor_name FROM backline b
       LEFT JOIN sponsors s ON s.id = b.sponsor_id
      WHERE b.venue_id = ? AND b.active = 1
      ORDER BY b.category, b.item`, venueId);
}

// For a LocalJams town page — every stage's backline in that city.
export function listForCity(city: string) {
  ensureBacklineSchema();
  try {
    return all<any>(
      `SELECT b.*, v.name AS venue_name, s.name AS sponsor_name FROM backline b
         JOIN venues v ON v.id = b.venue_id
         LEFT JOIN sponsors s ON s.id = b.sponsor_id
        WHERE lower(v.city) LIKE lower(?) AND b.active = 1
        ORDER BY v.name, b.category, b.item LIMIT 40`, city + "%");
  } catch { return []; }
}

export function saveItem(o: BacklineItem): number {
  ensureBacklineSchema();
  if (o.id) {
    run(`UPDATE backline SET venue_id=?, category=?, item=?, brand=?, sponsor_id=?, buy_url=?, price=?, notes=?, active=? WHERE id=?`,
      o.venue_id ?? null, o.category ?? null, o.item, o.brand ?? null, o.sponsor_id ?? null,
      o.buy_url ?? null, o.price ?? null, o.notes ?? null, o.active ?? 1, o.id);
    return o.id;
  }
  run(`INSERT INTO backline(venue_id,stop_id,category,item,brand,sponsor_id,buy_url,price,notes,active)
       VALUES(?,?,?,?,?,?,?,?,?,1)`,
    o.venue_id ?? null, o.stop_id ?? null, o.category ?? null, o.item, o.brand ?? null,
    o.sponsor_id ?? null, o.buy_url ?? null, o.price ?? null, o.notes ?? null);
  return one<any>("SELECT last_insert_rowid() id")!.id;
}

export function removeItem(id: number) {
  ensureBacklineSchema();
  run("DELETE FROM backline WHERE id=?", id);
}

export function venueName(venueId: number): string {
  try { return one<any>("SELECT name FROM venues WHERE id=?", venueId)?.name || `Venue ${venueId}`; }
  catch { return `Venue ${venueId}`; }
}
