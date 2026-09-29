// Pacific corridor venue sweep — Big Bear → I-5 → Seattle → (BC) → Alaska.
// Pulls real small rooms (bars/pubs/nightclubs/music venues) from OpenStreetMap
// per corridor city and lands them as UNCLAIMED 'sample' listings — free
// presence until the club claims it. Majors are naturally excluded: arenas &
// theatres aren't tagged amenity=bar/pub/nightclub.
//
//   node scripts/seed-pacific-corridor.mjs            # all corridor cities
//   node scripts/seed-pacific-corridor.mjs seattle    # just one (name match)
//
// Be polite to Overpass: one request per city, 2s gap, ~300 results cap each.
import Database from "better-sqlite3";
import path from "node:path";

const CITIES = [
  // slug-of-hub, city, state, lat, lng, radius(deg)
  ["socal-mountains","Big Bear Lake","CA",34.2439,-116.9114,0.15],
  ["socal-mountains","Lake Arrowhead","CA",34.2483,-117.1892,0.12],
  ["socal-mountains","Idyllwild","CA",33.7405,-116.7189,0.12],
  ["socal-mountains","Riverside","CA",33.9806,-117.3755,0.15],
  ["socal-mountains","San Bernardino","CA",34.1083,-117.2898,0.15],
  ["central-valley","Bakersfield","CA",35.3733,-119.0187,0.15],
  ["central-valley","Fresno","CA",36.7468,-119.7726,0.15],
  ["central-valley","Modesto","CA",37.6391,-120.9969,0.12],
  ["central-valley","Stockton","CA",37.9577,-121.2908,0.12],
  ["norcal","Sacramento","CA",38.5816,-121.4944,0.18],
  ["norcal","Chico","CA",39.7285,-121.8375,0.12],
  ["norcal","Redding","CA",40.5865,-122.3917,0.12],
  ["oregon-i5","Ashland","OR",42.1946,-122.7095,0.10],
  ["oregon-i5","Medford","OR",42.3265,-122.8756,0.12],
  ["oregon-i5","Eugene","OR",44.0521,-123.0868,0.15],
  ["oregon-i5","Salem","OR",44.9429,-123.0351,0.12],
  ["oregon-i5","Portland","OR",45.5152,-122.6784,0.20],
  ["puget-sound","Olympia","WA",47.0379,-122.9007,0.12],
  ["puget-sound","Tacoma","WA",47.2529,-122.4443,0.14],
  ["puget-sound","Seattle","WA",47.6062,-122.3321,0.22],
  ["puget-sound","Everett","WA",47.9790,-122.2021,0.12],
  ["puget-sound","Bellingham","WA",48.7519,-122.4787,0.12],
  ["alaska-se","Juneau","AK",58.3019,-134.4197,0.20],
  ["alaska-se","Anchorage","AK",61.2181,-149.9003,0.25],
  ["alaska-se","Fairbanks","AK",64.8378,-147.7164,0.20],
];

const args = process.argv.slice(2);
const HOTELS = args.includes("--hotels");
const filter = (args.find(a => !a.startsWith("--")) || "").toLowerCase();
const db = new Database(path.join(process.cwd(), "data", "roadie.db"));
db.pragma("journal_mode = WAL");
// hotel columns may predate app boot — make them exist for --hotels runs
for (const col of ["member_status TEXT DEFAULT 'member'","lat REAL","lng REAL","booking_url TEXT","affiliate_code TEXT","band_rate TEXT","user_id INTEGER","hub_id INTEGER"]) {
  try { db.exec(`ALTER TABLE sponsors ADD COLUMN ${col}`); } catch {}
}
const hubId = db.prepare("SELECT id FROM hubs WHERE slug=?");
const seen  = db.prepare("SELECT 1 FROM venues WHERE name=? AND city=?");
const seenH = db.prepare("SELECT 1 FROM sponsors WHERE name=? AND city=? AND kind='hotel'");
const insH  = db.prepare(`INSERT INTO sponsors(name,kind,city,region,contact,member_status,lat,lng,booking_url,hub_id)
  VALUES(?,?,?,?,?,'sample',?,?,?,?)`);
const ins   = db.prepare(`INSERT INTO venues(name,city,region,lat,lng,genres,contact,pay_model,notes,member_status,hub_id)
  VALUES(?,?,?,?,?,?,?,?,?,'sample',?)`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let grand = 0;

for (const [slug, city, state, lat, lng, r] of CITIES) {
  if (filter && !city.toLowerCase().includes(filter) && slug !== filter) continue;
  const hub = hubId.get(slug)?.id ?? null;
  const bbox = `${lat-r},${lng-r},${lat+r},${lng+r}`;
  const q = HOTELS
    ? `[out:json][timeout:60];(node["tourism"~"hotel|motel|guest_house"](${bbox});way["tourism"~"hotel|motel|guest_house"](${bbox}););out center 300;`
    : `[out:json][timeout:60];(node["amenity"~"events_venue|community_centre|theatre|exhibition_centre"](${bbox});way["amenity"~"events_venue|community_centre|theatre|exhibition_centre"](${bbox});node["leisure"~"stadium|sports_centre|park"](${bbox});way["leisure"~"stadium|sports_centre|park"](${bbox});way["landuse"="recreation_ground"](${bbox}););out center 300;`;
  process.stdout.write(`${city}, ${state} … `);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
    const d = await res.json();
    let added = 0;
    for (const el of d.elements || []) {
      const t = el.tags || {}; const name = t.name; if (!name) continue;
      const vlat = el.lat || el.center?.lat, vlng = el.lon || el.center?.lon; if (!vlat) continue;
      const vcity = t["addr:city"] || city;
      const contact = t.website || t.phone || t.email || "";
      if (HOTELS) {
        if (seenH.get(name, vcity)) continue;
        insH.run(name, "hotel", vcity, state, contact, vlat, vlng, t.website || null, hub);
        added++;
      } else {
        if (seen.get(name, vcity)) continue;
        const live = t.live_music === "yes";
        ins.run(name, vcity, state, vlat, vlng, live ? "live" : "", contact, "door_split",
          `imported from OpenStreetMap${live ? " (live music tagged)" : ""}`, hub);
        added++;
      }
    }
    grand += added;
    console.log(`+${added}`);
  } catch (e) { console.log(`FAILED (${e.message}) — continuing`); }
  await sleep(2000);
}
console.log(`\nDone: ${grand} corridor ${HOTELS ? "hotels" : "venues"} imported as claimable temp listings.`);
