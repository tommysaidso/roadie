// BAND MEMBERSHIP — who is in a band, and who runs it.
//
// Until now "your band" meant one column: bands.user_id, the controller. That
// works for a solo act and falls apart the moment a real band turns up, because
// it cannot express the two things that are actually true:
//
//   - Dewey RUNS There's No End, but he is also just a MEMBER of another band
//     his mate controls. He should see both, and only run one of them.
//   - Greg is in the band but does not want to upload anything. He should still
//     be a member, still be listed, still see it — without being handed the keys.
//
// So membership is its own thing, with a role. Control is a role, not an
// identity, and the two stop being the same word.
//
// The removal rule matters as much as the joining one: taking someone out of a
// band NEVER deletes their account. They stop being in that band and go back to
// being a solo artist — their profile, their songs and their rights are theirs,
// not the band's. Anything else would make leaving a band a punishment.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureMemberSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS band_members (
      id INTEGER PRIMARY KEY,
      band_id INTEGER NOT NULL REFERENCES bands(id),
      -- Null until they actually sign up. An invited member is a real row
      -- straight away so the controller can see who they are waiting on.
      user_id INTEGER,
      email TEXT DEFAULT '',
      name TEXT DEFAULT '',
      instrument TEXT DEFAULT '',
      role TEXT DEFAULT 'member',     -- controller | member
      status TEXT DEFAULT 'invited',  -- invited | active | inactive | removed
      invited_by INTEGER,
      invited_at TEXT DEFAULT (datetime('now')),
      joined_at TEXT,
      UNIQUE(band_id, email)
    );
    CREATE INDEX IF NOT EXISTS idx_band_members_band ON band_members(band_id);
    CREATE INDEX IF NOT EXISTS idx_band_members_user ON band_members(user_id);
  `);
  ready = true;
}

export const isOperator = (u: any) =>
  !!u && ["admin", "owner"].includes(String(u.role || ""));

/** Bands this login CONTROLS — may edit, invite to, remove from. */
export function controlledBandIds(user: any): number[] {
  ensureMemberSchema();
  if (!user?.id) return [];
  const ids = new Set<number>();
  try {
    all<any>("SELECT id FROM bands WHERE user_id=?", user.id).forEach(r => ids.add(Number(r.id)));
  } catch {}
  try {
    all<any>("SELECT band_id FROM band_members WHERE user_id=? AND role='controller' AND status='active'",
      user.id).forEach(r => ids.add(Number(r.band_id)));
  } catch {}
  if (user.band_id) ids.add(Number(user.band_id));
  return [...ids];
}

/**
 * Bands this login is IN — including ones somebody else runs.
 *
 * The point of the whole file: Dewey is in his mate's band and should see it
 * on his shelf without being able to rename it.
 */
export function memberBandIds(user: any): number[] {
  ensureMemberSchema();
  if (!user?.id) return [];
  try {
    return all<any>(
      "SELECT band_id FROM band_members WHERE user_id=? AND status IN ('active','invited')", user.id)
      .map(r => Number(r.band_id));
  } catch { return []; }
}

export function canControl(user: any, bandId: number) {
  return isOperator(user) || controlledBandIds(user).includes(Number(bandId));
}

export function membersOf(bandId: number) {
  ensureMemberSchema();
  return all<any>(`
    SELECT m.*, u.display_name user_name, u.email user_email
      FROM band_members m LEFT JOIN users u ON u.id=m.user_id
     WHERE m.band_id=? AND m.status!='removed'
     ORDER BY CASE m.role WHEN 'controller' THEN 0 ELSE 1 END, m.id`, bandId);
}

/**
 * Invite someone. Idempotent on email — inviting twice is almost always
 * "did that send?", not an intent to create a duplicate.
 */
export function invite(bandId: number, o: {
  email: string; name?: string; instrument?: string; role?: string; by?: number;
}) {
  ensureMemberSchema();
  const email = String(o.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That isn't an email address." };

  // If they already have an account, link it now so they arrive already joined.
  const u = one<any>("SELECT id FROM users WHERE lower(email)=?", email);
  const existing = one<any>("SELECT * FROM band_members WHERE band_id=? AND email=?", bandId, email);

  if (existing) {
    run(`UPDATE band_members SET name=COALESCE(NULLIF(?,''),name),
           instrument=COALESCE(NULLIF(?,''),instrument),
           status=CASE WHEN status IN ('removed','inactive') THEN 'invited' ELSE status END,
           user_id=COALESCE(user_id,?)
         WHERE id=?`,
      String(o.name || ""), String(o.instrument || ""), u?.id ?? null, existing.id);
    return { member: one<any>("SELECT * FROM band_members WHERE id=?", existing.id), already: true };
  }

  const r = run(`INSERT INTO band_members(band_id,user_id,email,name,instrument,role,status,invited_by,joined_at)
                 VALUES(?,?,?,?,?,?,?,?,?)`,
    bandId, u?.id ?? null, email, String(o.name || "").slice(0, 80),
    String(o.instrument || "").slice(0, 60),
    o.role === "controller" ? "controller" : "member",
    u ? "active" : "invited",                 // a known account is in immediately
    o.by ?? null, u ? new Date().toISOString() : null);
  return { member: one<any>("SELECT * FROM band_members WHERE id=?", Number(r.lastInsertRowid)) };
}

/** Turn a member off without throwing them out — the "deselect" case. */
export function setStatus(bandId: number, memberId: number, status: string) {
  ensureMemberSchema();
  const ok = ["active", "inactive", "invited"].includes(status);
  if (!ok) return { error: "Not a status." };
  run("UPDATE band_members SET status=? WHERE id=? AND band_id=?", status, memberId, bandId);
  return { member: one<any>("SELECT * FROM band_members WHERE id=?", memberId) };
}

export function setRole(bandId: number, memberId: number, role: string) {
  ensureMemberSchema();
  run("UPDATE band_members SET role=? WHERE id=? AND band_id=?",
    role === "controller" ? "controller" : "member", memberId, bandId);
  return { member: one<any>("SELECT * FROM band_members WHERE id=?", memberId) };
}

/**
 * Remove someone from the band. Their ACCOUNT survives.
 *
 * They go back to being a solo artist: the band link is cut, the login, the
 * profile and anything they wrote stay theirs. A band cannot delete a person.
 */
export function removeMember(bandId: number, memberId: number) {
  ensureMemberSchema();
  const m = one<any>("SELECT * FROM band_members WHERE id=? AND band_id=?", memberId, bandId);
  if (!m) return { error: "Not in this band." };

  run("UPDATE band_members SET status='removed', role='member' WHERE id=?", memberId);

  if (m.user_id) {
    // Cut the band link only where it points at THIS band, and only if they do
    // not still control it. Never touch the account itself.
    try {
      run("UPDATE users SET band_id=NULL WHERE id=? AND band_id=?", m.user_id, bandId);
      run("DELETE FROM profiles WHERE user_id=? AND kind='band' AND ref_id=?", m.user_id, bandId);
      // Downgrade to solo artist only if that leaves them in no band at all.
      const left = one<any>(
        "SELECT COUNT(*) n FROM band_members WHERE user_id=? AND status IN ('active','invited')", m.user_id);
      if (!Number(left?.n || 0)) {
        run("UPDATE users SET role=CASE WHEN role='band' THEN 'artist' ELSE role END WHERE id=?", m.user_id);
      }
    } catch { /* the membership row is already gone; account edits are best effort */ }
  }
  return { removed: true, kept_account: true };
}

/**
 * Link a member row to a login once they sign up.
 *
 * Called on sign-in/sign-up so an invited person becomes active the moment
 * they arrive, without the controller having to do anything.
 */
export function linkUserByEmail(userId: number, email: string) {
  ensureMemberSchema();
  const e = String(email || "").trim().toLowerCase();
  if (!e) return 0;
  try {
    const rows = all<any>("SELECT id, band_id FROM band_members WHERE email=? AND user_id IS NULL", e);
    for (const r of rows) {
      run("UPDATE band_members SET user_id=?, status='active', joined_at=datetime('now') WHERE id=?",
        userId, r.id);
    }
    return rows.length;
  } catch { return 0; }
}

/** How complete is this member's setup? Drives the green tick. */
export function memberProgress(m: any) {
  const has = (v: any) => !!String(v || "").trim();
  const steps = [
    { k: "invited", done: true },
    { k: "signed up", done: !!m.user_id },
    { k: "named", done: has(m.name) || has(m.user_name) },
    { k: "instrument", done: has(m.instrument) },
  ];
  const done = steps.filter(s => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length && m.status === "active" };
}
