// Big Bear correction: the OSM import pulled ring GROUND (fire halls, fields,
// arenas) — not gig rooms. For LocalJams "Rooms" we want real music venues. Ben:
// only Moonridge Lounge + The Cave are venues in Big Bear; the rest are canvass
// targets (JamPoints), not rooms. Drop the ring-ground imports, seed the 2 real.
import Database from "better-sqlite3";
import path from "node:path";
const db = new Database(path.join(process.cwd(), "data", "roadie.db"));
const del = db.prepare(
  "DELETE FROM venues WHERE member_status='sample' AND notes LIKE '%OpenStreetMap%' AND lower(city) LIKE 'big bear%'"
).run();
const ins = db.prepare(
  "INSERT INTO venues(name,city,region,lat,lng,genres,pay_model,notes,member_status) VALUES(?,?,?,?,?,?,?,?,'sample')"
);
const rows = [
  ["The Cave", "Big Bear Lake", "CA", 34.2443, -116.9114, "live music, rock, acoustic", "door_split", "music venue"],
  ["Moonridge Lounge", "Big Bear Lake", "CA", 34.2378, -116.8760, "live music, bar", "door_split", "music venue"],
];
let added = 0;
for (const r of rows) {
  if (!db.prepare("SELECT 1 FROM venues WHERE name=? AND city=?").get(r[0], r[1])) { ins.run(...r); added++; }
}
console.log("deleted ring-ground:", del.changes, "· added real venues:", added);
