// Migration: add site_role to venues, theme to routes, tag Yale as film_location.
//   docker exec roadie-web node scripts/migrate-site-role.mjs
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "roadie.db"));
db.pragma("journal_mode = WAL");

// site_role: film_location | revenue | both | null (null = unclassified, treated as revenue)
try { db.exec("ALTER TABLE venues ADD COLUMN site_role TEXT"); console.log("added venues.site_role"); }
catch { console.log("venues.site_role already exists"); }

// routes can carry a sponsor-driven theme — optional, may never be set
try { db.exec("ALTER TABLE routes ADD COLUMN theme TEXT"); console.log("added routes.theme"); }
catch { console.log("routes.theme already exists"); }

// Yale Historic Site — the canyon and river ARE the shot. Small room, huge visual.
const r = db.prepare("UPDATE venues SET site_role='film_location' WHERE city='Yale' AND region='BC'").run();
console.log(`Tagged ${r.changes} Yale venue(s) as film_location`);

// A venue can be both a great shoot and a revenue stop — tag any obvious ones here.
// (Langham Cultural Centre in Kaslo, Capitol Theatre in Nelson — prime film rooms too)
const both = db.prepare("UPDATE venues SET site_role='both' WHERE name IN ('Capitol Theatre','Langham Cultural Centre','Charles Bailey Theatre','Fernie Arts Station')").run();
console.log(`Tagged ${both.changes} venues as both (film + revenue)`);

const counts = db.prepare("SELECT site_role, COUNT(*) n FROM venues GROUP BY site_role ORDER BY n DESC").all();
console.log("\nsite_role breakdown:");
for (const row of counts) console.log(`  ${row.site_role ?? "null (revenue)"}: ${row.n}`);
db.close();
