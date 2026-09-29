// GIG BAG — what the band carries, and what they sell.
//
// Two halves of the same page:
//   KIT   — per member, the instruments they bring. A clean collapsed list, so
//           a host or a backline sponsor can see what a room has to hold.
//   MERCH — what they sell, with the band's OWN store link. ROADIE never takes
//           the money; it sends the buyer to the band's shop.
//
// The showcase images run on the same NAS render pool as everything else, so
// making merch art costs nothing but electricity — no per-image API bill.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { all, one, run, getDb } from "./db";
import {
  buildWorkflow, dropWorkorder, newWorkorderId, pollPool,
  poolReachable, refStoreDir, stageReference, resolveOutputImage,
} from "./studio";

let ready = false;

export function ensureGigBagSchema() {
  if (ready) return;
  getDb().exec(`
    -- One row per member's kit. Free-text instruments: a fiddle player's list
    -- shouldn't have to fit a dropdown somebody else imagined.
    CREATE TABLE IF NOT EXISTS gig_bag (
      id INTEGER PRIMARY KEY,
      band_id INTEGER REFERENCES bands(id),
      member_name TEXT NOT NULL,
      role TEXT DEFAULT '',            -- what they play in the band
      instruments TEXT DEFAULT '[]',   -- JSON array of strings
      needs TEXT DEFAULT '',           -- what they need the room to supply
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_gig_bag_band ON gig_bag(band_id);

    -- Merch. The url column is the band's own shop / drop-shipper order link;
    -- ROADIE is a shop window, not a till.
    CREATE TABLE IF NOT EXISTS merch_items (
      id INTEGER PRIMARY KEY,
      band_id INTEGER REFERENCES bands(id),
      title TEXT NOT NULL,
      kind TEXT DEFAULT 'other',       -- shirt | hoodie | hat | vinyl | cd | sticker | poster | other
      price_cad INTEGER,
      url TEXT DEFAULT '',             -- overrides the band's shop link for this item
      photo TEXT,                      -- their own uploaded photo (basename)
      showcase_status TEXT,            -- null | queued | done | failed
      showcase_style TEXT,             -- photoreal | toon
      showcase_workorder TEXT,
      showcase_file TEXT,              -- JSON {filename,subfolder}
      showcase_error TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_merch_band ON merch_items(band_id);
  `);
  ready = true;
}

// ---------------------------------------------------------------------------
// Showcase generation
// ---------------------------------------------------------------------------

/**
 * Two styles. That's the whole menu, on purpose.
 *
 * `strength` is denoise: LOW so the actual product survives. A merch shot that
 * reimagines the shirt is worthless — the buyer receives the real one.
 */
export const MERCH_STYLES = {
  photoreal: {
    label: "Photo",
    look: "PHOTOREAL",
    strength: 0.38,
    prompt: "product photograph of the item on a clean seamless studio backdrop, " +
            "soft even lighting, sharp focus, catalogue shot, centred, no people",
  },
  toon: {
    label: "Toon",
    look: "COMIC",
    strength: 0.45,
    prompt: "bold clean illustrated product art of the item, flat colour, " +
            "graphic poster style, strong outline, plain background, centred",
  },
} as const;

export type MerchStyle = keyof typeof MERCH_STYLES;

export function styleOf(name?: string) {
  const k = String(name || "photoreal") as MerchStyle;
  return MERCH_STYLES[k] ? { key: k, ...MERCH_STYLES[k] } : { key: "photoreal" as MerchStyle, ...MERCH_STYLES.photoreal };
}

export const MERCH_DIR = process.env.ROADIE_MERCH_DIR ||
  path.join(process.cwd(), "data", "merch");

const ALLOWED = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" } as Record<string, string>;
export const MAX_UPLOAD = 24 * 1024 * 1024;

/** Store a band's own merch photo. Returns its basename. */
export function saveMerchPhoto(bytes: Buffer, mime: string, bandId: number) {
  const ext = ALLOWED[mime];
  if (!ext) throw new Error(`${mime || "That file"} isn't an image. Use PNG, JPEG or WebP.`);
  fs.mkdirSync(MERCH_DIR, { recursive: true });
  const hash = crypto.createHash("sha1").update(new Uint8Array(bytes)).digest("hex").slice(0, 12);
  const base = `merch_${bandId}_${hash}${ext}`;
  fs.writeFileSync(path.join(MERCH_DIR, base), new Uint8Array(bytes));
  return base;
}

