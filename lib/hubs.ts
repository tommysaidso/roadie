// Hub registry — the operational unit of ROADIE's Canada expansion.
// A hub = a city scene: map center/box, runout loop, rules region, tagline,
// match-distance tuning. A province can host multiple hubs (BC Interior and
// Vancouver Island are different loops in the same rules region).
import { getDb, one, all, run } from "./db";
import { geocodeCity } from "./geocode";
import { haversineKm } from "./geo";

export type Hub = {
  id: number; slug: string; name: string; country: string; province: string;
  center_lat: number; center_lng: number; default_zoom: number;
  bbox_min_lat: number; bbox_max_lat: number; bbox_min_lng: number; bbox_max_lng: number;
  loop_cities: string;      // JSON array, ordered
  rules_region: string; timezone: string; tagline: string;
  local_km: number; runout_km: number; live: number;
};

const SEED_HUBS = [
  // bbox_min_lat was 49.2, which cut the floor straight through the ring: the
  // whole Langley/Abbotsford/Chilliwack/Mission block (lat 49.00-49.19) and
  // Osoyoos (49.03) fell into NO hub at all — 100+ venues on the map belonging
  // to nothing, in exactly the corridor the ring strategy runs on. 48.95 picks
  // them up. The lng range is untouched, so this adds nothing to the west.
  { slug:"kelowna", name:"Kelowna Hub", province:"BC", center_lat:49.888, center_lng:-119.496, default_zoom:8,
    bbox_min_lat:48.95, bbox_max_lat:54.3, bbox_min_lng:-123.2, bbox_max_lng:-116.5,
    loop_cities:'["Kelowna","Vernon","Kamloops","Penticton"]', rules_region:"BC",
    timezone:"America/Vancouver", tagline:"interior / north BC", local_km:60, runout_km:260, live:1 },
  // The Fraser ring: up the canyon from the valley, or round via Sea-to-Sky,
  // meeting the Interior ring at the Ashcroft / Cache Creek junction. These 154
  // rooms were all filed as "Kelowna" because they fall inside its box, which
  // hid the fact that they are a separate route with its own arc.
  { slug:"fraser", name:"Fraser Ring", province:"BC", center_lat:50.00, center_lng:-122.20, default_zoom:7,
    bbox_min_lat:49.00, bbox_max_lat:52.60, bbox_min_lng:-123.40, bbox_max_lng:-121.20,
    loop_cities:'["Langley","Maple Ridge","Pitt Meadows","Abbotsford","Mission","Chilliwack","Agassiz","Hope","Yale","Boston Bar","Lytton","Spences Bridge","Ashcroft","Cache Creek","Clinton","Lillooet","Pemberton","Whistler","Squamish","100 Mile House","Williams Lake"]',
    rules_region:"BC", timezone:"America/Vancouver", tagline:"Fraser canyon, Sea-to-Sky & the valley",
    local_km:70, runout_km:400, live:0 },
  // Lower Kootenay, running east over Crowsnest toward Alberta.
  { slug:"kootenay", name:"Kootenay Ring", province:"BC", center_lat:49.70, center_lng:-116.50, default_zoom:7,
    bbox_min_lat:48.99, bbox_max_lat:51.60, bbox_min_lng:-118.40, bbox_max_lng:-114.90,
    loop_cities:'["Nelson","Castlegar","Trail","Rossland","Salmo","Creston","Cranbrook","Kimberley","Fernie","Sparwood","Elkford","Invermere","Golden","Revelstoke","Grand Forks","Christina Lake","Kaslo","Nakusp"]',
    rules_region:"BC", timezone:"America/Vancouver", tagline:"Kootenay & Columbia",
    local_km:90, runout_km:450, live:0 },
  // Southern Alberta — the Crowsnest landing and the Chinook belt. Currently
  // ONE venue (Okotoks): Lethbridge and Medicine Hat were never scraped.
  { slug:"southern-alberta", name:"Chinook Ring", province:"AB", center_lat:49.90, center_lng:-112.80, default_zoom:7,
    bbox_min_lat:48.99, bbox_max_lat:51.00, bbox_min_lng:-114.60, bbox_max_lng:-110.00,
    loop_cities:'["Crowsnest Pass","Blairmore","Coleman","Pincher Creek","Fort Macleod","Lethbridge","Taber","Claresholm","High River","Okotoks","Medicine Hat"]',
    rules_region:"AB", timezone:"America/Edmonton", tagline:"Crowsnest & the Chinook belt",
    local_km:100, runout_km:500, live:0 },
  // Highway 16 west of Prince George — Vanderhoof, Houston, Smithers, Terrace,
  // Kitimat, Prince Rupert. These 14 rooms were the last venues on the platform
  // belonging to no hub at all: west of Kelowna's -123.2 line and north of the
  // Island box. They are a contiguous corridor, not strays, so they get their
  // own ring rather than being stretched into somebody else's. Seeded live:0 —
  // it's mapped and assignable, not an active ring until you say so.
  // max_lng -123.0 deliberately stops short of Prince George (-122.75), which
  // stays Kelowna's gateway city.
  { slug:"yellowhead", name:"Yellowhead Hub", province:"BC", center_lat:54.51, center_lng:-127.30, default_zoom:7,
    bbox_min_lat:53.0, bbox_max_lat:56.0, bbox_min_lng:-131.5, bbox_max_lng:-123.0,
    loop_cities:'["Vanderhoof","Houston","Smithers","Terrace","Kitimat","Prince Rupert"]', rules_region:"BC",
    timezone:"America/Vancouver", tagline:"Highway 16 — Yellowhead & north coast", local_km:120, runout_km:700, live:0 },
  { slug:"van-island", name:"Island Hub", province:"BC", center_lat:48.428, center_lng:-123.366, default_zoom:8,
    bbox_min_lat:48.2, bbox_max_lat:50.3, bbox_min_lng:-125.8, bbox_max_lng:-123.0,
    loop_cities:'["Victoria","Nanaimo","Courtenay"]', rules_region:"BC",
    timezone:"America/Vancouver", tagline:"Vancouver Island", local_km:50, runout_km:220, live:0 },
  { slug:"calgary", name:"Calgary Hub", province:"AB", center_lat:51.045, center_lng:-114.072, default_zoom:7,
    bbox_min_lat:49.0, bbox_max_lat:54.5, bbox_min_lng:-116.5, bbox_max_lng:-110.0,
    loop_cities:'["Calgary","Red Deer","Edmonton","Lethbridge"]', rules_region:"AB",
    timezone:"America/Edmonton", tagline:"Alberta corridor", local_km:100, runout_km:600, live:0 },
  { slug:"toronto", name:"Toronto Hub", province:"ON", center_lat:43.653, center_lng:-79.383, default_zoom:8,
    bbox_min_lat:42.0, bbox_max_lat:45.5, bbox_min_lng:-83.5, bbox_max_lng:-75.5,
    loop_cities:'["Toronto","Hamilton","Kitchener","London"]', rules_region:"ON",
    timezone:"America/Toronto", tagline:"southern Ontario", local_km:60, runout_km:260, live:0 },
  { slug:"montreal", name:"Montreal Hub", province:"QC", center_lat:45.502, center_lng:-73.567, default_zoom:8,
    bbox_min_lat:45.0, bbox_max_lat:47.0, bbox_min_lng:-74.5, bbox_max_lng:-70.5,
    loop_cities:'["Montreal","Sherbrooke","Trois-Rivieres","Quebec City"]', rules_region:"QC",
    timezone:"America/Toronto", tagline:"Quebec corridor", local_km:60, runout_km:300, live:0 },
];


