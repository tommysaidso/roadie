-- JAM POINTS - EARN-SIDE LAYER (DRAFT 2026-09-02, NOT APPLIED)
-- Complements vendor_offers (the spend side). Apply only with the feature ship,
-- behind ROADIE_JAM_POINTS=1, dark-404 like vendor-offers.

-- A vendor's scannable check-in point. One QR per location.
CREATE TABLE IF NOT EXISTS points_stations (
  id INTEGER PRIMARY KEY,
  sponsor_id INTEGER REFERENCES sponsors(id),
  vendor_offer_id INTEGER REFERENCES vendor_offers(id),
  business_name TEXT NOT NULL,
  city TEXT, region TEXT, country TEXT DEFAULT 'CA',   -- CA | US | UK per network world
  lat REAL, lng REAL,
  qr_secret TEXT NOT NULL,          -- signs the QR payload; rotate to void old stickers
  points_per_checkin INTEGER DEFAULT 25,
  active INTEGER DEFAULT 1,
  suspended INTEGER DEFAULT 0,      -- operator override (bait-and-switch removal)
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pstations_geo ON points_stations(country, region, city, active);

-- One row per successful scan. THE anti-fraud surface: unique per user+station+day.
CREATE TABLE IF NOT EXISTS points_checkins (
  id INTEGER PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES points_stations(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  day TEXT NOT NULL,                -- YYYY-MM-DD in the station's local zone
  points INTEGER NOT NULL,
  ip TEXT, lat REAL, lng REAL,      -- client-claimed geo, sanity-checked vs station
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(station_id, user_id, day)  -- one scan per vendor per day, enforced by the DB
);
CREATE INDEX IF NOT EXISTS idx_pcheck_user ON points_checkins(user_id, day);

-- Balance ledger: every change is a row; balance = SUM. Never UPDATE a balance.
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,           -- +earn / -spend
  reason TEXT NOT NULL,             -- checkin | day_streak_bonus | redeem | bridge_in | bridge_out | adjust
  ref_table TEXT, ref_id INTEGER,   -- provenance (points_checkins.id etc.)
  property TEXT DEFAULT 'roadie',   -- roadie | socaljams | <localjams property> - bridge provenance
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pledger_user ON points_ledger(user_id);

-- Tier unlocks snapshot (100 local perk / 250 double-up / 500 anywhere card).
CREATE TABLE IF NOT EXISTS points_cards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  member_qr TEXT NOT NULL,          -- RDMEMBER:<id> payload, signed
  anywhere_unlocked_at TEXT,        -- set when ledger first crosses 500
  wallet_pass_serial TEXT,          -- Apple/Google pass, when shipped
  created_at TEXT DEFAULT (datetime('now'))
);

-- LOCALJAM HUB PROVENANCE (Ben 2026-09-02): we must ALWAYS know where a hub was
-- created / came from, and track its history and memberships. Members correlate
-- across properties and are FREE to migrate into a mymymy account from the
-- operator's side. (User-facing registry: /localjam page.)
CREATE TABLE IF NOT EXISTS localjam_hubs (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,             -- socal-bigbear
  name TEXT NOT NULL,
  city TEXT, region TEXT, country TEXT DEFAULT 'US',
  operator_name TEXT NOT NULL,           -- Mike Hanson
  operator_email TEXT NOT NULL,          -- the join key for the operator
  origin_property TEXT NOT NULL,         -- who built/spawned it: 'roadie' | 'socaljams' | ...
  origin_note TEXT,                      -- "built on network template Sep 2026 by EVP"
  site_url TEXT,
  rules_url TEXT,                        -- their own Terms - per-property rules doctrine
  status TEXT DEFAULT 'forming',         -- forming | active | dormant
  created_at TEXT DEFAULT (datetime('now'))
);

-- Membership history: append-only, survives migration. One member, many hubs.
CREATE TABLE IF NOT EXISTS localjam_memberships (
  id INTEGER PRIMARY KEY,
  hub_id INTEGER NOT NULL REFERENCES localjam_hubs(id),
  member_email TEXT NOT NULL,            -- THE correlation key across properties
  user_id INTEGER REFERENCES users(id),  -- filled when they hold a ROADIE account
  role TEXT DEFAULT 'member',            -- member | performer | band | vendor | operator
  joined_at TEXT DEFAULT (datetime('now')),
  migrated_to_mymymy_at TEXT,            -- set on free migration from operator's side
  history TEXT DEFAULT '[]'              -- JSON event log: shows played, showcases, points milestones
);
CREATE INDEX IF NOT EXISTS idx_ljm_email ON localjam_memberships(member_email);
CREATE INDEX IF NOT EXISTS idx_ljm_hub ON localjam_memberships(hub_id);
