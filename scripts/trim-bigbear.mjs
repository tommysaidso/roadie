import Database from "better-sqlite3";
import path from "node:path";
const db = new Database(path.join(process.cwd(), "data", "roadie.db"));
db.pragma("foreign_keys = OFF");
const r = db.prepare(
  "DELETE FROM venues WHERE lower(city) LIKE 'big bear%' AND name IN ('Big Bear Convention Center','Moonridge Room')"
).run();
console.log("deleted", r.changes);
console.log("BIGBEAR now:", db.prepare("SELECT name FROM venues WHERE lower(city) LIKE 'big bear%'").all().map(x => x.name).join(" | "));
