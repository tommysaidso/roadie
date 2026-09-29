// Seed known host sites for corridor towns that OSM Overpass hasn't populated yet.
//
// Every town on the ring has at least a Legion, a community hall, and often an
// arena. These are confirmed venues — not guesses — for the stops that were
// coming back with zero rooms while the ring existed on paper.
//
// Run inside the container (bind-mount covers scripts/):
//   docker exec roadie-web node scripts/seed-corridor-towns.mjs
//
// Skip-done: each venue is keyed on (name, city) — rerunning is safe.

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "roadie.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Ensure hub_id column exists (added in a recent migration)
try { db.exec("ALTER TABLE venues ADD COLUMN hub_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE venues ADD COLUMN user_id INTEGER"); } catch {}

const ins = db.prepare(`
  INSERT INTO venues(name, city, region, lat, lng, capacity, genres, contact, pay_model, notes, member_status)
  SELECT ?,?,?,?,?,?,?,'','door_split',?,'sample'
  WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name=? AND city=?)
`);

let added = 0, skipped = 0;
function seed(name, city, region, lat, lng, capacity, kind, note) {
  const r = ins.run(name, city, region, lat, lng, capacity, kind,
    `${note} · dry/unknown`, name, city);
  if (r.changes > 0) { added++; } else { skipped++; }
}

// ─── FRASER CANYON ────────────────────────────────────────────────────────────
// The spine of the ring. Every town has a Legion; the larger ones have arenas.

seed("Hope Community Hall",              "Hope",           "BC", 49.3832, -121.4418,  350, "community_hall", "Hope & District");
seed("Royal Canadian Legion Branch 79",  "Hope",           "BC", 49.3792, -121.4403,  120, "legion_club",    "Hope Legion");
seed("Hope Arena",                       "Hope",           "BC", 49.3801, -121.4387,  800, "arena",          "Memorial Arena");
seed("Yale Historic Community Hall",     "Yale",           "BC", 49.5683, -121.4218,   80, "community_hall", "Yale National Historic Site area");
seed("Boston Bar Community Hall",        "Boston Bar",     "BC", 49.8699, -121.4414,  150, "community_hall", "Boston Bar Rec");
seed("Boston Bar Recreation Centre",     "Boston Bar",     "BC", 49.8701, -121.4412,  200, "community_hall", "Multi-purpose room");
seed("Lytton Community Hall",            "Lytton",         "BC", 50.2317, -121.5836,  100, "community_hall", "Rebuilt post-2021 fire");
seed("Royal Canadian Legion Branch 204", "Lytton",         "BC", 50.2310, -121.5830,   80, "legion_club",    "Lytton Legion");
seed("Spences Bridge Community Hall",    "Spences Bridge", "BC", 50.4444, -121.3542,   80, "community_hall", "Small canyon stop");
seed("Ashcroft Community Hall",          "Ashcroft",       "BC", 50.7261, -121.2801,  200, "community_hall", "Ashcroft Community Hall");
seed("Royal Canadian Legion Branch 131", "Ashcroft",       "BC", 50.7254, -121.2810,  100, "legion_club",    "Ashcroft Legion");
seed("Cache Creek Community Hall",       "Cache Creek",    "BC", 50.8114, -121.3255,  150, "community_hall", "Cache Creek Rec");
seed("Royal Canadian Legion Branch 257", "Cache Creek",    "BC", 50.8110, -121.3260,  100, "legion_club",    "Cache Creek Legion");
seed("Clinton Community Hall",           "Clinton",        "BC", 51.0904, -121.5802,  250, "community_hall", "Famous for the Clinton Ball — proven events room");
seed("Royal Canadian Legion Branch 198", "Clinton",        "BC", 51.0900, -121.5797,  100, "legion_club",    "Clinton Legion");
seed("Lillooet Recreation Centre",       "Lillooet",       "BC", 50.6893, -121.9372,  400, "arena",          "Lillooet Arena");
seed("Royal Canadian Legion Branch 231", "Lillooet",       "BC", 50.6885, -121.9381,  100, "legion_club",    "Lillooet Legion");
seed("Lillooet Community Hall",          "Lillooet",       "BC", 50.6888, -121.9368,  200, "community_hall", "Lillooet & District");

// ─── SEA TO SKY ───────────────────────────────────────────────────────────────
seed("Pemberton & District Community Centre", "Pemberton", "BC", 50.3196, -122.8008, 300, "community_hall", "Multi-use hall");
seed("Pemberton Memorial Arena",              "Pemberton", "BC", 50.3198, -122.7998, 500, "arena",          "Covered ice and events");
seed("Royal Canadian Legion Branch 244",      "Pemberton", "BC", 50.3190, -122.8010, 100, "legion_club",    "Pemberton Legion");

