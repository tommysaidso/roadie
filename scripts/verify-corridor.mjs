import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "roadie.db"));
const total = db.prepare("SELECT COUNT(*) n FROM venues").get().n;
const sample = db.prepare("SELECT COUNT(*) n FROM venues WHERE member_status='sample'").get().n;
console.log(`Total venues: ${total}  (${sample} corridor/sample)`);
const rows = db.prepare(`
  SELECT region, city, COUNT(*) n
  FROM venues
  WHERE city IN (
    'Hope','Yale','Boston Bar','Lytton','Spences Bridge','Ashcroft','Cache Creek','Clinton','Lillooet',
    'Pemberton','Agassiz',
    'Nelson','Trail','Castlegar','Grand Forks','Salmo','Nakusp','Kaslo','Rossland',
    'Cranbrook','Fernie','Sparwood','Creston','Kimberley','Invermere',
    'Crowsnest Pass','Pincher Creek','Fort Macleod','Taber',
    '100 Mile House','Burns Lake','Houston','Smithers','Terrace'
  )
  GROUP BY region, city ORDER BY region, city
`).all();
let prev = "";
for (const r of rows) {
  if (r.region !== prev) { console.log(`\n  ${r.region}`); prev = r.region; }
  console.log(`    ${r.city.padEnd(22)} ${r.n} venue${r.n===1?"":"s"}`);
}
db.close();
