// Invite someone to the backend, at a role you choose.
//
//   node scripts/invite-operator.mjs <email> [role] ["Display Name"]
//
// Why this exists rather than the /api/auth/invite route: that route resolves
// the role FROM THE EMAIL, which means anyone outside our own addresses lands
// as "fan" no matter what they were promised. This creates the account at the
// role first — and because resolveRole() never downgrades a privileged role,
// redeeming the invite afterwards keeps it.
//
// Nobody is ever sent a password. They get a one-time link and choose their own,
// and the token is stored only as a hash so a copy of the database hands out
// nothing.
//
// ROLES, least to most:
//   operator    every backend console, read and act — cannot staff stops or
//               assign members. The right level for a partner or a contractor.
//   admin       same reach as operator in every current check.
//   manager     operator PLUS staffing stops and assigning members.
//   super_admin owns the platform. Only us.

import crypto from "node:crypto";
import Database from "better-sqlite3";

const [, , emailArg, roleArg = "operator", nameArg = ""] = process.argv;

const email = String(emailArg || "").toLowerCase().trim();
if (!/.+@.+\..+/.test(email)) {
  console.error("Usage: node scripts/invite-operator.mjs <email> [role] [\"Display Name\"]");
  process.exit(1);
}

const ALLOWED = ["operator", "admin", "manager", "super_admin"];
const role = String(roleArg).toLowerCase();
if (!ALLOWED.includes(role)) {
  console.error(`Role must be one of: ${ALLOWED.join(", ")}`);
  process.exit(1);
}

const db = new Database("data/roadie.db");
const TTL_HOURS = Number(process.env.INVITE_TTL_HOURS || 168);
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

db.exec(`CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  role TEXT, invited_by INTEGER, expires TEXT NOT NULL, used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')))`);

// 1) the account, at the role, with no password yet
const existing = db.prepare("SELECT id, role FROM users WHERE lower(email)=?").get(email);
let userId;
if (existing) {
  userId = existing.id;
  if (existing.role !== role) {
    db.prepare("UPDATE users SET role=? WHERE id=?").run(role, userId);
    console.log(`[invite] existing account ${email}: role ${existing.role} -> ${role}`);
  } else {
    console.log(`[invite] existing account ${email} already ${role}`);
  }
} else {
  const r = db.prepare(
    "INSERT INTO users(email, display_name, role) VALUES(?,?,?)",
  ).run(email, nameArg || "", role);
  userId = r.lastInsertRowid;
  console.log(`[invite] created account ${email} as ${role} (id ${userId})`);
}

// 2) one live invite per address
const token = crypto.randomBytes(32).toString("base64url");
db.prepare("DELETE FROM invites WHERE email=? AND used_at IS NULL").run(email);
db.prepare(
  "INSERT INTO invites(email, token_hash, role, expires) VALUES(?,?,?,?)",
).run(email, sha(token), role, new Date(Date.now() + TTL_HOURS * 3600e3).toISOString());

const base = (process.env.ROADIE_PUBLIC_URL || "https://roadie.mymymy.studio").replace(/\/$/, "");
console.log(`\n[invite] link (valid ${TTL_HOURS}h, one use):\n${base}/welcome?t=${token}\n`);
