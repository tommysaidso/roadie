// PROFILES — one login, several hats.
//
// A person is not one thing. Ben runs UARX MixedReality Corp and EVPROD /
// Blackmudd Digital and is an artist. Dewey is DROP D, and also does music
// videos, and also sells to schools, churches and the public. The old model
// gave a user ONE band_id, ONE venue_id, ONE sponsor_id — so the second
// business had nowhere to go.
//
// A profile is (user, kind, ref_id): which record in bands / venues / sponsors
// / pros this person holds. A user may hold many, including several of the same
// kind, and switches between them.
//
// Two rules that keep this safe:
//
//   1. OWNERSHIP is the union of every profile you hold. Switching hats never
//      takes away access to something that is still yours — otherwise a switch
//      at the wrong moment locks you out of your own band.
//   2. The ACTIVE profile only decides what the UI leads with, and which world
//      you're treated as being in (an artist sees the catalog; a sponsor
//      doesn't). It is a view, not a permission.

import { all, one, run, getDb } from "./db";

export const PROFILE_KINDS = ["band", "venue", "sponsor", "pro"] as const;
export type ProfileKind = typeof PROFILE_KINDS[number];

export const PROFILE_COOKIE = "roadie_profile";

/** Where each kind's record lives, and the legacy column it came from. */
const SOURCES: Record<ProfileKind, { table: string; legacy: string; nameCol: string }> = {
  band:    { table: "bands",    legacy: "band_id",    nameCol: "name" },
  venue:   { table: "venues",   legacy: "venue_id",   nameCol: "name" },
  sponsor: { table: "sponsors", legacy: "sponsor_id", nameCol: "name" },
  pro:     { table: "pros",     legacy: "",           nameCol: "name" },
};

let ready = false;

export function ensureProfileSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,              -- band | venue | sponsor | pro
      ref_id INTEGER NOT NULL,         -- id in the matching table
      label TEXT,                      -- cached name, so a list doesn't fan out
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique ON profiles(user_id,kind,ref_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
  `);
  ready = true;
  backfillProfiles();
}

/**
 * Bring the old one-slot links across.
 *
 * Runs before anything reads profiles, and is idempotent — the unique index
 * makes a re-run a no-op. Nobody should have to re-link a band they already
 * had, and an empty profile table would otherwise read as "owns nothing".
 */
export function backfillProfiles() {
  const users = all<any>("SELECT id, band_id, venue_id, sponsor_id FROM users");
  for (const u of users) {
    for (const kind of ["band", "venue", "sponsor"] as ProfileKind[]) {
      const refId = Number(u[SOURCES[kind].legacy]);
      if (refId) addProfile(u.id, kind, refId, { silent: true });
    }
  }
  // Tables that point back at the user carry links the user row never had.
  for (const [kind, table] of [["band", "bands"], ["venue", "venues"], ["pro", "pros"]] as const) {
    let rows: any[] = [];
    try { rows = all<any>(`SELECT id, user_id FROM ${table} WHERE user_id IS NOT NULL`); } catch { continue; }
    for (const r of rows) addProfile(r.user_id, kind as ProfileKind, r.id, { silent: true });
  }
  // Exactly one default per user, so a switcher always has somewhere to land.
  for (const u of users) {
    const mine = all<any>("SELECT id FROM profiles WHERE user_id=? ORDER BY id", u.id);
    if (!mine.length) continue;
    const hasDefault = one<any>("SELECT id FROM profiles WHERE user_id=? AND is_default=1", u.id);
    if (!hasDefault) run("UPDATE profiles SET is_default=1 WHERE id=?", mine[0].id);
  }
}

function labelFor(kind: ProfileKind, refId: number): string {
  const src = SOURCES[kind];
  try {
    const row = one<any>(`SELECT ${src.nameCol} AS n FROM ${src.table} WHERE id=?`, refId);
    return String(row?.n || "").trim() || `${kind} #${refId}`;
  } catch { return `${kind} #${refId}`; }
}

export function addProfile(userId: number, kind: ProfileKind, refId: number,
                           opts: { silent?: boolean; makeDefault?: boolean } = {}) {
  if (!userId || !refId || !PROFILE_KINDS.includes(kind)) return null;
  // The record has to exist, or a typo'd id becomes a profile pointing nowhere.
  const src = SOURCES[kind];
  let exists: any = null;
  try { exists = one<any>(`SELECT id FROM ${src.table} WHERE id=?`, refId); } catch { exists = null; }
  if (!exists) { if (opts.silent) return null; throw new Error(`No ${kind} with id ${refId}.`); }

  const already = one<any>("SELECT * FROM profiles WHERE user_id=? AND kind=? AND ref_id=?",
    userId, kind, refId);
  if (already) {
    if (opts.makeDefault) setDefault(userId, already.id);
    return already;
  }
  const r = run("INSERT INTO profiles(user_id,kind,ref_id,label) VALUES(?,?,?,?)",
    userId, kind, refId, labelFor(kind, refId));
  const id = Number(r.lastInsertRowid);
  if (opts.makeDefault) setDefault(userId, id);
  return one<any>("SELECT * FROM profiles WHERE id=?", id);
}

export function setDefault(userId: number, profileId: number) {
  const p = one<any>("SELECT * FROM profiles WHERE id=? AND user_id=?", profileId, userId);
  if (!p) return null;
  run("UPDATE profiles SET is_default=0 WHERE user_id=?", userId);
  run("UPDATE profiles SET is_default=1 WHERE id=?", profileId);
  return p;
}

export function profilesFor(userId: number) {
  if (!userId) return [];
  // Labels are cached at insert; refresh on read so a renamed band isn't stale.
  return all<any>("SELECT * FROM profiles WHERE user_id=? ORDER BY kind, id", userId)
    .map(p => ({ ...p, label: labelFor(p.kind, p.ref_id) }));
}

/**
 * The profile this request is acting as.
 *
 * The cookie is only ever a hint: it is checked against the profiles this user
 * actually holds, so a hand-edited cookie selects nothing. Falls back to their
 * default, then to their first.
 */
export function activeProfile(user: any, cookieValue?: string | null) {
  if (!user?.id) return null;
  const mine = profilesFor(user.id);
  if (!mine.length) return null;
  const wanted = Number(cookieValue);
  if (wanted) {
    const hit = mine.find(p => Number(p.id) === wanted);
    if (hit) return hit;
  }
  return mine.find(p => p.is_default) || mine[0];
}

/** Every ref_id of a kind this user holds — the union that ownership uses. */
export function ownedIds(user: any, kind: ProfileKind): number[] {
  if (!user?.id) return [];
  try {
    return all<any>("SELECT ref_id FROM profiles WHERE user_id=? AND kind=?", user.id, kind)
      .map(r => Number(r.ref_id));
  } catch { return []; }
}
