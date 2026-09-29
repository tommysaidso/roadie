// STOCK SHELF — licensed footage and stills you already own.
//
// Ben has an Adobe Creative Cloud membership and a pile of Storyblocks credits,
// so there is rarely a reason to generate a plate that could be a real one.
//
// Why this is a FOLDER and not an API integration, plainly:
//
//   Storyblocks' API is a partner/affiliate programme with issued keys. A Pro
//   membership buys the website and the credits, not programmatic access — and
//   the login is through Facebook, so there is no key to hold even if there
//   were an endpoint. Automating that browser session would mean driving his
//   account as him, against their terms, with his social login. Not doing that.
//
// So the shelf is the honest version: download what you want, drop it in the
// folder, and every lane in the studio can reach it. No credentials, no
// scraping, no expiry, and it keeps working when a provider changes its mind.
//
// It sits on the NAS beside the render pool, so the same file is visible to the
// studio AND stageable into every machine's ComfyUI input dir — a stock still
// can be an i2v start frame or an img2img reference with no extra plumbing.

import fs from "node:fs";
import path from "node:path";

export const STOCK_DIR = process.env.ROADIE_STOCK_DIR ||
  "\\\\DXP4800UARX\\Unreal_Nas\\GenAi\\Stock";

const IMAGE = /\.(png|jpe?g|webp)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

export type StockItem = {
  id: string;            // relative path, url-safe
  name: string;
  folder: string;        // subfolder, "" at the root — the shelf's own grouping
  kind: "image" | "video";
  bytes: number;
  mtime: number;
};

/** Is the shelf mounted? Distinguishes "empty" from "unreachable". */
export function stockReachable(): { ok: boolean; detail: string } {
  try {
    fs.accessSync(STOCK_DIR);
    return { ok: true, detail: STOCK_DIR };
  } catch (e: any) {
    return { ok: false, detail: `Stock shelf not reachable at ${STOCK_DIR} — ${e?.code || e?.message || e}` };
  }
}

/**
 * List the shelf, one level of subfolders deep.
 *
 * Deliberately not fully recursive: people drop whole downloaded bundles in
 * here, and walking an unbounded tree over SMB on every page load is how a
 * simple picker turns into a five-second wait.
 */
export function listStock(limit = 400): StockItem[] {
  const out: StockItem[] = [];
  if (!stockReachable().ok) return out;

  const scan = (dir: string, folder: string, depth: number) => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth > 0) scan(full, folder ? `${folder}/${e.name}` : e.name, depth - 1);
        continue;
      }
      const kind = IMAGE.test(e.name) ? "image" : VIDEO.test(e.name) ? "video" : null;
      if (!kind) continue;
      let st: fs.Stats;
      try { st = fs.statSync(full); } catch { continue; }
      out.push({
        id: (folder ? `${folder}/${e.name}` : e.name),
        name: e.name, folder, kind,
        bytes: st.size, mtime: st.mtimeMs,
      });
    }
  };

  scan(STOCK_DIR, "", 1);
  // Newest first — you almost always want the thing you just downloaded.
  return out.sort((a, b) => b.mtime - a.mtime);
}

/**
 * Resolve an id back to a real path.
 *
 * The id comes from the client, so it is treated as hostile: resolved against
 * the shelf and rejected if it lands anywhere outside it. Without this,
 * "../../.env" is a file read.
 */
export function stockPath(id: string): string | null {
  const clean = String(id || "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0")) return null;
  const root = path.resolve(STOCK_DIR);
  const full = path.resolve(root, clean);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try { return fs.existsSync(full) ? full : null; } catch { return null; }
}

export function stockUrl(id: string) {
  return `/api/admin/studio/stock?file=${encodeURIComponent(id)}`;
}