export function merchPhotoPath(basename: string) {
  const p = path.join(MERCH_DIR, path.basename(basename));
  return fs.existsSync(p) ? p : null;
}

/**
 * Queue one showcase render from the band's own photo.
 *
 * Deliberately no knobs: pick a style, press go. Steps and guidance are fixed
 * because a merch photo doesn't get better for being fiddled with, and every
 * extra render is fleet time somebody else is waiting on.
 */
export function queueShowcase(item: any, styleName: string) {
  const reach = poolReachable();
  if (!reach.ok) throw new Error(reach.detail);

  const photo = item.photo ? merchPhotoPath(item.photo) : null;
  if (!photo) throw new Error("Add a photo of the item first — the showcase is built from your own picture.");

  const style = styleOf(styleName);
  const workorderId = newWorkorderId();

  // The photo has to be inside the ComfyUI input dir of whichever machine
  // claims this; Playtime's poller never uploads input_assets itself.
  const staged = stageReference(photo, path.basename(photo), workorderId);
  if (!staged.staged.length) {
    throw new Error(`Couldn't put the photo on any render machine. ${staged.failed.join(" | ")}`);
  }

  const built = buildWorkflow({
    prompt: [style.prompt, item.title].filter(Boolean).join(", "),
    look: style.look,
    size: "square",              // merch reads best square in a grid
    reference: path.basename(photo),
    strength: style.strength,
    steps: 26,
    cfg: 6,
  });

  dropWorkorder({
    workorderId,
    graph: built.workflow,
    name: `roadie_merch__${item.band_id}__${item.id}`,
    target: "4070",
    inputAssets: built.inputAssets,
  });

  run(`UPDATE merch_items
          SET showcase_status='queued', showcase_style=?, showcase_workorder=?,
              showcase_error=NULL, showcase_file=NULL
        WHERE id=?`, style.key, workorderId, item.id);

  return { workorderId, style: style.key };
}

/** Move any queued showcases for this band forward. Read-only against the pool. */
export function refreshShowcases(bandId: number) {
  const rows = all<any>(
    "SELECT * FROM merch_items WHERE band_id=? AND showcase_status='queued' AND showcase_workorder IS NOT NULL",
    bandId);
  for (const r of rows) {
    const p = pollPool(r.showcase_workorder);
    if (p.status === "queued") continue;
    run("UPDATE merch_items SET showcase_status=?, showcase_file=?, showcase_error=? WHERE id=?",
      p.status, p.images?.[0] ? JSON.stringify(p.images[0]) : null, p.error || null, r.id);
  }
}

/** Absolute path of a finished showcase, or null. */
export function showcasePath(item: any): string | null {
  if (!item?.showcase_file) return null;
  try {
    const f = JSON.parse(item.showcase_file);
    return resolveOutputImage(f.subfolder || "", f.filename);
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function kitFor(bandId: number) {
  return all<any>("SELECT * FROM gig_bag WHERE band_id=? ORDER BY position, id", bandId)
    .map(r => { let i: string[] = []; try { i = JSON.parse(r.instruments || "[]"); } catch {} return { ...r, instruments: i }; });
}

export function merchFor(bandId: number) {
  return all<any>("SELECT * FROM merch_items WHERE band_id=? ORDER BY position, id", bandId);
}

/** Bands this user may edit. Operators see everything; a member sees theirs. */
export function bandsFor(user: any) {
  if (!user) return [];
  const elevated = ["super_admin", "manager", "admin", "operator"].includes(String(user.role || ""));
  if (elevated) return all<any>("SELECT id,name,links,home_city FROM bands ORDER BY name");
  if (user.band_id) return all<any>("SELECT id,name,links,home_city FROM bands WHERE id=?", Number(user.band_id));
  return [];
}

/** The band's own shop link, set in Connect. */
export function shopLink(band: any): string {
  try {
    const l = JSON.parse(band?.links || "{}");
    return String(l.merch || l.store || "").trim();
  } catch { return ""; }
}
