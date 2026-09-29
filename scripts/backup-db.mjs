// Daily SQLite backup — WAL-safe via better-sqlite3's online backup API.
// Writes data/backups/roadie-YYYY-MM-DD.db and keeps the newest 14.
// Runs on container start + every 24h (see docker-compose command).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "roadie.db");
const backupDir = path.join(root, "data", "backups");
const KEEP = 14;

if (!fs.existsSync(dbPath)) {
  console.log("[backup] no DB yet, skipping");
  process.exit(0);
}
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const dest = path.join(backupDir, `roadie-${stamp}.db`);

const db = new Database(dbPath, { readonly: true });
await db.backup(dest);
db.close();
const size = fs.statSync(dest).size;
console.log(`[backup] wrote ${dest} (${(size / 1024).toFixed(0)} KB)`);

// Rotate: keep the newest KEEP backups
const old = fs.readdirSync(backupDir)
  .filter((f) => /^roadie-\d{4}-\d{2}-\d{2}\.db$/.test(f))
  .sort()
  .reverse()
  .slice(KEEP);
for (const f of old) {
  fs.rmSync(path.join(backupDir, f));
  console.log(`[backup] rotated out ${f}`);
}