// ── Pacific corridor (USA route) ─────────────────────────────────────────────
// Big Bear → I-5 spine → Seattle → (49th parallel: existing BC hubs) → Alaska.
// Small-club focus: OSM imports per hub land as 'sample' temp listings.
const US_CORRIDOR_HUBS = [
  { slug:"socal-mountains", name:"SoCal Mountains Hub", country:"US", province:"CA",
    center_lat:34.244, center_lng:-116.911, default_zoom:8,
    bbox_min_lat:33.4, bbox_max_lat:35.4, bbox_min_lng:-118.7, bbox_max_lng:-116.0,
    loop_cities:'["Big Bear Lake","Lake Arrowhead","Idyllwild","Riverside","San Bernardino"]',
    rules_region:"CA-US", timezone:"America/Los_Angeles", tagline:"Big Bear + inland SoCal", local_km:70, runout_km:300, live:1 },
  { slug:"central-valley", name:"Central Valley Hub", country:"US", province:"CA",
    center_lat:36.746, center_lng:-119.772, default_zoom:7,
    bbox_min_lat:34.9, bbox_max_lat:38.0, bbox_min_lng:-121.5, bbox_max_lng:-118.5,
    loop_cities:'["Bakersfield","Fresno","Modesto","Stockton"]',
    rules_region:"CA-US", timezone:"America/Los_Angeles", tagline:"the 99/I-5 valley run", local_km:80, runout_km:350, live:0 },
  { slug:"norcal", name:"NorCal Hub", country:"US", province:"CA",
    center_lat:38.581, center_lng:-121.494, default_zoom:7,
    bbox_min_lat:37.5, bbox_max_lat:41.0, bbox_min_lng:-123.2, bbox_max_lng:-120.0,
    loop_cities:'["Sacramento","Chico","Redding"]',
    rules_region:"CA-US", timezone:"America/Los_Angeles", tagline:"Sacramento to the Shasta gate", local_km:80, runout_km:350, live:0 },
  { slug:"oregon-i5", name:"Oregon I-5 Hub", country:"US", province:"OR",
    center_lat:44.943, center_lng:-123.035, default_zoom:7,
    bbox_min_lat:42.0, bbox_max_lat:46.0, bbox_min_lng:-124.2, bbox_max_lng:-121.5,
    loop_cities:'["Ashland","Medford","Eugene","Salem","Portland"]',
    rules_region:"OR-US", timezone:"America/Los_Angeles", tagline:"Siskiyou pass to Portland", local_km:80, runout_km:400, live:0 },
  { slug:"puget-sound", name:"Puget Sound Hub", country:"US", province:"WA",
    center_lat:47.606, center_lng:-122.332, default_zoom:8,
    bbox_min_lat:46.0, bbox_max_lat:49.0, bbox_min_lng:-123.5, bbox_max_lng:-120.9,
    loop_cities:'["Olympia","Tacoma","Seattle","Everett","Bellingham"]',
    rules_region:"WA-US", timezone:"America/Los_Angeles", tagline:"Seattle + the sound, up to the 49th", local_km:60, runout_km:280, live:0 },
  { slug:"alaska-se", name:"Alaska Hub", country:"US", province:"AK",
    center_lat:61.218, center_lng:-149.900, default_zoom:6,
    bbox_min_lat:55.0, bbox_max_lat:65.0, bbox_min_lng:-152.0, bbox_max_lng:-130.0,
    loop_cities:'["Juneau","Whitehorse","Fairbanks","Anchorage"]',
    rules_region:"AK-US", timezone:"America/Anchorage", tagline:"the far end of the rim — ferry + AlCan routing", local_km:150, runout_km:900, live:0 },
];

