// Migration: add sponsor tier ladder (platform_title → ring_title → corridor_partner →
// market_partner → local_supporter) and link ring title sponsors to routes.
//
//   docker exec roadie-web node scripts/migrate-sponsor-tiers.mjs
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "roadie.db"));
db.pragma("journal_mode = WAL");

// Tier values:
//   platform_title   — names ALL rings; one sponsor, the whole network
//   ring_title       — names one ring (e.g. "The Mountain Dew Interior Ring")
//   corridor_partner — corridor / arc level
//   market_partner   — per market (city)
//   local_supporter  — single stop
try { db.exec("ALTER TABLE sponsors ADD COLUMN tier TEXT"); console.log("added sponsors.tier"); }
catch { console.log("sponsors.tier already exists"); }

// scope mirrors tier but is explicit: platform | ring | corridor | market | stop
try { db.exec("ALTER TABLE sponsors ADD COLUMN scope TEXT DEFAULT 'market'"); console.log("added sponsors.scope"); }
catch { console.log("sponsors.scope already exists"); }

// scope_id: route_id for ring/corridor sponsors; null for platform_title
try { db.exec("ALTER TABLE sponsors ADD COLUMN scope_id INTEGER"); console.log("added sponsors.scope_id"); }
catch { console.log("sponsors.scope_id already exists"); }

// routes: denormalized title sponsor for fast display
try { db.exec("ALTER TABLE routes ADD COLUMN title_sponsor_id INTEGER"); console.log("added routes.title_sponsor_id"); }
catch { console.log("routes.title_sponsor_id already exists"); }

// Default existing sponsors to market_partner / market scope
const updated = db.prepare("UPDATE sponsors SET tier='market_partner', scope='market' WHERE tier IS NULL").run();
console.log(`Defaulted ${updated.changes} existing sponsors to market_partner`);

const tiers = db.prepare("SELECT tier, scope, COUNT(*) n FROM sponsors GROUP BY tier, scope ORDER BY n DESC").all();
console.log("\nTier breakdown:");
for (const r of tiers) console.log(`  ${r.tier ?? "null"} / ${r.scope ?? "null"}: ${r.n}`);

const routes = db.prepare("SELECT id, name, title_sponsor_id FROM routes ORDER BY id").all();
console.log("\nRoutes (title_sponsor_id):");
for (const r of routes) console.log(`  [${r.id}] ${r.name} → ${r.title_sponsor_id ?? "no title sponsor"}`);

db.close();
