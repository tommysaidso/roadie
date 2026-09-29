// Claim the bands that nobody owns.
//
// Every band record was sitting with user_id NULL, which is why signing in
// showed nothing: the AI projects had no owner, and There's No End — Dewey's
// actual band — was ownerless while one of his logins was linked to JOBE.
//
//   OSTERTOG / JOBE / EVE / ADAM / Gabbie Rael / Latin Black -> Ben
//   There's No End                                            -> Dewey, + Greg on it
//
// Idempotent. Never clears an owner that is already set to somebody else.
import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(path.join(process.cwd(), "data", "roadie.db"));

const BEN = "ben@evprod.com";
const DEWEY = "dewsterdad197107@gmail.com";
const DEWEY_ALT = "bassdew55@hotmail.com";
const GREG = "greg@gottgetreu.com";

const AI_BANDS = ["OSTERTOG", "JOBE", "EVE", "ADAM", "Gabbie Rael", "Latin Black"];
const DEWEY_BAND = "There's No End";

const userId = (email) =>
  db.prepare("SELECT id FROM users WHERE lower(email)=?").get(email.toLowerCase())?.id ?? null;
const bandId = (name) =>
  db.prepare("SELECT id FROM bands WHERE name=?").get(name)?.id ?? null;

const ben = userId(BEN), dewey = userId(DEWEY), greg = userId(GREG), deweyAlt = userId(DEWEY_ALT);
console.log(`ben=${ben} dewey=${dewey} deweyAlt=${deweyAlt} greg=${greg}\n`);
if (!ben || !dewey) { console.error("missing a required account — aborting"); process.exit(1); }

const claim = db.prepare("UPDATE bands SET user_id=? WHERE id=? AND user_id IS NULL");
const link = db.prepare("UPDATE users SET role='band', band_id=? WHERE id=?");

db.transaction(() => {
  for (const name of AI_BANDS) {
    const id = bandId(name);
    if (!id) { console.log(`  ?  ${name} — no such band`); continue; }
    const r = claim.run(ben, id);
    console.log(`  ${r.changes ? "->" : "= "} ${name} (band ${id}) owner: ${r.changes ? BEN : "already set"}`);
  }

  const tne = bandId(DEWEY_BAND);
  if (tne) {
    const r = claim.run(dewey, tne);
    console.log(`  ${r.changes ? "->" : "= "} ${DEWEY_BAND} (band ${tne}) owner: ${r.changes ? DEWEY : "already set"}`);
    // Dewey and Greg both play in it; Dewey's second login rides along too.
    for (const [who, id] of [["dewey", dewey], ["greg", greg], ["bassdew", deweyAlt]]) {
      if (!id) continue;
      link.run(tne, id);
      console.log(`  -> ${who} -> band ${tne}, role band`);
    }
  } else {
    console.log(`  ?  ${DEWEY_BAND} — no such band`);
  }

  // Ben owns the AI projects, so point his login at OSTERTOG rather than leaving
  // it wherever it happened to land.
  const ost = bandId("OSTERTOG");
  if (ost) { link.run(ost, ben); console.log(`  -> ben -> band ${ost} (OSTERTOG)`); }
})();

console.log("\n=== users ===");
db.prepare("SELECT id,email,role,band_id FROM users ORDER BY id").all()
  .forEach(u => console.log(`  ${u.id} ${String(u.role).padEnd(6)} band=${u.band_id ?? "-"}  ${u.email}`));
console.log("\n=== owned bands ===");
db.prepare("SELECT b.id,b.name,b.user_id,u.email FROM bands b LEFT JOIN users u ON u.id=b.user_id WHERE b.user_id IS NOT NULL ORDER BY b.id").all()
  .forEach(b => console.log(`  ${b.id} ${String(b.name).padEnd(20)} ${b.email}`));
