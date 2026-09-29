import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Single shared connection (Next dev re-imports modules; cache on globalThis).
const DB_PATH = path.join(process.cwd(), "data", "roadie.db");

declare global { var __roadieDb: Database.Database | undefined; }

export function getDb(): Database.Database {
  if (!globalThis.__roadieDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    // idempotent column additions — safe to re-run
    try { db.exec("ALTER TABLE sponsors ADD COLUMN rep_brand TEXT"); } catch {}
    try { db.exec("ALTER TABLE sponsors ADD COLUMN rep_role  TEXT"); } catch {}
    // fan experience
    try { db.exec("ALTER TABLE notices ADD COLUMN reactions INTEGER DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE notices ADD COLUMN contact TEXT"); } catch {}
    try { db.exec("ALTER TABLE stops ADD COLUMN pricing_model TEXT DEFAULT 'ticketed'"); } catch {}
    try { db.exec("ALTER TABLE stops ADD COLUMN suggested_donation INTEGER"); } catch {}
    try { db.exec("ALTER TABLE stops ADD COLUMN community_split INTEGER DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE stops ADD COLUMN nearest_hospital TEXT"); } catch {}
    try { db.exec("ALTER TABLE stops ADD COLUMN nearest_police TEXT"); } catch {}
    try { db.exec("ALTER TABLE stops ADD COLUMN nearest_fire TEXT"); } catch {}
    db.exec(`CREATE TABLE IF NOT EXISTS fan_stop_requests (
      id INTEGER PRIMARY KEY,
      city TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'BC',
      email TEXT,
      note TEXT,
      count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS pitch_docs (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    // band payout preferences
    try { db.exec("ALTER TABLE bands ADD COLUMN payout_method TEXT DEFAULT 'etransfer'"); } catch {}
    // payout_method: etransfer | eft | crypto | cheque
    try { db.exec("ALTER TABLE bands ADD COLUMN payout_wallet TEXT"); } catch {}
    // payout_wallet: crypto wallet address (any chain — USDC/ETH/SOL/BTC) or email for e-Transfer
    try { db.exec("ALTER TABLE bands ADD COLUMN payout_coin TEXT"); } catch {}
    // payout_coin: usdc | eth | sol | btc (relevant when payout_method='crypto')
    // billing columns on existing tables
    try { db.exec("ALTER TABLE sponsor_offers ADD COLUMN currency TEXT DEFAULT 'cad'"); } catch {}
    try { db.exec("ALTER TABLE sponsor_offers ADD COLUMN stripe_invoice_id TEXT"); } catch {}
    try { db.exec("ALTER TABLE sponsor_offers ADD COLUMN payment_link TEXT"); } catch {}
    try { db.exec("ALTER TABLE sponsor_offers ADD COLUMN paid_at TEXT"); } catch {}
    try { db.exec("ALTER TABLE vendor_spots ADD COLUMN stripe_invoice_id TEXT"); } catch {}
    try { db.exec("ALTER TABLE vendor_spots ADD COLUMN payment_link TEXT"); } catch {}
    // fan multicam — guest capture (QR at a show, no ROADIE account required)
    try { db.exec("ALTER TABLE fan_clips ADD COLUMN guest_email TEXT"); } catch {}
    // A standing sandbox stop for testing the QR/upload/multicam pipeline
    // without ever mixing test clips into a real show's roster. Flagged
    // rather than date-based, so it can't silently age off the "recent
    // shows" list the way a fixed-date stop eventually would.
    try { db.exec("ALTER TABLE stops ADD COLUMN is_test INTEGER DEFAULT 0"); } catch {}
    // Metadata timeline sync: the phone's own record-start clock, captured
    // client-side (never the file container's timestamp — see fanclips.ts).
    // Used to seed/validate the audio alignment and as a fallback placement
    // when a clip's audio is unusable. align_method records which one a
    // clip actually got placed by, so an operator can see it at a glance.
    try { db.exec("ALTER TABLE fan_clips ADD COLUMN recorded_started_at_ms INTEGER"); } catch {}
    try { db.exec("ALTER TABLE fan_clips ADD COLUMN align_method TEXT"); } catch {}
    // Per-show share token, opt-in: a stop with no token keeps working on its
    // bare /shoot?stop=<id> link exactly as before -- adding this feature must
    // never break a link or QR that's already printed or already shared.
    // Regenerating (see lib/shareTokens.ts) is how a leaked/abused link for a
    // show gets shut off without touching anything else in the roster.
    try { db.exec("ALTER TABLE stops ADD COLUMN share_token TEXT"); } catch {}
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS stop_qr_archive (
        id INTEGER PRIMARY KEY,
        stop_id INTEGER REFERENCES stops(id),
        token TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        revoked_at TEXT
      )`);
    } catch {}
    db.exec(`CREATE TABLE IF NOT EXISTS billing_payments (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      stripe_invoice_id TEXT,
      coinbase_charge_id TEXT,
      amount INTEGER,
      currency TEXT DEFAULT 'cad',
      status TEXT DEFAULT 'pending',
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(stripe_invoice_id)
    )`);
    globalThis.__roadieDb = db;
  }
  return globalThis.__roadieDb;
}

// Small helpers
export function all<T = any>(sql: string, ...p: any[]): T[] {
  return getDb().prepare(sql).all(...p) as T[];
}
export function one<T = any>(sql: string, ...p: any[]): T | undefined {
  return getDb().prepare(sql).get(...p) as T | undefined;
}
export function run(sql: string, ...p: any[]) {
  return getDb().prepare(sql).run(...p);
}
