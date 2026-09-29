// Import candidate host sites from OpenStreetMap (Overpass API) into venues.
//
// The ring needs GROUND, not a bar. In a corridor town the room that holds a
// crowd is the Legion, the community hall, the fire hall, the curling rink, the
// arena, the bingo hall or the ball field — and the old selector list asked for
// none of them. That is why Ashcroft, Cache Creek, Lytton, Boston Bar, Yale,
// Nelson, Castlegar, Trail, Sparwood, Pincher Creek and Lethbridge all came
// back with ZERO rooms while Whistler returned 18: the towns aren't empty, the
// query was.
//
//   node scripts/import-osm-venues.mjs <preset|bbox> [region] [country]
//
//   node scripts/import-osm-venues.mjs fraser-canyon
//   node scripts/import-osm-venues.mjs lower-kootenay
//   node scripts/import-osm-venues.mjs southern-alberta
//   node scripts/import-osm-venues.mjs "49.82,-119.62,49.95,-119.35" BC CA
//
// Run it where the network reaches Overpass AND the db is local — on the NAS:
//   docker exec roadie-web node scripts/import-osm-venues.mjs fraser-canyon
// Never run it against data/roadie.db over an SMB share while the container has
// it open; SQLite locking over SMB can corrupt the file.
import Database from "better-sqlite3";
import path from "node:path";

// Corridor presets — the legs the ring actually needs, as minLat,minLng,maxLat,maxLng.
const PRESETS = {
  "fraser-canyon":    { bbox: "49.30,-122.10,51.00,-121.00", region: "BC", country: "CA",
                        note: "Hope · Yale · Boston Bar · Lytton · Spences Bridge · Ashcroft · Cache Creek · Clinton · Lillooet" },
  "sea-to-sky":       { bbox: "49.60,-123.40,50.60,-122.40", region: "BC", country: "CA",
                        note: "Squamish · Whistler · Pemberton" },
  "lower-fraser":     { bbox: "49.00,-122.80,49.45,-121.30", region: "BC", country: "CA",
                        note: "Maple Ridge · Langley · Abbotsford · Mission · Chilliwack · Agassiz · Hope" },
  "west-kootenay":    { bbox: "49.00,-118.40,50.40,-116.80", region: "BC", country: "CA",
                        note: "Nelson · Castlegar · Trail · Rossland · Salmo · Nakusp · Kaslo · Grand Forks" },
  "lower-kootenay":   { bbox: "49.00,-117.00,50.20,-114.90", region: "BC", country: "CA",
                        note: "Creston · Cranbrook · Kimberley · Fernie · Sparwood · Elkford · Invermere" },
  "southern-alberta": { bbox: "49.00,-114.60,50.60,-110.00", region: "AB", country: "CA",
                        note: "Crowsnest Pass · Pincher Creek · Fort Macleod · Lethbridge · Taber · Medicine Hat" },
  "cariboo":          { bbox: "51.40,-122.60,53.20,-121.20", region: "BC", country: "CA",
                        note: "Clinton · 100 Mile House · Williams Lake · Quesnel" },
  "yellowhead":       { bbox: "53.50,-128.00,56.00,-122.00", region: "BC", country: "CA",
                        note: "Smithers · Terrace · Prince Rupert · Burns Lake · Houston" },
};

const [arg, regionArg, countryArg] = process.argv.slice(2);
if (!arg) {
  console.error("usage: node scripts/import-osm-venues.mjs <preset|minLat,minLng,maxLat,maxLng> [region] [country]");
  console.error("presets: " + Object.keys(PRESETS).join(", "));
  process.exit(1);
}
const preset = PRESETS[arg];
const bbox = preset ? preset.bbox : arg;
const region = regionArg || preset?.region || "BC";
const country = countryArg || preset?.country || "CA";
if (preset) console.log(`preset ${arg} — ${preset.note}`);

// What a small town actually offers as a room. Each entry carries the site kind
// we store in `genres` so the console can tell a curling rink from a theatre.
const SELECTORS = [
  // purpose-built
  '["amenity"~"events_venue|theatre|exhibition_centre|arts_centre|nightclub"]["name"]',
  // the heart of a corridor town
  '["amenity"="community_centre"]["name"]',
  '["amenity"="village_hall"]["name"]',
  // Legions and service clubs. A bare ["club"] pulled in care homes, transit
  // charities and a government ministry office, so restrict to the club types
  // that actually have a hall.
  '["club"~"veterans|social|sport|music|scout|automobile|fishing|hunting"]["name"]',
  // fire halls double as the hall in a lot of these towns
  '["amenity"="fire_station"]["name"]',
  // bingo / gaming rooms
  '["amenity"="gambling"]["name"]',
  // ice, curling, arena
  '["leisure"="ice_rink"]["name"]',
  '["sport"="curling"]["name"]',
  '["leisure"="sports_centre"]["name"]',
  '["leisure"="stadium"]["name"]',
  // open ground — fields and fairgrounds
  '["leisure"="pitch"]["sport"~"soccer|football"]["name"]',
  '["landuse"="recreation_ground"]["name"]',
];

