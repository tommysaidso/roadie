// The Interior Ring: the announced route sites bid to host and bands opt into.
// The rig is a tent — the route has to land in summer, so dates anchor to the
// next June 19 rather than a flat offset from whenever the seed happens to run.
export function seedRing(db) {
  if (db.prepare("SELECT COUNT(*) n FROM routes").get().n > 0) return;

  const iso = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  const season = new Date(Date.UTC(now.getUTCFullYear(), 5, 19)); // Jun 19
  if (season <= now) season.setUTCFullYear(season.getUTCFullYear() + 1);
  const addDays = (n) => { const d = new Date(season); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const year = season.getUTCFullYear();

  const routeId = db.prepare(`INSERT INTO routes(name,arc,season,start_date,end_date,status,notes)
    VALUES(?,?,?,?,?,?,?)`).run(
    `Interior Ring ${year}`, "Kelowna → Prince George", "Summer",
    addDays(0), addDays(21), "announced",
    "Two provinces, all-ages, alcohol-free. Sites bid for the ground; we bring the rig."
  ).lastInsertRowid;

  const st = db.prepare(`INSERT INTO stops(route_id,seq,date,city,region,lat,lng,site_name,site_kind,
      site_scale,capacity,lot_spaces,camping,power,location_manager,advance_status,status,notes)
    VALUES(@route_id,@seq,@date,@city,@region,@lat,@lng,@site_name,@site_kind,
      @site_scale,@capacity,@lot_spaces,@camping,@power,@location_manager,@advance_status,@status,@notes)`);

  [
    { seq:1, day:0, city:"Kelowna",       lat:49.886, lng:-119.494, site_name:"Kelowna Rodeo Grounds", site_kind:"rodeo_grounds", site_scale:"full_ring",  capacity:2500, lot_spaces:700, camping:0, advance_status:"assigned" },
    { seq:2, day:3, city:"Vernon",        lat:50.264, lng:-119.270, site_name:"Vernon Ag Fairground",  site_kind:"fairground",    site_scale:"mid_ring",   capacity:1400, lot_spaces:400, camping:0, advance_status:"unassigned" },
    { seq:3, day:7, city:"Kamloops",      lat:50.676, lng:-120.340, site_name:"Kamloops Exhibition",   site_kind:"fairground",    site_scale:"full_ring",  capacity:2200, lot_spaces:600, camping:1, advance_status:"unassigned" },
    { seq:4, day:11, city:"Williams Lake", lat:52.129, lng:-122.140, site_name:"Stampede Grounds",      site_kind:"rodeo_grounds", site_scale:"small_ring", capacity:800,  lot_spaces:250, camping:1, advance_status:"unassigned" },
    { seq:5, day:15, city:"Quesnel",       lat:52.978, lng:-122.493, site_name:"Riverfront rec ground", site_kind:"park",          site_scale:"popup",      capacity:400,  lot_spaces:120, camping:0, advance_status:"unassigned" },
    { seq:6, day:19, city:"Prince George", lat:53.914, lng:-122.745, site_name:"PG Exhibition Grounds", site_kind:"fairground",    site_scale:"full_ring",  capacity:2600, lot_spaces:750, camping:1, advance_status:"unassigned" },
  ].forEach(s => st.run({
    route_id: routeId, seq: s.seq, date: addDays(s.day), city: s.city, region: "BC",
    lat: s.lat, lng: s.lng, site_name: s.site_name, site_kind: s.site_kind,
    site_scale: s.site_scale, capacity: s.capacity, lot_spaces: s.lot_spaces,
    camping: s.camping, power: "generator",
    location_manager: s.advance_status === "assigned" ? "TBD" : null,
    advance_status: s.advance_status, status: "announced",
    notes: "All-ages, alcohol-free. Ground bid open.",
  }));
}
