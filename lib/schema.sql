-- ROADIE local schema (SQLite). Front-of-house: community, venues, booking, tour, sponsors.
-- mymymy stays the source of truth for catalog/works/royalties; ROADIE caches a thin view.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'band',     -- band | venue | booker | sponsor | public | admin
  pass_hash TEXT, pass_salt TEXT,
  band_id INTEGER, venue_id INTEGER, sponsor_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bands (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  genre TEXT,                            -- primary genre
  genres TEXT,                           -- csv of all genres / remixable styles
  home_city TEXT,
  home_region TEXT DEFAULT 'BC',
  lat REAL, lng REAL,
  bio TEXT,                              -- AI-polished bio
  bio_short TEXT,
  members TEXT,                          -- csv names
  draw INTEGER DEFAULT 0,                -- typical headcount they pull
  rate_min INTEGER, rate_max INTEGER,    -- CAD guarantee range
  touring INTEGER DEFAULT 0,             -- 1 = actively looking to tour
  socials TEXT,                          -- json: {instagram, tiktok, spotify, youtube}
  spotify_url TEXT,                      -- official Spotify artist URL (for embed)
  links TEXT,                            -- json: {spotify,apple,youtube,soundcloud,bandcamp,instagram,tiktok,facebook,reverbnation,bandsintown,website}
  member_status TEXT DEFAULT 'member',   -- member | sample (sponsored presence, not signed up)
  hero_image TEXT,
  mymymy_artist_id TEXT,                 -- link into mymymy catalog
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  city TEXT, region TEXT DEFAULT 'BC',
  lat REAL, lng REAL,
  capacity INTEGER,
  genres TEXT,                           -- csv of genres they book
  backline TEXT,                         -- gear provided
  contact TEXT,
  pay_model TEXT,                        -- guarantee | door | door_split | hybrid
  notes TEXT,
  member_status TEXT DEFAULT 'member',   -- member | sample (temp/unclaimed listing awaiting claim)
  calendar_url TEXT,                     -- webcal:// | Google Calendar share | direct .ics
  calendar_kind TEXT,                    -- ics | webcal | google | unknown
  calendar_last_sync TEXT,
  calendar_last_result TEXT,             -- json {added,updated,skipped,total}
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venue_slots (
  id INTEGER PRIMARY KEY,
  venue_id INTEGER REFERENCES venues(id),
  date TEXT NOT NULL,                    -- ISO date
  status TEXT DEFAULT 'open',            -- open | held | booked
  genre_wanted TEXT,
  guarantee INTEGER,                     -- CAD offered
  notes TEXT,
  source TEXT DEFAULT 'manual',          -- manual | ocr | voice | ics
  ics_uid TEXT,                          -- VEVENT UID for idempotent calendar re-sync
  created_at TEXT DEFAULT (datetime('now'))
);

-- ===== THE RING: ROADIE brings the stage =====
-- A stop is a date ROADIE shows up. Supply is created by announcing a route,
-- not by waiting for a venue to post an open night. A venue is one site_kind
-- among many — the show does not depend on one existing.
-- A route is the tour the ring travels: an arc sponsors can buy whole.
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Interior Ring 2027"
  arc TEXT,                              -- "Kelowna->PG", "Nelson Spur"
  season TEXT,
  start_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'planning',        -- planning | announced | running | done
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stops (
  id INTEGER PRIMARY KEY,
  route_id INTEGER REFERENCES routes(id),
  seq INTEGER,                           -- order along the route
  date TEXT NOT NULL,                    -- ISO date
  city TEXT NOT NULL, region TEXT DEFAULT 'BC', country TEXT DEFAULT 'CA',
  lat REAL, lng REAL,
  site_name TEXT,                        -- "Kelowna Rodeo Grounds", "Bella Coola Community Field"
  site_kind TEXT DEFAULT 'roadie_ring',  -- roadie_ring | fairground | rodeo_grounds | community_hall | arena_lot | park | reserve_grounds | venue
  venue_id INTEGER REFERENCES venues(id),-- set ONLY when site_kind='venue'
  -- The rig scales: same route, different footprint per town.
  site_scale TEXT DEFAULT 'full_ring',   -- popup | small_ring | mid_ring | full_ring
  capacity INTEGER,                      -- ring capacity at this site
  lot_spaces INTEGER,                    -- attendee parking the ground must carry
  camping INTEGER DEFAULT 0,             -- 1 = overnight camping on site
  overflow_field TEXT,                   -- adjacent field/lot secured for spill
  gates_at TEXT, curfew TEXT,
  permit_status TEXT DEFAULT 'none',     -- none | applied | approved | denied
  permit_notes TEXT,
  power TEXT,                            -- shore | generator | both
  -- Every stop gets an advance person on the ground before the rig rolls.
  location_manager TEXT,
  location_manager_contact TEXT,
  advance_status TEXT DEFAULT 'unassigned', -- unassigned | assigned | scouted | cleared
  hub_id INTEGER,
  status TEXT DEFAULT 'planned',         -- planned | announced | onsale | confirmed | played | cancelled
  headliner_band_id INTEGER REFERENCES bands(id),
  notes TEXT,
  is_test INTEGER DEFAULT 0,             -- 1 = standing sandbox stop, always shoot-able, never real footage
  -- Opt-in per-show lock: NULL means the bare /shoot?stop=<id> link still
  -- works (today's behaviour). Set the first time a stop's QR is regenerated,
  -- which is how a leaked/abused link gets shut off -- see lib/shareTokens.ts.
  share_token TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stop_qr_archive (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT
);

-- Bands browse the announced ring and say where they want in. This is the
-- common-user view: pick your stops, set how far you'll travel, we place you.
CREATE TABLE IF NOT EXISTS stop_interest (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  route_id INTEGER REFERENCES routes(id),
  band_id INTEGER REFERENCES bands(id),
  interest TEXT DEFAULT 'in',            -- in | maybe | out
  travel_km INTEGER,                     -- how far they'll go for this one
  wants_bill TEXT,                       -- headliner | direct_support | support | opener | any
  wants_host INTEGER DEFAULT 0,          -- 1 = "this is our town, we want to host it" (bill position is separate)
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(stop_id, band_id)
);

-- Bands play a stop. Slots stay for venue-hosted nights; stop_id is the new path.
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  slot_id INTEGER REFERENCES venue_slots(id),
  band_id INTEGER REFERENCES bands(id),
  venue_id INTEGER REFERENCES venues(id),
  date TEXT,
  bill_position TEXT DEFAULT 'support',  -- headliner | direct_support | support | opener | local
  host_band INTEGER DEFAULT 0,           -- 1 = the hometown act anchoring this stop (any bill position)
  status TEXT DEFAULT 'pending',         -- pending | confirmed | contract_sent | signed | settled | cancelled
  guarantee INTEGER,
  ai_match_score REAL,                   -- 0..1 smart-placement confidence
  contract_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Vendors buy a spot inside the tent. Sponsors buy the route, an arc or a stop.
CREATE TABLE IF NOT EXISTS vendor_spots (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  route_id INTEGER REFERENCES routes(id),-- set when a vendor buys the whole run
  sponsor_id INTEGER REFERENCES sponsors(id),
  vendor_name TEXT NOT NULL,
  kind TEXT,                             -- food | merch | craft | service | community | outfitter | retail
  spot_size TEXT DEFAULT '10x10',
  fee INTEGER,                           -- CAD
  power_required INTEGER DEFAULT 0,
  status TEXT DEFAULT 'inquiry',         -- inquiry | held | confirmed | paid | cancelled
  contact TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- HOST BIDS: the inversion. ROADIE announces where the ring is heading; venues,
-- fairgrounds, municipalities and bands' hometowns APPLY to host it. ROADIE selects.
-- A venue does not grant us a night — it earns the tent pole.
CREATE TABLE IF NOT EXISTS host_bids (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),  -- the announced date being bid on
  route_id INTEGER REFERENCES routes(id),
  applicant_kind TEXT NOT NULL,          -- venue | municipality | fairground | promoter | band | community
  applicant_id INTEGER,                  -- venues.id when applicant_kind='venue'
  applicant_name TEXT NOT NULL,
  city TEXT, region TEXT DEFAULT 'BC',
  lat REAL, lng REAL,
  site_offered TEXT,                     -- what ground they're putting up
  site_kind TEXT,                        -- fairground | rodeo_grounds | arena_lot | park | reserve_grounds | venue
  capacity_offered INTEGER,
  ground_ready INTEGER DEFAULT 0,        -- 1 = flat, drained, truck-accessible
  power_onsite INTEGER DEFAULT 0,
  parking_spaces INTEGER,
  permit_help INTEGER DEFAULT 0,         -- 1 = applicant handles municipal permits
  local_crew_offered INTEGER DEFAULT 0,  -- headcount they can staff
  guarantee_offered INTEGER,             -- CAD they'll put up to land the date
  pitch TEXT,                            -- why their town deserves the ring
  score REAL,                            -- ROADIE ranking 0..1
  status TEXT DEFAULT 'submitted',       -- submitted | shortlisted | selected | declined | waitlist
  contact TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- EVENT CREW: the people who travel WITH the ring — the film unit shooting the
-- run, production, transport drivers and support. Distinct from local_crew,
-- which is hired fresh in each town. route_id = rides the whole run;
-- stop_id = brought in for one date only.
CREATE TABLE IF NOT EXISTS event_crew (
  id INTEGER PRIMARY KEY,
  route_id INTEGER REFERENCES routes(id),
  stop_id INTEGER REFERENCES stops(id),
  name TEXT NOT NULL,
  company TEXT,
  department TEXT NOT NULL,              -- film | production | transport | support | sound | lighting | medical | security
  role TEXT,                             -- director, camera op, editor, driver, rigger, tour manager, medic
  rate INTEGER, rate_unit TEXT DEFAULT 'day',
  vehicle TEXT,                          -- transport: truck / bus / trailer / gear van
  travels_full_run INTEGER DEFAULT 1,
  contact TEXT,
  status TEXT DEFAULT 'held',            -- held | confirmed | contracted | released
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Local hire: transport, load-in/out, security, gate. The crew we hire in each town.
CREATE TABLE IF NOT EXISTS local_crew (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  role TEXT NOT NULL,                    -- transport | load_in | load_out | security | gate | medic | cleanup | sound | lighting
  headcount INTEGER DEFAULT 1,
  rate INTEGER,                          -- CAD per person
  filled INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  body TEXT,                             -- generated contract text
  jurisdiction TEXT DEFAULT 'BC',
  status TEXT DEFAULT 'draft',           -- draft | sent | signed
  band_signed_at TEXT, venue_signed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- NOTICE BOARD: bands & venues broadcast intent
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,                    -- touring | gig_gap | seeking_opener | seeking_band | bill_swap | gear | runout
  author_type TEXT,                      -- band | venue | booker
  author_id INTEGER,
  title TEXT, body TEXT,
  city TEXT, region TEXT DEFAULT 'BC',
  date_from TEXT, date_to TEXT,
  genre TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- TOUR planning
CREATE TABLE IF NOT EXISTS tours (
  id INTEGER PRIMARY KEY,
  band_id INTEGER REFERENCES bands(id),
  name TEXT,
  start_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'planning',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tour_stops (
  id INTEGER PRIMARY KEY,
  tour_id INTEGER REFERENCES tours(id),
  seq INTEGER,
  city TEXT, lat REAL, lng REAL,
  date TEXT,
  venue_id INTEGER,
  status TEXT DEFAULT 'target'           -- target | inquired | booked
);

CREATE TABLE IF NOT EXISTS tour_amenities (
  id INTEGER PRIMARY KEY,
  tour_id INTEGER REFERENCES tours(id),
  stop_id INTEGER REFERENCES tour_stops(id),
  kind TEXT NOT NULL,                    -- gas | hotel | food | repair
  name TEXT,
  city TEXT, lat REAL, lng REAL,
  distance_km REAL,
  price_note TEXT,                       -- live provider note / manual price / "$$"
  appeal_note TEXT,                      -- parking, breakfast, late check-in, safe load-in
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);

-- SPONSORS + monetization
CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,                             -- music_store | hotel | vehicle_rental | food_vendor | retail | outfitter | family_brand | brand_rep | other
  city TEXT, region TEXT DEFAULT 'BC',
  budget_monthly INTEGER,               -- CAD
  contact TEXT,
  rep_brand TEXT,                        -- brand_rep: the company they represent (e.g. "Lululemon")
  rep_role  TEXT,                        -- brand_rep: their title at that company
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ad_placements (
  id INTEGER PRIMARY KEY,
  sponsor_id INTEGER REFERENCES sponsors(id),
  surface TEXT,                          -- public_feed | band_profile | venue_page | tour_map | notice_board
  label TEXT,
  cost INTEGER,                          -- CAD spent
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  start_date TEXT, end_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_templates (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  owner_kind TEXT DEFAULT 'venue',        -- band | venue | sponsor
  goal TEXT,                              -- presale | coupon | vendor_spot | merch | awareness
  default_blocks TEXT,                    -- json block order for drag/drop creative
  notes TEXT
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  owner_kind TEXT NOT NULL,               -- band | venue | sponsor
  owner_id INTEGER NOT NULL,
  template_id INTEGER REFERENCES campaign_templates(id),
  title TEXT NOT NULL,
  audience TEXT DEFAULT 'fans',           -- fans | bands | venues | sponsors
  status TEXT DEFAULT 'draft',            -- draft | live | paused | ended
  start_date TEXT, end_date TEXT,
  blocks TEXT,                            -- json customized block order/content
  budget INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  offer TEXT,
  redeem_url TEXT,
  max_redemptions INTEGER DEFAULT 0,
  redeemed INTEGER DEFAULT 0,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Perk inventory: hotels / vehicle / gear that bands can claim on a routed tour
CREATE TABLE IF NOT EXISTS perks (
  id INTEGER PRIMARY KEY,
  sponsor_id INTEGER REFERENCES sponsors(id),
  kind TEXT,                             -- hotel_night | van_day | gear_loan | meal_voucher | fuel_card
  city TEXT,
  qty INTEGER, qty_claimed INTEGER DEFAULT 0,
  value_each INTEGER,
  notes TEXT
);

-- Account books: private receipts, expenses and invoices for tax time.
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY,
  band_id INTEGER REFERENCES bands(id),
  user_id INTEGER REFERENCES users(id),
  image_data TEXT,                       -- first pass: data URL from phone camera; later: bucket key + OCR
  vendor TEXT,
  purchased_at TEXT,
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  category TEXT DEFAULT 'tour',
  notes TEXT,
  status TEXT DEFAULT 'captured',        -- captured | reviewed | exported
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY,
  band_id INTEGER REFERENCES bands(id),
  user_id INTEGER REFERENCES users(id),
  receipt_id INTEGER REFERENCES receipts(id),
  category TEXT DEFAULT 'tour',
  vendor TEXT,
  expense_date TEXT,
  amount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  band_id INTEGER REFERENCES bands(id),
  user_id INTEGER REFERENCES users(id),
  booking_id INTEGER REFERENCES bookings(id),
  client_name TEXT,
  client_email TEXT,
  line_items TEXT,                       -- json: [{description, qty, rate}]
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'draft',           -- draft | sent | paid | void
  due_date TEXT,
  issued_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- thin cache of mymymy works (promo side)
CREATE TABLE IF NOT EXISTS works_cache (
  id INTEGER PRIMARY KEY,
  band_id INTEGER REFERENCES bands(id),
  iswc TEXT, title TEXT,
  primary_genre TEXT,
  variant_count INTEGER DEFAULT 0,
  hero_video TEXT,                       -- promo video url (kenburns | living)
  cover_url TEXT,
  source TEXT DEFAULT 'mock',            -- mock | mymymy
  updated_at TEXT DEFAULT (datetime('now'))
);

-- BC (and future region) rules reference for the AI tour manager
CREATE TABLE IF NOT EXISTS region_rules (
  id INTEGER PRIMARY KEY,
  region TEXT, topic TEXT, rule TEXT, source TEXT
);

-- ===== International / geographic layer =====

-- territories: country -> province/state hierarchy (for browse + rule scoping)
CREATE TABLE IF NOT EXISTS territories (
  id INTEGER PRIMARY KEY,
  country TEXT NOT NULL,      -- CA | US | MX
  code TEXT,                  -- BC, WA, JAL ...
  name TEXT NOT NULL,
  type TEXT NOT NULL,         -- country | province | state
  parent_country TEXT
);

-- cross-border touring rules (from_country -> to_country), category-keyed
CREATE TABLE IF NOT EXISTS crossings (
  id INTEGER PRIMARY KEY,
  from_country TEXT NOT NULL, -- CA | US | MX | ANY
  to_country TEXT NOT NULL,   -- CA | US | MX
  category TEXT NOT NULL,     -- visa | gear | tax | port_entry | merch
  title TEXT,
  summary TEXT,               -- short, plain-language
  key_fact TEXT,              -- the one number/timeline that matters
  official_url TEXT,          -- authoritative source
  source TEXT,                -- label for the source
  updated_on TEXT
);

-- immigration / application point-of-contact (the green-card buddy)
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  role TEXT,                  -- immigration_help | visa_consult | ...
  name TEXT, status TEXT,     -- e.g. "US Green Card holder"
  email TEXT, phone TEXT, website TEXT,
  countries TEXT,             -- csv: CA,US,MX
  notes TEXT
);

-- Fans: follows + questions back to bands/venues (no payments here — tickets/donate link out)
CREATE TABLE IF NOT EXISTS fan_messages (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,            -- follow | question | tip_intent
  band_id INTEGER, venue_id INTEGER,
  fan_name TEXT, fan_email TEXT, body TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Floor Sessions: account-owned phone recordings, mastered in-browser, kept in a bucket.
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  band_id INTEGER REFERENCES bands(id),
  title TEXT,
  kind TEXT DEFAULT 'idea',          -- idea | rehearsal | live | acoustic | sample
  audio_key TEXT,                    -- file key in the bucket
  mime TEXT DEFAULT 'audio/wav',
  duration_ms INTEGER,
  enhanced INTEGER DEFAULT 0,        -- 1 = ran the master chain
  ai_upscaled INTEGER DEFAULT 0,     -- 1 = mymymy neural enhance applied
  status TEXT DEFAULT 'published',   -- draft | published
  visibility TEXT DEFAULT 'private', -- private | public
  created_at TEXT DEFAULT (datetime('now'))
);

-- Auth sessions (httpOnly cookie token -> user). Distinct from Floor 'sessions'.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  expires TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Pros: producers, distributors, videographers, engineers… members with multi-flags.
CREATE TABLE IF NOT EXISTS pros (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  headline TEXT,
  kind TEXT,                 -- producer | distributor | videographer | engineer | other
  tags TEXT,                 -- csv flags: producer,mixing,mastering,music_video,distribution,bmi,ascap,socan,sag,artist…
  city TEXT, region TEXT, country TEXT DEFAULT 'CA',
  remote INTEGER DEFAULT 1,  -- works remotely / cross-border
  bio TEXT, links TEXT,
  member_status TEXT DEFAULT 'member',   -- member | lifetime_free | sample
  created_at TEXT DEFAULT (datetime('now'))
);
-- The Lifeline: members flag a need; AI matches by skill + area.
CREATE TABLE IF NOT EXISTS needs (
  id INTEGER PRIMARY KEY,
  tag TEXT NOT NULL,         -- needproducer | needgig | needvideo | needmix | needmaster | needdistribution
  author_kind TEXT, author_id INTEGER, author_name TEXT,
  city TEXT, region TEXT, country TEXT,
  note TEXT, status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Festivals (public data). Traveling festivals carry a route of stops.
CREATE TABLE IF NOT EXISTS festivals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT, region TEXT, country TEXT DEFAULT 'CA',
  lat REAL, lng REAL,
  month TEXT, genre TEXT, website TEXT,
  traveling INTEGER DEFAULT 0, route TEXT,
  source TEXT DEFAULT 'public', notes TEXT
);

-- Hubs. Lifted from lib/hubs.ts:ensureHubSchema() so a fresh database created by
-- scripts/init-db.mjs has it too. That script loads THIS file and cannot call
-- the TypeScript ensure function, so seeds that read `hubs` (seed-usa-west,
-- seed-pacific-corridor) hit "no such table" on a brand-new DB — which is what
-- broke the Docker image build. Keep this in step with ensureHubSchema().
CREATE TABLE IF NOT EXISTS hubs(
    id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, country TEXT DEFAULT 'CA', province TEXT,
    center_lat REAL, center_lng REAL, default_zoom INTEGER DEFAULT 8,
    bbox_min_lat REAL, bbox_max_lat REAL, bbox_min_lng REAL, bbox_max_lng REAL,
    loop_cities TEXT DEFAULT '[]', rules_region TEXT, timezone TEXT, tagline TEXT,
    local_km INTEGER DEFAULT 60, runout_km INTEGER DEFAULT 260, live INTEGER DEFAULT 0);

-- VENDOR OFFERS — a standing discount from a business on the platform.
--
-- Advertising is the tour's mainstay and local vendors bid to host us; this is
-- neither. It is a small, separate thing: a vendor already on the app decides to
-- offer a discount, and any band or fan travelling through that area can claim it
-- AT ANY TIME. Not only on a ring night, not only in a town we are playing, and
-- not bundled into anything anyone bought.
--
-- Why it is worth having: a touring band's whole year is spent passing through
-- towns where they know nobody. A standing list of places that will look after
-- them is worth more to that band than a poster. And for the vendor it is trade
-- they would not otherwise have seen, from people who are in town anyway.
--
-- BUILT BUT OFF. Nothing surfaces unless ROADIE_VENDOR_TOKENS=1.
CREATE TABLE IF NOT EXISTS vendor_offers (
  id INTEGER PRIMARY KEY,
  sponsor_id INTEGER REFERENCES sponsors(id),
  vendor_spot_id INTEGER REFERENCES vendor_spots(id),
  business_name TEXT NOT NULL,

  -- WHERE it is honoured. The discount lives at the business, so the geography
  -- is the business's own — not a route and not a show date.
  city TEXT, region TEXT,
  lat REAL, lng REAL,
  scope TEXT NOT NULL DEFAULT 'city',    -- city | region | anywhere

  -- WHO it is for. Most vendors will happily do both; some only want to look
  -- after the bands.
  for_bands INTEGER DEFAULT 1,
  for_fans  INTEGER DEFAULT 1,

  -- The discount itself. The vendor sets this, not us.
  kind TEXT NOT NULL DEFAULT 'percent',  -- percent | amount | freebie
  value INTEGER,                         -- percent: 10 = 10%. amount: minor units.
  currency TEXT DEFAULT 'CAD',
  title TEXT NOT NULL,                   -- "10% off any breakfast"
  terms TEXT,                            -- the small print, in the vendor's words

  -- Standing offer by default: no dates means always on.
  valid_from TEXT, valid_to TEXT,
  max_redemptions INTEGER,               -- null = unlimited
  per_fan_limit INTEGER DEFAULT 0,       -- 0 = unlimited; it is a standing discount
  active INTEGER DEFAULT 1,              -- the vendor's own switch
  suspended INTEGER DEFAULT 0,           -- ROADIE's override, if one is ever needed
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_city   ON vendor_offers(city, active);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_region ON vendor_offers(region, active);

-- One row per claim. The vendor's proof it worked, and how we count limits.
CREATE TABLE IF NOT EXISTS vendor_offer_redemptions (
  id INTEGER PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES vendor_offers(id),
  user_id INTEGER REFERENCES users(id),
  band_id INTEGER REFERENCES bands(id),  -- set when a touring band claims it
  token TEXT,                            -- the short code shown at the counter
  redeemed_at TEXT DEFAULT (datetime('now')),
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_vor_offer ON vendor_offer_redemptions(offer_id);
CREATE INDEX IF NOT EXISTS idx_vor_user  ON vendor_offer_redemptions(offer_id, user_id);

-- FAN MULTICAM — every phone in the room becomes a camera.
--
-- Fans film from the floor at every show and that footage currently goes
-- nowhere. Here they upload it, the system lines every clip up against the
-- others BY THE AUDIO, and the night can be cut as a real multi-camera shoot:
-- verticals as the punch-ins, the wide left wide. What the fan gets back is a
-- proper multi-cam video of the night they were at.
--
-- Audio is what makes this work. Phones share no clock and their timestamps are
-- unreliable, but they all recorded the same room — so the sound is the sync
-- track, and everything is expressed as an offset in milliseconds against one
-- reference clip.
CREATE TABLE IF NOT EXISTS multicam_sets (
  id INTEGER PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  band_id INTEGER REFERENCES bands(id),
  title TEXT,                            -- "Trail, second set"
  -- The clip everything else is aligned against. Usually the longest or the
  -- cleanest audio, chosen when alignment runs.
  reference_clip_id INTEGER,
  status TEXT DEFAULT 'open',            -- open | aligning | aligned | failed | published
  -- The finished cut, once one has been rendered.
  output_key TEXT,                       -- R2 key of the rendered mp4
  output_bytes INTEGER,
  render_status TEXT,                    -- rendering | done | failed
  render_note TEXT,                      -- why it failed, in plain words
  rendered_at TEXT,
  aligned_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fan_clips (
  id INTEGER PRIMARY KEY,
  set_id INTEGER REFERENCES multicam_sets(id),
  stop_id INTEGER REFERENCES stops(id),
  user_id INTEGER REFERENCES users(id),

  -- The file, on the shared pool beside the render bucket.
  path TEXT NOT NULL,                    -- relative to the fan-clip root
  original_name TEXT,
  bytes INTEGER,
  mime TEXT,

  -- Filled in by the alignment worker, which is the only thing with ffmpeg.
  duration_ms INTEGER,
  width INTEGER, height INTEGER,
  orientation TEXT,                      -- vertical | wide  (decides punch-in vs wide)
  has_audio INTEGER,

  -- The whole point: milliseconds from the reference clip's start. Negative
  -- means this clip started BEFORE the reference.
  offset_ms INTEGER,
  -- Where the first real transient sits inside this clip. The music often
  -- starts well after the recording does, and an edit that began at the first
  -- downbeat would throw away the talking in front of it.
  first_onset_ms INTEGER,
  align_score REAL,                      -- confidence 0..1; low means do not trust it
  align_status TEXT DEFAULT 'pending',   -- pending | ok | weak | failed | rejected
  -- The phone's own record-start clock (Date.now() at MediaRecorder.start()),
  -- never the file container's timestamp -- see fanclips.ts for why those
  -- differ. Seeds/validates the audio alignment and is the fallback
  -- placement when a clip's audio can't be read.
  recorded_started_at_ms INTEGER,
  align_method TEXT,                     -- audio | clock | none

  -- RIGHTS. Not optional and not an afterthought: publishing a stranger's
  -- footage of somebody else's performance without a licence is the one thing
  -- here that can actually cost real money.
  licence_granted INTEGER DEFAULT 0,     -- the uploader ticked the box
  licence_text TEXT,                     -- the exact wording they agreed to
  licence_at TEXT,
  uploader_name TEXT,                    -- for the credit roll
  guest_email TEXT,                      -- guest capture: no ROADIE account, this is how we reach them

  status TEXT DEFAULT 'uploaded',        -- uploaded | approved | hidden | removed
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fan_clips_set  ON fan_clips(set_id);
CREATE INDEX IF NOT EXISTS idx_fan_clips_stop ON fan_clips(stop_id, status);

-- BRIDGE INBOX — verified inter-property messages (localjams federation).
-- Every inbound call that passes HMAC lands here durably before any processing;
-- the processor for each kind ships with its feature (points, events, profiles).
CREATE TABLE IF NOT EXISTS bridge_inbox (
  id INTEGER PRIMARY KEY,
  property TEXT NOT NULL,               -- sender: 'socaljams' | future localjams slugs
  kind TEXT NOT NULL,                   -- ping | event.push | tokens.sync | profile.claim
  payload TEXT NOT NULL,                -- JSON, verbatim as received
  signature TEXT NOT NULL,              -- the HMAC that admitted it (audit)
  received_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,                    -- null until a feature consumes it
  process_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_bridge_inbox_kind ON bridge_inbox(kind, processed_at);
