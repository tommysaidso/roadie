/**
 * THE PIT migration — adds filmmaker/crew registration table.
 * Run once: node scripts/migrate-pit.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "roadie.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS filmmaker_calls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'filmmaker', -- filmmaker | photographer | equipment | other
    email       TEXT NOT NULL,
    phone       TEXT,
    city        TEXT,
    region      TEXT DEFAULT 'BC',
    gear_notes  TEXT,   -- what they have / what they do
    ring_pref   TEXT,   -- which rings they can cover (comma-sep route slugs, or 'any')
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_filmmaker_calls_kind ON filmmaker_calls(kind);
  CREATE INDEX IF NOT EXISTS idx_filmmaker_calls_region ON filmmaker_calls(region);
`);

const existing = db.prepare("SELECT COUNT(*) n FROM filmmaker_calls").get().n;
console.log(`filmmaker_calls table ready. Existing registrations: ${existing}`);
db.close();
