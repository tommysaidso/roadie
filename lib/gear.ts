// GEAR — a real item in the bag, not a word in a list.
//
// The kit list started as free text, which is right for "hardware, throne" but
// useless for the thing bands actually need it for: proving what walked into a
// room and what walked out. A stolen Les Paul is recovered by a serial number,
// not by the word "guitar".
//
// So an item can now carry a brand, a model and a serial — while STILL being
// just a line of text if that is all someone wants to type. The free-text list
// stays exactly as it was; this sits beside it. Forcing a drummer to fill in
// seven fields for a throne would mean nobody fills in anything.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureGearSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS gear_items (
      id INTEGER PRIMARY KEY,
      band_id INTEGER REFERENCES bands(id),
      member_id INTEGER,               -- gig_bag row, when it belongs to a person
      owner_user_id INTEGER,           -- gear follows its OWNER, not the band
      kind TEXT DEFAULT 'other',       -- guitar | bass | drums | amp | keys | mic | pedal | case | other
      brand TEXT DEFAULT '',
      model TEXT DEFAULT '',
      serial TEXT DEFAULT '',
      colour TEXT DEFAULT '',
      year TEXT DEFAULT '',
      value_cad INTEGER,
      photo TEXT,                      -- basename of the uploaded photo
      note TEXT DEFAULT '',
      -- How the serial got here, so a typo and a scan are distinguishable.
      serial_source TEXT DEFAULT 'manual',   -- manual | scan | photo
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_gear_band ON gear_items(band_id);
    CREATE INDEX IF NOT EXISTS idx_gear_owner ON gear_items(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_gear_serial ON gear_items(serial);
  `);
  ready = true;
}

/**
 * Brands, by instrument family.
 *
 * A starting list, not a closed one — "add your own" is always available and
 * whatever gets typed is kept. A dropdown that cannot express a Squier bought
 * second-hand in Kamloops is worse than a text box.
 */
export const GEAR_KINDS: { id: string; label: string; brands: string[] }[] = [
  { id: "guitar", label: "Guitar", brands: [
    "Fender","Gibson","Epiphone","Squier","Ibanez","Gretsch","PRS","Jackson","ESP","Yamaha",
    "Taylor","Martin","Seagull","Godin","Larrivée","Takamine","Guild","Rickenbacker","Schecter","Danelectro"] },
  { id: "bass", label: "Bass", brands: [
    "Fender","Squier","Music Man","Ibanez","Warwick","Rickenbacker","Gibson","Epiphone","Yamaha","Godin","Schecter","Hofner"] },
  { id: "drums", label: "Drums", brands: [
    "Yamaha","Pearl","Tama","DW","Ludwig","Gretsch","Mapex","Sonor","PDP","Zildjian","Sabian","Meinl","Paiste","Remo","Evans"] },
  { id: "amp", label: "Amp / cab", brands: [
    "Fender","Marshall",'Vox',"Orange","Ampeg","Mesa/Boogie","Peavey","Roland","Blackstar","Laney","Hughes & Kettner","Traynor","Yorkville"] },
  { id: "keys", label: "Keys", brands: [
    "Nord","Yamaha","Roland","Korg","Moog","Casio","Hammond","Arturia","Sequential","Kurzweil"] },
  { id: "mic", label: "Mic", brands: [
    "Shure","Sennheiser","Audio-Technica","AKG","Rode","Electro-Voice","Neumann","Beyerdynamic","sE"] },
  { id: "pedal", label: "Pedal / FX", brands: [
    "Boss","Electro-Harmonix","MXR","TC Electronic","Strymon","Line 6","Digitech","Dunlop","Walrus","JHS","Earthquaker"] },
  { id: "case", label: "Case / stand / hardware", brands: [
    "SKB","Gator","Pelican","Hercules","On-Stage","K&M","Road Runner","Mono"] },
  { id: "other", label: "Something else", brands: [] },
];

export const brandsFor = (kind: string) =>
  GEAR_KINDS.find(k => k.id === kind)?.brands ?? [];

export type GearItem = {
  id?: number; band_id?: number; member_id?: number | null; owner_user_id?: number | null;
  kind?: string; brand?: string; model?: string; serial?: string; colour?: string;
  year?: string; value_cad?: number | null; photo?: string | null; note?: string;
  serial_source?: string;
};

const FIELDS = ["band_id","member_id","owner_user_id","kind","brand","model","serial",
  "colour","year","value_cad","photo","note","serial_source"] as const;

/** Serials are printed in mixed case with stray spacing; store them comparably. */
export const normSerial = (s: string) =>
  String(s || "").toUpperCase().replace(/[\s\-–—]+/g, "").slice(0, 40);

export function gearFor(bandId: number) {
  ensureGearSchema();
  return all<any>("SELECT * FROM gear_items WHERE band_id=? ORDER BY kind, brand, id", bandId);
}

export function saveGear(g: GearItem) {
  ensureGearSchema();
  const clean: any = {};
  for (const f of FIELDS) if (g[f] !== undefined) clean[f] = (g as any)[f];
  if (clean.serial !== undefined) clean.serial = normSerial(clean.serial);
  if (clean.kind && !GEAR_KINDS.some(k => k.id === clean.kind)) clean.kind = "other";

  if (g.id) {
    const cols = Object.keys(clean);
    if (!cols.length) return one<any>("SELECT * FROM gear_items WHERE id=?", g.id);
    run(`UPDATE gear_items SET ${cols.map(c => `${c}=?`).join(",")}, updated_at=datetime('now') WHERE id=?`,
      ...cols.map(c => clean[c]), g.id);
    return one<any>("SELECT * FROM gear_items WHERE id=?", g.id);
  }
  const cols = Object.keys(clean);
  const r = run(`INSERT INTO gear_items(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`,
    ...cols.map(c => clean[c]));
  return one<any>("SELECT * FROM gear_items WHERE id=?", Number(r.lastInsertRowid));
}

export function deleteGear(bandId: number, id: number) {
  ensureGearSchema();
  run("DELETE FROM gear_items WHERE id=? AND band_id=?", id, bandId);
}

/**
 * Has this serial been seen before, on another band's list?
 *
 * Not an accusation — the same serial on two lists is nearly always the same
 * person listing their own gear twice. But it is exactly what you want to know
 * if something went missing, so it is worth surfacing quietly.
 */
export function serialSeenElsewhere(serial: string, bandId: number) {
  ensureGearSchema();
  const s = normSerial(serial);
  if (s.length < 4) return [];
  return all<any>(`SELECT g.id, g.brand, g.model, b.name band
                     FROM gear_items g LEFT JOIN bands b ON b.id=g.band_id
                    WHERE g.serial=? AND g.band_id!=?`, s, bandId);
}
