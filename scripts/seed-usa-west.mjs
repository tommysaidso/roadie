// West coast US rings — the I-5 corridor and its neighbours.
//
// Switching to a US hub showed nothing but BC because every host site sat on
// hub_id 1 (Kelowna) and the only route was the Interior Ring. The hub switch
// was working; there was simply no US data behind it.
//
// Same shape as the Interior Ring: real county fairgrounds and expo centres —
// the sort of ground the rig actually fits on — strung into rings that hang off
// one corridor each. All-ages and alcohol-free, like every stop.
export function seedUsaWest(db) {
  // The hubs have to exist first. Without them every site below would be
  // written with hub_id = null — which is the exact bug this seed was created
  // to fix. Returning false leaves it unrecorded so it runs again once the
  // hubs are seeded, instead of silently doing damage once and never retrying.
  const hasHubs = (() => {
    try { return db.prepare("SELECT COUNT(*) n FROM hubs").get().n > 0; }
    catch { return false; }   // table not created yet
  })();
  if (!hasHubs) return false;

  const hub = (slug) => db.prepare("SELECT id FROM hubs WHERE slug=?").get(slug)?.id ?? null;

  const PUGET = hub("puget-sound"), OREGON = hub("oregon-i5");
  const NORCAL = hub("norcal"), VALLEY = hub("central-valley"), SOCAL = hub("socal-mountains");

  // name, city, region, capacity, hub, lat, lng
  const SITES = [
    ["Northwest Washington Fairgrounds", "Lynden", "WA", 4200, PUGET, 48.946, -122.452],
    ["Washington State Fair Events Center", "Puyallup", "WA", 6000, PUGET, 47.185, -122.294],
    ["Southwest Washington Fairgrounds", "Centralia", "WA", 2600, PUGET, 46.716, -122.955],
    ["Clark County Event Center", "Ridgefield", "WA", 3200, PUGET, 45.817, -122.744],
    ["Portland Expo Center", "Portland", "OR", 5000, OREGON, 45.594, -122.686],
    ["Oregon State Fairgrounds", "Salem", "OR", 4800, OREGON, 44.958, -123.010],
    ["Linn County Fair & Expo", "Albany", "OR", 2400, OREGON, 44.616, -123.104],
    ["Lane Events Center", "Eugene", "OR", 3600, OREGON, 44.043, -123.099],
    ["Douglas County Fairgrounds", "Roseburg", "OR", 2200, OREGON, 43.212, -123.360],
    ["Jackson County Expo", "Central Point", "OR", 3400, OREGON, 42.377, -122.917],
    ["Shasta District Fair", "Anderson", "CA", 2400, NORCAL, 40.448, -122.297],
    ["Silver Dollar Fairgrounds", "Chico", "CA", 2800, NORCAL, 39.727, -121.836],
    ["Yuba-Sutter Fairgrounds", "Yuba City", "CA", 1800, NORCAL, 39.132, -121.629],
    ["Cal Expo", "Sacramento", "CA", 8000, NORCAL, 38.598, -121.421],
    ["San Joaquin County Fairgrounds", "Stockton", "CA", 3600, VALLEY, 37.937, -121.279],
    ["Stanislaus County Fairgrounds", "Turlock", "CA", 2600, VALLEY, 37.494, -120.847],
    ["Fresno Fairgrounds", "Fresno", "CA", 5200, VALLEY, 36.735, -119.760],
    ["Kern County Fairgrounds", "Bakersfield", "CA", 4400, VALLEY, 35.341, -119.019],
    ["Antelope Valley Fairgrounds", "Lancaster", "CA", 3000, SOCAL, 34.703, -118.156],
    ["San Bernardino County Fairgrounds", "Victorville", "CA", 3200, SOCAL, 34.531, -117.290],
    ["Big Bear Convention Center", "Big Bear Lake", "CA", 900, SOCAL, 34.244, -116.911],
  ];

  const findSite = db.prepare("SELECT id FROM venues WHERE name=? AND city=?");
  const addSite = db.prepare(`INSERT INTO venues
    (name,city,region,capacity,hub_id,lat,lng,pay_model,member_status,verification_status,has_liquor,notes)
    VALUES(?,?,?,?,?,?,?,'guarantee','sample','unclaimed',0,?)`);
  for (const [name, city, region, cap, hubId, lat, lng] of SITES) {
    if (findSite.get(name, city)) continue;
    addSite.run(name, city, region, cap, hubId, lat, lng,
      "Ring-capable ground — flat, drained, truck access, parking on site.");
  }

  // scale by capacity, same rule the Interior Ring uses
  const scaleFor = (c) => c >= 4000 ? "full_ring" : c >= 2400 ? "mid_ring" : c >= 1200 ? "small_ring" : "popup";

  const RINGS = [
    { name: "Cascade Ring 2027", arc: "Bellingham → Eugene", season: "Summer",
      start: "2027-07-16", end: "2027-08-01", hub: PUGET,
      notes: "The I-5 north leg. Two states, all-ages, alcohol-free. Sites bid for the ground.",
      stops: [["Lynden","Northwest Washington Fairgrounds","2027-07-16"],
              ["Puyallup","Washington State Fair Events Center","2027-07-19"],
              ["Centralia","Southwest Washington Fairgrounds","2027-07-22"],
              ["Ridgefield","Clark County Event Center","2027-07-25"],
              ["Portland","Portland Expo Center","2027-07-28"],
              ["Salem","Oregon State Fairgrounds","2027-07-30"],
              ["Eugene","Lane Events Center","2027-08-01"]] },
    { name: "Siskiyou Ring 2027", arc: "Roseburg → Sacramento", season: "Late summer",
      start: "2027-08-06", end: "2027-08-20", hub: OREGON,
      notes: "Over the pass and down into northern California — the stretch nobody tours.",
      stops: [["Roseburg","Douglas County Fairgrounds","2027-08-06"],
              ["Central Point","Jackson County Expo","2027-08-09"],
              ["Anderson","Shasta District Fair","2027-08-12"],
              ["Chico","Silver Dollar Fairgrounds","2027-08-15"],
              ["Yuba City","Yuba-Sutter Fairgrounds","2027-08-17"],
              ["Sacramento","Cal Expo","2027-08-20"]] },
    { name: "Valley Ring 2027", arc: "Stockton → Big Bear", season: "Autumn",
      start: "2027-09-03", end: "2027-09-19", hub: VALLEY,
      notes: "Central Valley into the SoCal mountains. Big grounds, small towns between them.",
      stops: [["Stockton","San Joaquin County Fairgrounds","2027-09-03"],
              ["Turlock","Stanislaus County Fairgrounds","2027-09-06"],
              ["Fresno","Fresno Fairgrounds","2027-09-09"],
              ["Bakersfield","Kern County Fairgrounds","2027-09-12"],
              ["Lancaster","Antelope Valley Fairgrounds","2027-09-15"],
              ["Victorville","San Bernardino County Fairgrounds","2027-09-17"],
              ["Big Bear Lake","Big Bear Convention Center","2027-09-19"]] },
  ];

  const findRoute = db.prepare("SELECT id FROM routes WHERE name=?");
  // routes carry no hub — a stop does, which is what the hub switch filters on
  const addRoute = db.prepare(`INSERT INTO routes(name,arc,season,start_date,end_date,status,notes)
    VALUES(?,?,?,?,?,'announced',?)`);
  const addStop = db.prepare(`INSERT INTO stops
    (route_id,seq,city,region,country,lat,lng,site_name,site_kind,site_scale,capacity,lot_spaces,date,status,advance_status,permit_status,hub_id)
    VALUES(?,?,?,?,'US',?,?,?,'fairground',?,?,?,?,'open','unassigned','none',?)`);

  let routes = 0, stops = 0;
  for (const r of RINGS) {
    if (findRoute.get(r.name)) continue;
    const rid = Number(addRoute.run(r.name, r.arc, r.season, r.start, r.end, r.notes).lastInsertRowid);
    routes++;
    r.stops.forEach(([city, site, date], i) => {
      const v = SITES.find(s => s[0] === site);
      const cap = v ? v[3] : 2000;
      addStop.run(rid, i + 1, city, v ? v[2] : "CA", v ? v[5] : null, v ? v[6] : null,
        site, scaleFor(cap), cap, Math.round(cap / 3.2), date, v ? v[4] : r.hub);
      stops++;
    });
  }
  console.log(`[usa-west] ${SITES.length} sites ensured · ${routes} rings · ${stops} stops`);
}