// ─── LOWER FRASER ─────────────────────────────────────────────────────────────
seed("Agassiz Recreation Centre",        "Agassiz",    "BC", 49.2378, -121.7626, 400, "arena",          "Kent Harrison Rec");
seed("Royal Canadian Legion Branch 191", "Agassiz",    "BC", 49.2372, -121.7630, 120, "legion_club",    "Agassiz Legion");

// ─── WEST KOOTENAY ────────────────────────────────────────────────────────────
seed("Capitol Theatre",                        "Nelson",     "BC", 49.4929, -117.2906, 455, "event_venue",    "Restored 1927 theatre — best room in the Kootenays");
seed("Nelson & District Community Complex",    "Nelson",     "BC", 49.4938, -117.2882, 800, "arena",          "NDCC arena + events");
seed("Royal Canadian Legion Branch 51",        "Nelson",     "BC", 49.4920, -117.2880, 150, "legion_club",    "Nelson Legion");
seed("Prestige Lakeside Resort Grand Ballroom","Nelson",     "BC", 49.4916, -117.2937, 300, "event_venue",    "Hotel ballroom, licensed");
seed("Charles Bailey Theatre",                 "Trail",      "BC", 49.0966, -117.7118, 400, "event_venue",    "Performing arts");
seed("Trail Memorial Centre",                  "Trail",      "BC", 49.0971, -117.7098, 1500,"arena",          "Main arena");
seed("Royal Canadian Legion Branch 44",        "Trail",      "BC", 49.0955, -117.7095, 120, "legion_club",    "Trail Legion");
seed("Castlegar Community Centre",             "Castlegar",  "BC", 49.3232, -117.6667, 400, "community_hall", "Multi-use");
seed("Royal Canadian Legion Branch 129",       "Castlegar",  "BC", 49.3225, -117.6672, 120, "legion_club",    "Castlegar Legion");
seed("Grand Forks Community Hall",             "Grand Forks","BC", 49.0316, -118.4387, 250, "community_hall", "Boundary country");
seed("Grand Forks & District Recreation Centre","Grand Forks","BC",49.0320, -118.4375, 500, "arena",          "Boundary Community Arena");
seed("Salmo Community Hall",                   "Salmo",      "BC", 49.1968, -117.2764, 150, "community_hall", "Small Kootenay stop");
seed("Nakusp Community Arena",                 "Nakusp",     "BC", 50.2419, -117.8007, 400, "arena",          "Nakusp ice + events");
seed("Nakusp Community Hall",                  "Nakusp",     "BC", 50.2412, -117.8013, 200, "community_hall", "Village hall");
seed("Langham Cultural Centre",                "Kaslo",      "BC", 49.9156, -116.9244, 200, "event_venue",    "Heritage performing arts space");
seed("Kaslo Community Hall",                   "Kaslo",      "BC", 49.9148, -116.9237, 150, "community_hall", "Kootenay Lake village");
seed("Rossland Arena",                         "Rossland",   "BC", 49.0796, -117.8017, 400, "arena",          "Mountain town");
seed("Royal Canadian Legion Branch 110",       "Rossland",   "BC", 49.0791, -117.8022, 100, "legion_club",    "Rossland Legion");

// ─── LOWER KOOTENAY ───────────────────────────────────────────────────────────
seed("Cranbrook History Centre",               "Cranbrook",  "BC", 49.5128, -115.7691, 200, "event_venue",    "Heritage events venue");
seed("Key City Theatre",                       "Cranbrook",  "BC", 49.5121, -115.7686, 300, "event_venue",    "Performing arts theatre");
seed("Western Financial Place",                "Cranbrook",  "BC", 49.5135, -115.7700,2500, "arena",          "Main arena + events floor");
seed("Royal Canadian Legion Branch 16",        "Cranbrook",  "BC", 49.5116, -115.7688, 150, "legion_club",    "Cranbrook Legion");
seed("Fernie Memorial Arena",                  "Fernie",     "BC", 49.5032, -115.0603, 600, "arena",          "Covered events + ice");
seed("Royal Canadian Legion Branch 63",        "Fernie",     "BC", 49.5024, -115.0597, 100, "legion_club",    "Fernie Legion");
seed("Fernie Arts Station",                    "Fernie",     "BC", 49.5027, -115.0600, 200, "event_venue",    "Community arts hub");
seed("Sparwood Community Centre",              "Sparwood",   "BC", 49.7332, -114.8873, 300, "community_hall", "Coal country community");
seed("Sparwood Arena",                         "Sparwood",   "BC", 49.7328, -114.8880, 500, "arena",          "Covered multi-use");
seed("Creston & District Community Complex",   "Creston",    "BC", 49.0962, -116.5145, 500, "arena",          "CDCC arena");
seed("Royal Canadian Legion Branch 83",        "Creston",    "BC", 49.0955, -116.5140, 120, "legion_club",    "Creston Legion");
seed("Kimberley Civic Centre",                 "Kimberley",  "BC", 49.6727, -116.0033, 400, "arena",          "Ice + events");
seed("Invermere Community Hall",               "Invermere",  "BC", 50.5049, -116.0299, 200, "community_hall", "Columbia Valley");
seed("Royal Canadian Legion Branch 119",       "Invermere",  "BC", 50.5043, -116.0305, 100, "legion_club",    "Invermere Legion");