// Chamber of Commerce — not a room, the town's front door. Every town has one
// and it is the single best contact for landing a host and local sponsors, so
// these go to `contacts` as role='chamber_of_commerce', never to `venues`.
const CHAMBER_SELECTORS = [
  '["office"="chamber_of_commerce"]["name"]',
  '["office"="association"]["name"~"Chamber|Commerce|Tourism|Visitor",i]',
  '["tourism"="information"]["name"~"Chamber|Visitor Centre|Visitor Center",i]',
];

// Names that are obviously not a room even when the tag says club/hall.
const NOT_A_ROOM = /(ministry|transit|manor|housing|hospice|daycare|child care|thrift|food bank|ambulance|rcmp|police|detachment|cemetery|kennel|soaring|yacht|golf)/i;

// Overpass rejects a request with no User-Agent (406) and times out (504) when
// a dozen selectors are crammed into one call, so: identify ourselves, POST the
// query, and go in small batches with backoff.
const UA = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "ROADIE-venue-import/1.0 (roadie.mymymy.studio)",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The main instance 504s and 429s under load, which would silently return zero
// rooms and look like "this town has nothing". Rotate mirrors and back off.
// GLOBAL mirrors only. overpass.osm.ch is a Switzerland-only instance: it
// answers 200 with zero elements for a BC bbox, which reads as "this town has
// no rooms" instead of as an error — the most dangerous possible failure here.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
async function overpass(selectors) {
  const q = `[out:json][timeout:180];(` +
    selectors.map((s) => `node${s}(${bbox});way${s}(${bbox});`).join("") + `);out center 800;`;
  for (let attempt = 1; attempt <= MIRRORS.length * 2; attempt++) {
    const url = MIRRORS[(attempt - 1) % MIRRORS.length];
    try {
      const r = await fetch(url, { method: "POST", headers: UA, body: "data=" + encodeURIComponent(q) });
      if (r.ok) return (await r.json()).elements || [];
      console.log(`  ${new URL(url).host} → ${r.status} (attempt ${attempt})`);
    } catch (e) {
      console.log(`  ${new URL(url).host} → ${e.message} (attempt ${attempt})`);
    }
    await sleep(attempt <= MIRRORS.length ? 5000 : 45000);
  }
  console.log("  !! all overpass mirrors failed for this batch — rerun later, nothing was lost");
  return [];
}
function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }

