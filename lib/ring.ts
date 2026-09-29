import { getDb } from "./db";

// The ring model lands on databases created before it existed, so every table
// and column is added idempotently the same way the calendar/hotel layers do.
// schema.sql stays the source of truth for fresh installs.
export function ensureRingSchema() {
  const db = getDb();

  db.exec(`CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL, arc TEXT, season TEXT,
    start_date TEXT, end_date TEXT,
    status TEXT DEFAULT 'planning', notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS stops (
    id INTEGER PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id), seq INTEGER,
    date TEXT NOT NULL,
    city TEXT NOT NULL, region TEXT DEFAULT 'BC', country TEXT DEFAULT 'CA',
    lat REAL, lng REAL,
    site_name TEXT, site_kind TEXT DEFAULT 'roadie_ring',
    venue_id INTEGER REFERENCES venues(id),
    site_scale TEXT DEFAULT 'full_ring',
    capacity INTEGER, lot_spaces INTEGER, camping INTEGER DEFAULT 0, overflow_field TEXT,
    gates_at TEXT, curfew TEXT,
    permit_status TEXT DEFAULT 'none', permit_notes TEXT,
    power TEXT,
    location_manager TEXT, location_manager_contact TEXT,
    advance_status TEXT DEFAULT 'unassigned',
    hub_id INTEGER,
    status TEXT DEFAULT 'planned',
    headliner_band_id INTEGER REFERENCES bands(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS stop_interest (
    id INTEGER PRIMARY KEY,
    stop_id INTEGER REFERENCES stops(id),
    route_id INTEGER REFERENCES routes(id),
    band_id INTEGER REFERENCES bands(id),
    interest TEXT DEFAULT 'in',
    travel_km INTEGER,
    wants_bill TEXT,
    wants_host INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(stop_id, band_id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS host_bids (
    id INTEGER PRIMARY KEY,
    stop_id INTEGER REFERENCES stops(id),
    route_id INTEGER REFERENCES routes(id),
    applicant_kind TEXT NOT NULL, applicant_id INTEGER, applicant_name TEXT NOT NULL,
    city TEXT, region TEXT DEFAULT 'BC', lat REAL, lng REAL,
    site_offered TEXT, site_kind TEXT, capacity_offered INTEGER,
    ground_ready INTEGER DEFAULT 0, power_onsite INTEGER DEFAULT 0,
    parking_spaces INTEGER, permit_help INTEGER DEFAULT 0,
    local_crew_offered INTEGER DEFAULT 0, guarantee_offered INTEGER,
    pitch TEXT, score REAL,
    status TEXT DEFAULT 'submitted', contact TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS vendor_spots (
    id INTEGER PRIMARY KEY,
    stop_id INTEGER REFERENCES stops(id),
    route_id INTEGER REFERENCES routes(id),
    sponsor_id INTEGER REFERENCES sponsors(id),
    vendor_name TEXT NOT NULL, kind TEXT,
    spot_size TEXT DEFAULT '10x10', fee INTEGER,
    power_required INTEGER DEFAULT 0,
    status TEXT DEFAULT 'inquiry', contact TEXT, notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS event_crew (
    id INTEGER PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id),
    stop_id INTEGER REFERENCES stops(id),
    name TEXT NOT NULL, company TEXT,
    department TEXT NOT NULL, role TEXT,
    rate INTEGER, rate_unit TEXT DEFAULT 'day',
    vehicle TEXT, travels_full_run INTEGER DEFAULT 1,
    contact TEXT, status TEXT DEFAULT 'held', notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS local_crew (
    id INTEGER PRIMARY KEY,
    stop_id INTEGER REFERENCES stops(id),
    role TEXT NOT NULL, headcount INTEGER DEFAULT 1, rate INTEGER,
    filled INTEGER DEFAULT 0, notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  for (const col of ["stop_id INTEGER", "bill_position TEXT DEFAULT 'support'", "host_band INTEGER DEFAULT 0"]) {
    try { db.exec(`ALTER TABLE bookings ADD COLUMN ${col}`); } catch {}
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_stops_route_date ON stops(route_id, date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_host_bids_stop ON host_bids(stop_id, score DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_stop_interest_stop ON stop_interest(stop_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_event_crew_route ON event_crew(route_id, department)`);
}