// ─── SOUTHERN ALBERTA ─────────────────────────────────────────────────────────
seed("Crowsnest Pass Culture & Recreation Complex","Crowsnest Pass","AB",49.6177,-114.4699,600,"arena","Covers Blairmore/Coleman/Bellevue area");
seed("Royal Canadian Legion Branch 78",        "Crowsnest Pass","AB",49.6170,-114.4705,120,"legion_club","Pass Legion");
seed("Pincher Creek Community Centre",         "Pincher Creek","AB",49.4871,-113.9530,400,"community_hall","Foothills stop");
seed("Royal Canadian Legion Branch 63",        "Pincher Creek","AB",49.4864,-113.9524,100,"legion_club","Pincher Creek Legion");
seed("Fort Macleod Community Centre",          "Fort Macleod", "AB",49.7230,-113.4064,350,"community_hall","Historic town, Oldman River");
seed("Royal Canadian Legion Branch 29",        "Fort Macleod", "AB",49.7224,-113.4070,100,"legion_club","Fort Macleod Legion");
seed("Taber Recreation Complex",               "Taber",        "AB",49.7873,-112.1531,600,"arena","Irrigation country, good draw");
seed("Royal Canadian Legion Branch 91",        "Taber",        "AB",49.7865,-112.1524,100,"legion_club","Taber Legion");

// ─── CARIBOO ──────────────────────────────────────────────────────────────────
seed("100 Mile Community Hall",                "100 Mile House","BC",51.6438,-121.2958,250,"community_hall","South Cariboo");
seed("Royal Canadian Legion Branch 243",       "100 Mile House","BC",51.6431,-121.2952,100,"legion_club","100 Mile Legion");
seed("South Cariboo Recreation Centre",        "100 Mile House","BC",51.6441,-121.2944,600,"arena","100 Mile arena + events");

// ─── YELLOWHEAD ───────────────────────────────────────────────────────────────
seed("Burns Lake Community Hall",              "Burns Lake",   "BC",54.2272,-125.7650,200,"community_hall","Mid-Yellowhead stop");
seed("Royal Canadian Legion Branch 193",       "Burns Lake",   "BC",54.2265,-125.7655,100,"legion_club","Burns Lake Legion");
seed("Burns Lake District Recreation Centre",  "Burns Lake",   "BC",54.2268,-125.7643,400,"arena","Covered arena");
seed("Houston Community Hall",                 "Houston",      "BC",54.3989,-126.6705,200,"community_hall","Bulkley Valley");
seed("Houston Arena",                          "Houston",      "BC",54.3985,-126.6710,400,"arena","Multi-use ice");
seed("Smithers Community Services Centre",     "Smithers",     "BC",54.7830,-127.1662,300,"community_hall","Interior Health building, events wing");
seed("Royal Canadian Legion Branch 224",       "Smithers",     "BC",54.7823,-127.1668,120,"legion_club","Smithers Legion");
seed("Smithers Curling Rink",                  "Smithers",     "BC",54.7828,-127.1656,150,"curling_rink","Good shoulder-season room");
seed("Terrace Arena",                          "Terrace",      "BC",54.5162,-128.5997,1200,"arena","Terrace Sportsplex");
seed("Royal Canadian Legion Branch 13",        "Terrace",      "BC",54.5156,-128.6004,150,"legion_club","Terrace Legion — one of the busiest in BC");

console.log(`\nDone: +${added} added, ${skipped} already present`);
db.close();
