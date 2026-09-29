import crypto from "node:crypto";
import { getDb, one, run } from "./db";
import { resolveRole } from "./roles";

// First-login invites. Nobody is ever sent a password — they get a one-time
// link and choose their own. The token is stored as a HASH, so a leak of the
// database does not hand out working links.

const TTL_HOURS = Number(process.env.INVITE_TTL_HOURS || 168); // 7 days

export function ensureInviteSchema() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT,                       -- resolved at redeem time from the email
    invited_by INTEGER,
    expires TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  getDb().exec(`CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email)`);
}

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Returns the raw token — show it once, in the link, then forget it. */
export function createInvite(email: string, invitedBy?: number): string {
  ensureInviteSchema();
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TTL_HOURS * 3600e3).toISOString();
  // one live invite per address
  run("DELETE FROM invites WHERE email=? AND used_at IS NULL", String(email).toLowerCase());
  run("INSERT INTO invites(email,token_hash,role,invited_by,expires) VALUES(?,?,?,?,?)",
      String(email).toLowerCase(), hash(token), resolveRole(email), invitedBy || null, expires);
  return token;
}

export function inviteFor(token: string): any {
  ensureInviteSchema();
  const row: any = one("SELECT * FROM invites WHERE token_hash=?", hash(token));
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires) < new Date()) return null;
  return row;
}

export function consumeInvite(token: string) {
  run("UPDATE invites SET used_at=datetime('now') WHERE token_hash=?", hash(token));
}

export function inviteLink(token: string): string {
  const base = process.env.ROADIE_PUBLIC_URL || "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/welcome?t=${token}`;
}
