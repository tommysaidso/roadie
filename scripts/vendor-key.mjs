// Issue (or replace) a vendor's private key and print their capture and inbox links.
//   node scripts/vendor-key.mjs <slug>
// Only the hash is stored; the key is shown once. Issuing again invalidates the old link.
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const slug = process.argv[2];
if (!slug || !fs.existsSync(path.join(process.cwd(), "content", "vendors", slug + ".json"))) {
  console.error("usage: node scripts/vendor-key.mjs <slug>  (content/vendors/<slug>.json must exist)");
  process.exit(1);
}
const db = new Database(path.join(process.cwd(), "data", "roadie.db"));
db.exec(`CREATE TABLE IF NOT EXISTS vendor_keys(vendor_slug TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
const key = crypto.randomBytes(24).toString("base64url");
const hash = crypto.createHash("sha256").update(key).digest("hex");
db.prepare("INSERT INTO vendor_keys(vendor_slug,key_hash) VALUES(?,?) ON CONFLICT(vendor_slug) DO UPDATE SET key_hash=excluded.key_hash, created_at=datetime('now')").run(slug, hash);
const site = process.env.NEXT_PUBLIC_SITE_URL || "https://roadie.mymymy.studio";
console.log(`capture: ${site}/vendors/${slug}/capture?key=${key}`);
console.log(`inbox:   ${site}/api/vendors/${slug}/request?key=${key}`);
