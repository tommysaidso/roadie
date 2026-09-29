import fs from "node:fs";
import path from "node:path";

// Local bucket for dev. In prod, point at R2 (S3-compatible) — same creds the
// .env already carries (R2_*). Kept simple/local here so it runs offline.
const DIR = path.join(process.cwd(), "data", "sessions");
const SAFE = /^[\w.-]+$/;

export function saveAudio(base64:string, ext:string): string {
  fs.mkdirSync(DIR, { recursive: true });
  const key = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext.replace(/[^a-z0-9]/gi,"")||"wav"}`;
  const b64 = base64.includes(",") ? base64.split(",")[1] : base64;
  fs.writeFileSync(path.join(DIR, key), Buffer.from(b64, "base64"));
  return key;
}
export function readAudio(key:string): Buffer | null {
  if(!SAFE.test(key)) return null;
  const f = path.join(DIR, key);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}