let ensured = false;
export function ensureHubSchema() {
  if (ensured) return;
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS hubs(
    id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, country TEXT DEFAULT 'CA', province TEXT,
    center_lat REAL, center_lng REAL, default_zoom INTEGER DEFAULT 8,
    bbox_min_lat REAL, bbox_max_lat REAL, bbox_min_lng REAL, bbox_max_lng REAL,
    loop_cities TEXT DEFAULT '[]', rules_region TEXT, timezone TEXT, tagline TEXT,
    local_km INTEGER DEFAULT 60, runout_km INTEGER DEFAULT 260, live INTEGER DEFAULT 0)`);
  for (const t of ["bands","venues","sponsors","notices","festivals"]) {
    try { db.exec(`ALTER TABLE ${t} ADD COLUMN hub_id INTEGER`); } catch {}
  }
  // Was gated on `if (COUNT(*) === 0)`, i.e. the Canadian seeds only ever ran
  // against a brand-new database. Adding a ring to SEED_HUBS therefore could
  // NEVER reach production — the Fraser, Kootenay, Chinook and Yellowhead hubs
  // were in the source and absent from the live table. INSERT OR IGNORE is
  // idempotent on the UNIQUE slug, so run it every boot like the US block does.
  {
    const ins = db.prepare(`INSERT OR IGNORE INTO hubs(slug,name,country,province,center_lat,center_lng,default_zoom,
      bbox_min_lat,bbox_max_lat,bbox_min_lng,bbox_max_lng,loop_cities,rules_region,timezone,tagline,local_km,runout_km,live)
      VALUES(@slug,@name,'CA',@province,@center_lat,@center_lng,@default_zoom,
      @bbox_min_lat,@bbox_max_lat,@bbox_min_lng,@bbox_max_lng,@loop_cities,@rules_region,@timezone,@tagline,@local_km,@runout_km,@live)`);
    for (const h of SEED_HUBS) ins.run(h);
  }
  // Pacific corridor hubs: upsert by slug so existing DBs get them too.
  {
    const insUS = db.prepare(`INSERT OR IGNORE INTO hubs(slug,name,country,province,center_lat,center_lng,default_zoom,
      bbox_min_lat,bbox_max_lat,bbox_min_lng,bbox_max_lng,loop_cities,rules_region,timezone,tagline,local_km,runout_km,live)
      VALUES(@slug,@name,@country,@province,@center_lat,@center_lng,@default_zoom,
      @bbox_min_lat,@bbox_max_lat,@bbox_min_lng,@bbox_max_lng,@loop_cities,@rules_region,@timezone,@tagline,@local_km,@runout_km,@live)`);
    for (const h of US_CORRIDOR_HUBS) insUS.run(h);
  }
  // Mark ensured BEFORE the backfill: the backfill calls nearestHubId, which
  // itself guards with ensureHubSchema - without this flag set first, that
  // re-entry recursed forever and crashed the whole server (stack exhaustion
  // inside better-sqlite3). Schema + seeds above are already committed here.
  ensured = true;
  // Seeds insert with INSERT OR IGNORE, so editing a bbox in SEED_HUBS above
  // would never reach a database that already has the row — the geography
  // silently stayed whatever it was on first boot. Make SEED_HUBS the source of
  // truth for hub GEOMETRY (bboxes only; live flags and taglines stay editable
  // in the db) so a corrected boundary actually lands.
  try {
    for (const h of [...SEED_HUBS, ...US_CORRIDOR_HUBS] as any[]) {
      run(`UPDATE hubs SET bbox_min_lat=?, bbox_max_lat=?, bbox_min_lng=?, bbox_max_lng=?,
           center_lat=?, center_lng=?, loop_cities=? WHERE slug=?`,
        h.bbox_min_lat, h.bbox_max_lat, h.bbox_min_lng, h.bbox_max_lng,
        h.center_lat, h.center_lng, h.loop_cities, h.slug);
    }
  } catch {}
  // Backfill. This used to be a blanket `SET hub_id=kelowna WHERE hub_id IS NULL`
  // that ignored coordinates entirely — and since the OSM importer inserts
  // venues with lat/lng but NO hub_id (scripts/import-osm-venues.mjs), every
  // scraped row in the country was stamped Kelowna. 616 of 919 venues ended up
  // on a hub they aren't in, including all 392 Alberta rooms, which then got
  // matched with Kelowna's 260km runout instead of Calgary's 600km and dropped
  // the Calgary-Edmonton corridor out of matching entirely.
  // Coordinates decide the hub; Kelowna is only the last resort for rows that
  // have none yet (the geocode block below fixes those on the same pass).
  const kel = one<any>("SELECT id FROM hubs WHERE slug='kelowna'")?.id ?? 1;
  for (const t of ["bands", "venues", "sponsors", "notices", "festivals"]) {
    try {
      const regCol = t === "bands" ? "home_region" : "region";
      const cityCol = t === "bands" ? "home_city" : "city";
      let rows: any[] = [];
      try { rows = all<any>(`SELECT id, lat, lng, ${regCol} AS region, ${cityCol} AS city FROM ${t} WHERE hub_id IS NULL AND lat IS NOT NULL AND lng IS NOT NULL`); }
      catch { rows = all<any>(`SELECT id, lat, lng, NULL AS region, NULL AS city FROM ${t} WHERE hub_id IS NULL AND lat IS NOT NULL AND lng IS NOT NULL`); }
      for (const r of rows) {
        const hid = hubIdFor(r.lat, r.lng, r.region, r.city);
        if (hid) run(`UPDATE ${t} SET hub_id=? WHERE id=?`, hid, r.id);
      }
      // No coordinates to reason from — park them on the home hub for now.
      run(`UPDATE ${t} SET hub_id=? WHERE hub_id IS NULL`, kel);
    } catch {}
  }
  repairImpossibleHubs();
  try {
    for (const b of all<any>("SELECT id, home_city FROM bands WHERE lat IS NULL AND home_city IS NOT NULL")) {
      const g = geocodeCity(b.home_city);
      if (g.lat) run("UPDATE bands SET lat=?, lng=?, home_region=COALESCE(home_region,?), hub_id=? WHERE id=?",
        g.lat, g.lng, g.region, nearestHubId(g.lat, g.lng) ?? kel, b.id);
    }
    for (const v of all<any>("SELECT id, city FROM venues WHERE lat IS NULL AND city IS NOT NULL")) {
      const g = geocodeCity(v.city);
      if (g.lat) run("UPDATE venues SET lat=?, lng=?, region=COALESCE(region,?), hub_id=? WHERE id=?",
        g.lat, g.lng, g.region, nearestHubId(g.lat, g.lng) ?? kel, v.id);
    }
  } catch {}
}

export function listHubs(liveOnly = false): Hub[] {
  ensureHubSchema();
  return all<Hub>(liveOnly ? "SELECT * FROM hubs WHERE live=1 ORDER BY id" : "SELECT * FROM hubs ORDER BY live DESC, id");
}
export function getHub(slug?: string | null): Hub {
  ensureHubSchema();
  const h = slug ? one<Hub>("SELECT * FROM hubs WHERE slug=?", slug) : null;
  return h || one<Hub>("SELECT * FROM hubs WHERE live=1 ORDER BY id LIMIT 1")!;
}
export function hubLoop(h: Hub): string[] {
  try { const a = JSON.parse(h.loop_cities); return Array.isArray(a) ? a : []; } catch { return []; }
}
/** Hubs whose declared bounding box contains this point. */
function hubsContaining(hubs: Hub[], lat: number, lng: number): Hub[] {
  return hubs.filter(h =>
    lat >= h.bbox_min_lat && lat <= h.bbox_max_lat &&
    lng >= h.bbox_min_lng && lng <= h.bbox_max_lng);
}

/**
 * The hub a point actually belongs to.
 *
 * Bbox first — a hub's box is its declared territory, and nearest-center alone
 * gets this wrong in ways that matter: Seattle's center is closer to Langley
 * than Kelowna's is, so pure distance throws Fraser Valley rooms across the
 * border into Puget Sound. When the row tells us its province we never leave
 * it. Center distance only breaks ties inside the surviving pool (several
 * bboxes overlap — 99 Island rooms sit inside puget-sound's box too).
 */
export function hubIdFor(lat: number, lng: number, region?: string | null, city?: string | null): number | null {
  ensureHubSchema();
  const hubs = all<Hub>("SELECT * FROM hubs");
  const reg = String(region || "").toUpperCase().trim();
  const pools: Hub[][] = [];
  if (reg) pools.push(hubs.filter(h => String(h.province).toUpperCase() === reg));
  pools.push(hubs);
  // A hub's loop_cities is an explicit statement of which towns belong to that
  // ring, so it outranks geometry. Boxes overlap and nest — Langley sits inside
  // Kelowna's box as well as the Fraser ring's — and without this the bigger,
  // older box wins every time and the ring you actually defined never forms.
  const town = String(city || "").toLowerCase().trim();
  if (town) {
    for (const pool of pools) {
      const named = pool.find(h => hubLoop(h).some(c => String(c).toLowerCase().trim() === town));
      if (named) return named.id;
    }
  }
  for (const pool of pools) {
    if (!pool.length) continue;
    const inBox = hubsContaining(pool, lat, lng);
    const cand = inBox.length ? inBox : pool;
    let best: Hub | null = null, bestKm = Infinity;
    for (const h of cand) {
      const km = haversineKm([lat, lng], [h.center_lat, h.center_lng]);
      const eff = h.live ? km : km * 1.5;
      if (eff < bestKm) { bestKm = eff; best = h; }
    }
    if (best) return best.id;
  }
  return null;
}

/**
 * Repair rows whose stored hub is geographically impossible — the point falls
 * outside that hub's box, and there is a hub whose box does contain it.
 *
 * Deliberately conservative. It only moves rows we can PROVE are wrong, so a
 * deliberate assignment is never stomped, and rows in no hub's box at all (the
 * 102 Fraser Valley / northwest-BC venues) are left alone rather than being
 * guessed into the nearest ring — that gap needs a hub, not a silent shove.
 */
export function repairImpossibleHubs(): number {
  const hubs = all<Hub>("SELECT * FROM hubs");
  if (!hubs.length) return 0;
  const byId = new Map(hubs.map(h => [Number(h.id), h]));
  let fixed = 0;
  for (const t of ["bands", "venues", "sponsors", "notices", "festivals"]) {
    const regCol = t === "bands" ? "home_region" : "region";
    const cityCol = t === "bands" ? "home_city" : "city";
    let rows: any[] = [];
    try { rows = all<any>(`SELECT id, lat, lng, hub_id, ${regCol} AS region, ${cityCol} AS city FROM ${t} WHERE lat IS NOT NULL AND lng IS NOT NULL AND hub_id IS NOT NULL`); }
    catch {
      try { rows = all<any>(`SELECT id, lat, lng, hub_id, NULL AS region, NULL AS city FROM ${t} WHERE lat IS NOT NULL AND lng IS NOT NULL AND hub_id IS NOT NULL`); }
      catch { continue; }
    }
    for (const r of rows) {
      const cur = byId.get(Number(r.hub_id));
      const want = hubIdFor(r.lat, r.lng, r.region, r.city);
      if (!want || Number(want) === Number(r.hub_id)) continue;
      const target = byId.get(Number(want));
      if (!target) continue;
      // Two independent grounds to move, and the first one matters most: boxes
      // NEST. Langley sits inside Kelowna's box as well as the Fraser ring's, so
      // "is the current hub geometrically plausible?" is true for every Fraser,
      // Sea-to-Sky and Cariboo room — and gating on that alone left all 154 of
      // them filed under Kelowna even after the ring existed. A hub that NAMES
      // the town in its loop_cities is an explicit statement of membership and
      // outranks any box.
      const townNamed = hubLoop(target).some(c =>
        String(c).toLowerCase().trim() === String(r.city || "").toLowerCase().trim());
      const curImplausible = !cur || !hubsContaining([cur], r.lat, r.lng).length;
      const targetContains = hubsContaining([target], r.lat, r.lng).length > 0;
      if (!townNamed && !(curImplausible && targetContains)) continue;
      try { run(`UPDATE ${t} SET hub_id=? WHERE id=?`, want, r.id); fixed++; } catch {}
    }
  }
  return fixed;
}

export function nearestHubId(lat: number, lng: number): number | null {
  ensureHubSchema();
  const hubs = all<Hub>("SELECT * FROM hubs");
  let best: Hub | null = null, bestKm = Infinity;
  for (const h of hubs) {
    const km = haversineKm([lat, lng], [h.center_lat, h.center_lng]);
    // Prefer live hubs when distances are comparable (within 1.5x)
    const eff = h.live ? km : km * 1.5;
    if (eff < bestKm) { bestKm = eff; best = h; }
  }
  return best?.id ?? null;
}
