// Initialize + seed the ROADIE SQLite DB. Idempotent; --reset wipes first.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedInternational } from "./seed-international.mjs";
import { seedRealBand } from "./seed-realband.mjs";
import { seedLocalBands } from "./seed-localbands.mjs";
import { seedCommunity } from "./seed-community.mjs";
import { seedFestivals } from "./seed-festivals.mjs";
import { seedGeo } from "./seed-geo.mjs";
import { seedRulepacks } from "./seed-rulepacks.mjs";
import { seedRing } from "./seed-ring.mjs";
import { seedDealcohol } from "./seed-dealcohol.mjs";
import { seedUsaWest } from "./seed-usa-west.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "roadie.db");
const reset = process.argv.includes("--reset");

fs.mkdirSync(path.join(root, "data"), { recursive: true });

// --reset guard: refuse to wipe a DB that has real user accounts unless FORCE=1.
if (reset && fs.existsSync(dbPath)) {
  const check = new Database(dbPath);
  let realUsers = 0;
  try { realUsers = check.prepare("SELECT COUNT(*) n FROM users WHERE pass_hash IS NOT NULL").get().n; } catch {}
  check.close();
  if (realUsers > 0 && process.env.FORCE !== "1") {
    console.error(`[roadie] REFUSING --reset: ${realUsers} real user account(s) exist. Set FORCE=1 to override.`);
    process.exit(1);
  }
}
if (reset) for (const f of fs.readdirSync(path.join(root, "data"))) {
  if (f.startsWith("roadie.db")) fs.rmSync(path.join(root, "data", f));
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(fs.readFileSync(path.join(root, "lib", "schema.sql"), "utf8"));

// hub_id lives on these tables and is added by lib/hubs.ts:ensureHubSchema() at
// runtime. SQLite has no "ADD COLUMN IF NOT EXISTS", so schema.sql cannot carry
// it — do the same guarded ALTERs here, or seeds that write hub_id fail on a
// brand-new database.
for (const t of ["bands", "venues", "sponsors", "notices", "festivals"]) {
  try { db.exec(`ALTER TABLE ${t} ADD COLUMN hub_id INTEGER`); } catch {}
}

// Render columns on multicam_sets, added the same guarded way and for the same
// reason: the table already exists in every live database, so CREATE TABLE
// IF NOT EXISTS silently skips the new columns.
for (const col of [
  "output_key TEXT", "output_bytes INTEGER",
  "render_status TEXT", "render_note TEXT", "rendered_at TEXT",
]) {
  try { db.exec(`ALTER TABLE multicam_sets ADD COLUMN ${col}`); } catch {}
}
try { db.exec(`ALTER TABLE fan_clips ADD COLUMN first_onset_ms INTEGER`); } catch {}

// Seed ledger: each seed module runs ONCE ever, recorded here. Without this,
// container-start re-seeding resurrected rows the owner had deleted.
db.exec("CREATE TABLE IF NOT EXISTS seed_ledger(key TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))");
// A seed is recorded ONLY if it actually did its job.
//
// It used to record unconditionally, which hid a nasty failure: seed-usa-west
// reads hub ids by slug, and on a database where the hubs are not there yet it
// quietly wrote every US site with hub_id = null — exactly the "switch to a US
// hub and see nothing" bug that seed exists to fix — then marked itself applied
// so it could never run again. A seed that returns false is left unrecorded and
// retried on the next boot.
const seedOnce = (key, fn) => {
  if (db.prepare("SELECT 1 FROM seed_ledger WHERE key=?").get(key)) return;
  let out;
  try {
    out = fn(db);
  } catch (e) {
    // One broken seed must not stop the rest — and must not be marked done.
    console.warn(`[roadie] seed FAILED (will retry next boot): ${key} — ${e.message}`);
    return;
  }
  if (out === false) {
    console.warn(`[roadie] seed not ready (will retry next boot): ${key}`);
    return;
  }
  db.prepare("INSERT OR IGNORE INTO seed_ledger(key) VALUES(?)").run(key);
  console.log(`[roadie] seed applied: ${key}`);
};
const ensureSeeds = () => {
  seedOnce("international-v1", seedInternational);
  seedOnce("realband-v1", seedRealBand);
  seedOnce("localbands-v1", seedLocalBands);
  seedOnce("community-v1", seedCommunity);
  seedOnce("festivals-v1", seedFestivals);
  seedOnce("geo-v1", seedGeo);
  seedOnce("rulepacks-v1", seedRulepacks);
  seedOnce("ring-v1", seedRing);
  seedOnce("dealcohol-v1", seedDealcohol);
  seedOnce("usa-west-v1", seedUsaWest);
};

const seeded = db.prepare("SELECT COUNT(*) n FROM bands").get().n;
if (seeded > 0 && !reset) {
  // Existing DB: mark the core seed as done (pre-ledger installs), then only
  // apply seed modules never applied before. Deletions stay deleted.
  db.prepare("INSERT OR IGNORE INTO seed_ledger(key) VALUES('core-v1')").run();
  ensureSeeds();
  console.log(`[roadie] core already seeded (${seeded} bands); ledgered seeds ensured.`);
  process.exit(0);
}

const tx = db.transaction(() => {
  // ---- Users ----
  const u = db.prepare("INSERT INTO users(email,display_name,role) VALUES(?,?,?)");
  const deweyId = u.run("dewey@roadie.bc", "Dewey Mitchell (Kelowna Hub)", "admin").lastInsertRowid;

  // ---- Bands (northern/interior BC, not Vancouver basin) ----
  const b = db.prepare(`INSERT INTO bands
    (name,genre,genres,home_city,home_region,lat,lng,bio_short,bio,members,draw,rate_min,rate_max,touring,socials,mymymy_artist_id)
    VALUES (@name,@genre,@genres,@home_city,'BC',@lat,@lng,@bio_short,@bio,@members,@draw,@rate_min,@rate_max,@touring,@socials,@mymymy_artist_id)`);
  const bands = [
    { name:"Glacier Howl", genre:"Indie Rock", genres:"Indie Rock,Alt,Folk Rock", home_city:"Kelowna", lat:49.888, lng:-119.496, draw:180, rate_min:600, rate_max:1500, touring:1, mymymy_artist_id:"art_glacierhowl",
      bio_short:"Okanagan indie-rock four-piece with anthemic hooks.", bio:"Glacier Howl formed in Kelowna's basement scene and built a loyal Okanagan following on big choruses and reverb-soaked guitars.", members:"Dewey Mitchell,Sara Vance,Tom Ko,Priya R", socials:'{"instagram":"@glacierhowl","spotify":"glacierhowl"}' },
    { name:"Diesel Larks", genre:"Country", genres:"Country,Alt-Country,Americana", home_city:"Vernon", lat:50.267, lng:-119.272, draw:140, rate_min:500, rate_max:1200, touring:1, mymymy_artist_id:"art_diesellarks",
      bio_short:"Alt-country with a runout-ready van and a pedal steel.", bio:"Diesel Larks haul honest Americana across the Interior, equally at home in a Legion hall or a craft taproom.", members:"Cody Lark,Jen Marsh", socials:'{"instagram":"@diesellarks"}' },
    { name:"Neon Coyote", genre:"Synthwave", genres:"Synthwave,Electro,Dream Pop", home_city:"Kamloops", lat:50.674, lng:-120.327, draw:120, rate_min:450, rate_max:1100, touring:0, mymymy_artist_id:"art_neoncoyote",
      bio_short:"Kamloops synthwave duo, neon and analog.", bio:"Neon Coyote score the desert-city night with arpeggiated synths and slow-burn vocals.", members:"Mara Quinn,Ivan T", socials:'{"tiktok":"@neoncoyote"}' },
    { name:"The Tailings", genre:"Punk", genres:"Punk,Garage,Post-Punk", home_city:"Prince George", lat:53.917, lng:-122.749, draw:90, rate_min:350, rate_max:800, touring:1, mymymy_artist_id:"art_tailings",
      bio_short:"Northern-capital garage punk, loud and fast.", bio:"The Tailings are Prince George's basement-show mainstay, looking south for an Okanagan run.", members:"Reg,Ash,Boomer", socials:'{"instagram":"@thetailings"}' },
    { name:"Sage & Cedar", genre:"Folk", genres:"Folk,Indie Folk,Bluegrass", home_city:"Nelson", lat:49.493, lng:-117.297, draw:110, rate_min:400, rate_max:1000, touring:1, mymymy_artist_id:"art_sagecedar",
      bio_short:"Kootenay folk trio, harmony-forward.", bio:"Sage & Cedar bring Kootenay mountain folk with three-part harmony and a standing-room hush.", members:"Willa,Jonah,Beck", socials:'{"spotify":"sageandcedar"}' },
    { name:"Bachata Borealis", genre:"Latin", genres:"Bachata,Latin Pop,Cumbia", home_city:"Kelowna", lat:49.880, lng:-119.486, draw:160, rate_min:700, rate_max:1600, touring:0, mymymy_artist_id:"art_bachataborealis",
      bio_short:"Okanagan's bilingual bachata party band.", bio:"Bachata Borealis fills dance floors across the valley with bilingual bachata and cumbia.", members:"Luis,Camila,Deb,Marco", socials:'{"instagram":"@bachataborealis"}' },
  ];
  const bandIds = bands.map(x => b.run(x).lastInsertRowid);

  // ---- Venues (Okanagan + interior runout loop) ----
  const v = db.prepare(`INSERT INTO venues(name,city,lat,lng,capacity,genres,backline,contact,pay_model,notes)
    VALUES(@name,@city,@lat,@lng,@capacity,@genres,@backline,@contact,@pay_model,@notes)`);
  const venues = [
    { name:"The Doc Marten", city:"Kelowna", lat:49.886, lng:-119.494, capacity:220, genres:"Indie Rock,Punk,Alt", backline:"PA, drum kit, 2x guitar amps", contact:"book@docmarten.bc", pay_model:"door_split", notes:"Loud room, college crowd." },
    { name:"Habitat", city:"Kelowna", lat:49.883, lng:-119.490, capacity:120, genres:"Synthwave,Indie,Electronic", backline:"PA only", contact:"hello@habitat.bc", pay_model:"guarantee", notes:"Early all-ages room, good sightlines." },
    { name:"Record City Stage", city:"Kelowna", lat:49.889, lng:-119.498, capacity:80, genres:"Folk,Acoustic,Indie", backline:"PA, stools", contact:"stage@recordcity.bc", pay_model:"door", notes:"In-store; great for runout press." },
    { name:"The Powerhouse", city:"Vernon", lat:50.264, lng:-119.270, capacity:160, genres:"Country,Rock,Americana", backline:"Full backline", contact:"shows@powerhouse.bc", pay_model:"hybrid", notes:"Friday country nights." },
    { name:"Red Beard Cafe", city:"Kamloops", lat:50.676, lng:-120.340, capacity:90, genres:"Folk,Synthwave,Indie", backline:"PA", contact:"book@redbeard.bc", pay_model:"door_split", notes:"Tue/Wed open slots common." },
    { name:"The Dose", city:"Penticton", lat:49.499, lng:-119.593, capacity:140, genres:"Rock,Punk,Latin", backline:"PA, kit", contact:"the.dose@bc", pay_model:"guarantee", notes:"Summer patio shows." },
    { name:"Trench Events Hall", city:"Prince George", lat:53.914, lng:-122.745, capacity:130, genres:"Punk,Rock,Folk", backline:"PA", contact:"events@trenchhall.bc", pay_model:"door_split", notes:"North anchor venue." },
  ];
  const venueIds = venues.map(x => v.run(x).lastInsertRowid);

  // ---- Venue slots (open gaps the AI can fill) ----
  const s = db.prepare(`INSERT INTO venue_slots(venue_id,date,status,genre_wanted,guarantee,notes,source)
    VALUES(?,?,?,?,?,?,?)`);
  const today = new Date();   // seed slot dates relative to install time, not a frozen date
  const iso = (d) => d.toISOString().slice(0,10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate()+n); return iso(d); };
  const slotSpecs = [
    [venueIds[0], addDays(9), "open", "Indie Rock", 800, "Thu headline open", "manual"],
    [venueIds[0], addDays(23), "open", "Punk", 600, "Sat support needed", "manual"],
    [venueIds[1], addDays(5), "open", "Synthwave", 700, "All-ages 7pm", "voice"],
    [venueIds[2], addDays(12), "open", "Folk", 0, "Door only in-store", "ocr"],
    [venueIds[3], addDays(7), "open", "Country", 900, "Friday country night", "manual"],
    [venueIds[4], addDays(3), "open", "Folk", 400, "Tue acoustic", "ocr"],
    [venueIds[4], addDays(4), "open", "Synthwave", 450, "Wed electronic", "manual"],
    [venueIds[5], addDays(15), "open", "Latin", 1000, "Summer patio", "manual"],
    [venueIds[6], addDays(20), "open", "Punk", 500, "North anchor", "voice"],
  ];
  slotSpecs.forEach(r => s.run(...r));

  // ---- Notice board ----
  const n = db.prepare(`INSERT INTO notices(kind,author_type,author_id,title,body,city,date_from,date_to,genre)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  n.run("touring","band",bandIds[3],"The Tailings heading south","PG punks want Okanagan dates mid-July, will trade bills.","Prince George",addDays(14),addDays(28),"Punk");
  n.run("gig_gap","venue",venueIds[4],"Red Beard has Tue/Wed open","Kamloops cafe needs low-key acts on the runout loop.","Kamloops",addDays(3),addDays(4),"Folk");
  n.run("seeking_opener","band",bandIds[0],"Glacier Howl needs an opener","Kelowna hometown show, want a synth or folk act to open.","Kelowna",addDays(9),addDays(9),"Synthwave");
  n.run("runout","booker",null,"Okanagan runout forming","Routing Kelowna->Vernon->Kamloops->Penticton, 2 slots left.","Kelowna",addDays(7),addDays(12),"Any");

  // ---- Sponsors ----
  const sp = db.prepare(`INSERT INTO sponsors(name,kind,city,budget_monthly,contact) VALUES(?,?,?,?,?)`);
  const foodTruck = sp.run("Okanagan Street Eats","food_vendor","Kelowna",4000,"book@okstreeteats.bc").lastInsertRowid;
  const outfitter = sp.run("Interior Outdoor Co.","outfitter","Kelowna",3000,"promo@interioroutdoor.bc").lastInsertRowid;
  const musicStore = sp.run("Wentworth Music","music_store","Kelowna",1500,"ads@wentworth.bc").lastInsertRowid;
  const hotel = sp.run("Prestige Hotels Interior","hotel","Vernon",2500,"groups@prestige.bc").lastInsertRowid;
  const vans = sp.run("Okanagan Van Rentals","vehicle_rental","Kelowna",1200,"fleet@okvans.bc").lastInsertRowid;

  // ---- Ad placements (for ROI dashboard) ----
  const ap = db.prepare(`INSERT INTO ad_placements(sponsor_id,surface,label,cost,impressions,clicks,conversions,start_date,end_date)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  ap.run(foodTruck,"public_feed","Street Eats — Ring Night",1200,48000,1900,140,addDays(-20),addDays(10));
  ap.run(outfitter,"tour_map","Interior Outdoor pin sponsor",800,22000,640,52,addDays(-15),addDays(15));
  ap.run(musicStore,"band_profile","Wentworth gear banner",500,15000,520,70,addDays(-30),addDays(0));
  ap.run(hotel,"notice_board","Prestige tour-stay offer",900,12000,310,38,addDays(-10),addDays(20));
  ap.run(vans,"tour_map","OK Vans runout deal",600,9000,280,24,addDays(-12),addDays(18));

  // ---- Perks inventory ----
  const pk = db.prepare(`INSERT INTO perks(sponsor_id,kind,city,qty,value_each,notes) VALUES(?,?,?,?,?,?)`);
  pk.run(hotel,"hotel_night","Vernon",6,140,"Tour-stay rate for routed bands");
  pk.run(vans,"van_day","Kelowna",4,90,"Cargo van, runout days");
  pk.run(musicStore,"gear_loan","Kelowna",3,0,"Backline loan for sponsored nights");
  pk.run(foodTruck,"meal_voucher","Kelowna",10,75,"Crew + band meals on show nights");

  // ---- Works cache (promo videos: static/kenburns + living clip) ----
  const w = db.prepare(`INSERT INTO works_cache(band_id,iswc,title,primary_genre,variant_count,hero_video,cover_url,source)
    VALUES(?,?,?,?,?,?,?, 'mock')`);
  w.run(bandIds[0],"T-070.123.456-1","Avalanche Heart","Indie Rock",6,"kenburns","/covers/glacier.jpg");
  w.run(bandIds[0],"T-070.123.457-2","Lake Effect","Indie Rock",4,"living","/covers/glacier2.jpg");
  w.run(bandIds[1],"T-070.223.111-9","Gravel & Gold","Country",5,"kenburns","/covers/diesel.jpg");
  w.run(bandIds[5],"T-070.555.000-3","Borealis Nights","Bachata",8,"living","/covers/bachata.jpg");

  // ---- Region rules ----
  const rr = db.prepare(`INSERT INTO region_rules(region,topic,rule,source) VALUES(?,?,?,?)`);
  rr.run("BC","site_permit","Outdoor ticketed events on public or recreation ground need a municipal special-event / temporary-assembly permit; apply 30-60 days out.","City of Kelowna");
  rr.run("BC","food_vendor","Temporary food vendors at an event must notify the regional health authority and hold a temporary food permit.","Interior Health");
  rr.run("BC","noise","Kelowna amplified sound generally winds down ~11pm weekdays; confirm per venue/bylaw.","City of Kelowna");
  rr.run("BC","runout","Okanagan loop Kelowna->Vernon->Kamloops->Penticton: <2.5h drives, 3-4 nights.","ROADIE routing");

  // ---- A sample confirmed booking + contract for the calendar ----
  const slotRow = db.prepare("SELECT id,venue_id,date,guarantee FROM venue_slots WHERE venue_id=? LIMIT 1").get(venueIds[3]);
  const bk = db.prepare(`INSERT INTO bookings(slot_id,band_id,venue_id,date,status,guarantee,ai_match_score) VALUES(?,?,?,?,?,?,?)`)
    .run(slotRow.id, bandIds[1], venueIds[3], slotRow.date, "confirmed", slotRow.guarantee, 0.92).lastInsertRowid;
  db.prepare("UPDATE venue_slots SET status='booked' WHERE id=?").run(slotRow.id);
});

tx();
db.prepare("INSERT OR IGNORE INTO seed_ledger(key) VALUES('core-v1')").run();
ensureSeeds();
const counts = ["users","bands","venues","venue_slots","bookings","notices","sponsors","ad_placements","perks","works_cache","region_rules"]
  .map(t => `${t}=${db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n}`).join("  ");
console.log("[roadie] seeded:", counts);