const dbPath = path.join(process.cwd(), "data", "roadie.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Which selector matched, so we can label the site kind.
function kindOf(t) {
  if (t.club || t.amenity === "social_facility") return "legion_club";
  if (t.amenity === "fire_station") return "fire_hall";
  if (t.amenity === "gambling") return "bingo_hall";
  if (t.sport === "curling") return "curling_rink";
  if (t.leisure === "ice_rink") return "arena";
  if (t.leisure === "sports_centre" || t.leisure === "stadium") return "arena";
  if (t.leisure === "pitch") return "field";
  if (t.leisure === "park") return "park";
  if (t.landuse === "recreation_ground") return "fairground";
  if (t.amenity === "community_centre" || t.amenity === "village_hall" || t.building === "civic") return "community_hall";
  return "event_venue";
}
// Dry rooms are the preferred model, so record whether drink is even in play.
const licensedish = (t) => !!(t.amenity === "bar" || t.amenity === "pub" || t.amenity === "nightclub" || t.alcohol === "yes");

// Only ~1 in 6 OSM sites out here carries addr:city, and the old code wrote the
// REGION into the city column when it was missing — producing venues in a town
// called "BC". Dropping them instead would have thrown away Yale Brownie Hall
// and Boston Bar Community Hall, exactly the rooms the ring needs. So: snap to
// the nearest gazetteer town within 25km.
const TOWNS = [];
{
  const src = await import("../lib/geocode.ts").catch(() => null);
  if (src?.CITY_TABLE) for (const [n, v] of Object.entries(src.CITY_TABLE)) TOWNS.push({ name: n, lat: v[0], lng: v[1], region: v[2] });
}
if (!TOWNS.length) {
  // geocode.ts is TypeScript and can't always be imported from a plain .mjs;
  // fall back to the towns already present in the db, which is the same data.
  for (const row of db.prepare("SELECT DISTINCT city, region, AVG(lat) lat, AVG(lng) lng FROM venues WHERE lat IS NOT NULL AND city<>'' GROUP BY city").all())
    TOWNS.push({ name: row.city, lat: row.lat, lng: row.lng, region: row.region });
}
const km = (aLat, aLng, bLat, bLng) => {
  const R = Math.PI / 180, dLat = (bLat - aLat) * R, dLng = (bLng - aLng) * R;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
};
function nearestTown(lat, lng) {
  let best = null, bestKm = Infinity;
  for (const t of TOWNS) { const d = km(lat, lng, t.lat, t.lng); if (d < bestKm) { bestKm = d; best = t; } }
  return bestKm <= 25 ? best : null;
}

const ins = db.prepare(`INSERT INTO venues(name,city,region,lat,lng,genres,contact,pay_model,notes,member_status)
  VALUES(?,?,?,?,?,?,?,'door_split',?, 'sample')`);
const seen = db.prepare("SELECT 1 FROM venues WHERE name=? AND city=?");

console.log(`Querying Overpass for ${bbox} …`);
let added = 0, skipped = 0, nocity = 0, junk = 0, snapped = 0;
const byKind = {};
for (const batch of chunk(SELECTORS, 4)) {
  for (const el of await overpass(batch)) {
    const t = el.tags || {};
    const name = t.name; if (!name) continue;
    if (NOT_A_ROOM.test(name)) { junk++; continue; }
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    let city = t["addr:city"] || t["addr:town"] || t["addr:village"] || t["is_in:city"] || "";
    if (!city) { const near = nearestTown(lat, lng); if (near) { city = near.name; snapped++; } }
    if (!city) { nocity++; continue; }
    if (seen.get(name, city)) { skipped++; continue; }
    const kind = kindOf(t);
    const contact = t.website || t.phone || t.email || t["contact:website"] || t["contact:phone"] || "";
    const note = `imported from OpenStreetMap · ${kind}${licensedish(t) ? " · licensed" : " · dry/unknown"}`;
    ins.run(name, city, region, lat, lng, kind, contact, note);
    added++; byKind[kind] = (byKind[kind] || 0) + 1;
  }
  await sleep(8000);
}

// Chambers of commerce → contacts, the town's front door for host + sponsor outreach.
let chambers = 0;
try {
  db.exec(`CREATE TABLE IF NOT EXISTS contacts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT, city TEXT, region TEXT,
    website TEXT, phone TEXT, email TEXT, lat REAL, lng REAL, notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  try { db.exec("ALTER TABLE contacts ADD COLUMN city TEXT"); } catch {}
  try { db.exec("ALTER TABLE contacts ADD COLUMN region TEXT"); } catch {}
  try { db.exec("ALTER TABLE contacts ADD COLUMN lat REAL"); } catch {}
  try { db.exec("ALTER TABLE contacts ADD COLUMN lng REAL"); } catch {}
  const cIns = db.prepare(`INSERT INTO contacts(name,role,city,region,website,phone,email,lat,lng,notes)
    VALUES(?,'chamber_of_commerce',?,?,?,?,?,?,?,'imported from OpenStreetMap')`);
  const cSeen = db.prepare("SELECT 1 FROM contacts WHERE name=? AND role='chamber_of_commerce'");
  for (const el of await overpass(CHAMBER_SELECTORS)) {
    const t = el.tags || {}; const name = t.name; if (!name) continue;
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    if (cSeen.get(name)) continue;
    let city = t["addr:city"] || t["addr:town"] || t["addr:village"] || "";
    if (!city) { const near = nearestTown(lat, lng); if (near) city = near.name; }
    cIns.run(name, city, region, t.website || t["contact:website"] || "", t.phone || t["contact:phone"] || "", t.email || "", lat, lng);
    chambers++;
  }
} catch (e) { console.log("chamber import skipped:", e.message); }

console.log(`\nAdded ${added} venues · ${snapped} snapped to nearest town · already had ${skipped}`);
console.log(`Rejected ${junk} non-rooms (ministries, transit, care homes) · ${nocity} with no town within 25km`);
console.log("by kind: " + (Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ") || "(none)"));
console.log(`Chambers of commerce added to contacts: ${chambers}`);
console.log(`db: ${dbPath} (region ${region}/${country})`);
console.log("hub_id is left NULL on purpose — ensureHubSchema() assigns it from the coordinates on next boot.");
