// BETA TEAMS — a group an admin owns, invites, writes to and tracks.
//
// Dewey needs to run his own testers: bring people in, tell them things, and
// know who actually got told. Today the platform can invite one person at a
// time and send one email at a time, with nothing joining the two together and
// no record afterwards.
//
// Deliberately scoped to the OWNER, not to Dewey. Any admin gets their own
// teams and sees only their own — the feature is "run a cohort", and building
// it around one person's name would mean rebuilding it for the second person
// who asks.
//
// Two rules this is built around:
//
//   1. NOTHING SENDS ITSELF. Every send is a person pressing a button, having
//      read the words. There is no scheduler and no trigger here on purpose.
//   2. EVERY SEND IS RECORDED, including the failures. "Did they get it?" is
//      the question the whole feature exists to answer, and a send log that
//      only keeps successes cannot answer it.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureBetaSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS beta_teams (
      id INTEGER PRIMARY KEY,
      owner_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- LEVELS. The team owner decides what a tester gets and for how long,
    -- rather than the platform hard-coding "3 months free" for everyone. A
    -- founding tester and someone who joined last week are not owed the same
    -- thing, and the person running the cohort is the one who knows that.
    CREATE TABLE IF NOT EXISTS beta_levels (
      id INTEGER PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES beta_teams(id),
      name TEXT NOT NULL,
      free_months REAL DEFAULT 3,        -- how long they get for taking part
      referral_bonus_months REAL DEFAULT 1,  -- added when someone they bring signs up
      perks TEXT DEFAULT '',             -- anything not measured in months
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS beta_members (
      id INTEGER PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES beta_teams(id),
      email TEXT NOT NULL,
      name TEXT DEFAULT '',
      -- Which band this tester belongs to, so "send to that band's people" is
      -- a filter rather than a memory exercise.
      band_id INTEGER,
      level_id INTEGER REFERENCES beta_levels(id),
      status TEXT DEFAULT 'invited',   -- invited | joined | bounced | removed
      invited_at TEXT DEFAULT (datetime('now')),
      joined_at TEXT,
      UNIQUE(team_id, email)
    );

    CREATE TABLE IF NOT EXISTS beta_messages (
      id INTEGER PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES beta_teams(id),
      sender_user_id INTEGER,
      band_id INTEGER,                 -- null = the whole team
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_ok INTEGER DEFAULT 0,
      sent_fail INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS beta_sends (
      id INTEGER PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES beta_messages(id),
      member_id INTEGER,
      email TEXT NOT NULL,
      ok INTEGER DEFAULT 0,
      error TEXT,
      sent_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_beta_members_team ON beta_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_beta_sends_msg ON beta_sends(message_id);
  `);
  ready = true;
}

export const isAdmin = (u: any) =>
  !!u && (u.role === "admin" || u.role === "owner" || u.is_admin === 1);

/** Teams this admin owns. Never anyone else's. */
export function teamsFor(userId: number) {
  ensureBetaSchema();
  return all<any>(`
    SELECT t.*,
           (SELECT COUNT(*) FROM beta_members m WHERE m.team_id=t.id AND m.status!='removed') members,
           (SELECT COUNT(*) FROM beta_members m WHERE m.team_id=t.id AND m.status='joined') joined
      FROM beta_teams t WHERE t.owner_user_id=? ORDER BY t.id DESC`, userId);
}

export function ownsTeam(userId: number, teamId: number) {
  ensureBetaSchema();
  return !!one<any>("SELECT 1 x FROM beta_teams WHERE id=? AND owner_user_id=?", teamId, userId);
}

export function createTeam(userId: number, name: string, note = "") {
  ensureBetaSchema();
  const r = run("INSERT INTO beta_teams(owner_user_id,name,note) VALUES(?,?,?)",
    userId, name.slice(0, 80), note.slice(0, 400));
  const id = Number(r.lastInsertRowid);
  seedLevels(id);   // usable the moment it exists
  return one<any>("SELECT * FROM beta_teams WHERE id=?", id);
}

/** Levels this team offers, best first. */
export function levelsFor(teamId: number) {
  ensureBetaSchema();
  return all<any>(`SELECT l.*,
      (SELECT COUNT(*) FROM beta_members m WHERE m.level_id=l.id AND m.status!='removed') members
      FROM beta_levels l WHERE l.team_id=? ORDER BY l.position, l.id`, teamId);
}

export function saveLevel(teamId: number, lv: {
  id?: number; name: string; free_months?: number; referral_bonus_months?: number;
  perks?: string; position?: number;
}) {
  ensureBetaSchema();
  // Months are clamped, not trusted. A typo that hands out 500 free months is
  // a real cost, and the owner has no reason to need more than a couple of years.
  const months = (v: any, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(24, n)) : d;
  };
  const free = months(lv.free_months, 3);
  const bonus = months(lv.referral_bonus_months, 1);
  if (lv.id) {
    run(`UPDATE beta_levels SET name=?, free_months=?, referral_bonus_months=?, perks=?, position=?
          WHERE id=? AND team_id=?`,
      lv.name.slice(0, 60), free, bonus, String(lv.perks || "").slice(0, 400),
      Number(lv.position) || 0, lv.id, teamId);
    return one<any>("SELECT * FROM beta_levels WHERE id=?", lv.id);
  }
  const r = run(`INSERT INTO beta_levels(team_id,name,free_months,referral_bonus_months,perks,position)
                 VALUES(?,?,?,?,?,?)`,
    teamId, lv.name.slice(0, 60), free, bonus,
    String(lv.perks || "").slice(0, 400), Number(lv.position) || 0);
  return one<any>("SELECT * FROM beta_levels WHERE id=?", Number(r.lastInsertRowid));
}

export function deleteLevel(teamId: number, id: number) {
  ensureBetaSchema();
  // Members keep existing; they just fall back to no level rather than vanishing.
  run("UPDATE beta_members SET level_id=NULL WHERE level_id=? AND team_id=?", id, teamId);
  run("DELETE FROM beta_levels WHERE id=? AND team_id=?", id, teamId);
}

/** Seed a starting ladder so a new team is usable immediately. */
export function seedLevels(teamId: number) {
  ensureBetaSchema();
  if (levelsFor(teamId).length) return;
  const rows: [string, number, number, string][] = [
    ["Founding tester", 6, 1, "First in. Named on the platform, direct line to the team."],
    ["Beta tester", 3, 1, "The standard run — three months on us."],
    ["Guest", 1, 0, "A look around, no commitment."],
  ];
  rows.forEach(([name, free, bonus, perks], i) =>
    saveLevel(teamId, { name, free_months: free, referral_bonus_months: bonus, perks, position: i }));
}

export function membersFor(teamId: number, bandId?: number | null) {
  ensureBetaSchema();
  return bandId
    ? all<any>(`SELECT m.*, b.name band, l.name level, l.free_months, l.referral_bonus_months
                  FROM beta_members m LEFT JOIN bands b ON b.id=m.band_id
                  LEFT JOIN beta_levels l ON l.id=m.level_id
                 WHERE m.team_id=? AND m.band_id=? AND m.status!='removed' ORDER BY m.id`, teamId, bandId)
    : all<any>(`SELECT m.*, b.name band, l.name level, l.free_months, l.referral_bonus_months
                  FROM beta_members m LEFT JOIN bands b ON b.id=m.band_id
                  LEFT JOIN beta_levels l ON l.id=m.level_id
                 WHERE m.team_id=? AND m.status!='removed' ORDER BY m.id`, teamId);
}

/**
 * Add testers. Idempotent on email so pasting the same list twice does not
 * create duplicates — which matters because the second paste is usually
 * "did that work?" rather than an intent to invite them again.
 */
export function addMembers(teamId: number, rows: { email: string; name?: string; band_id?: number | null; level_id?: number | null }[]) {
  ensureBetaSchema();
  let added = 0, updated = 0;
  for (const r of rows) {
    const email = String(r.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    const exists = one<any>("SELECT id FROM beta_members WHERE team_id=? AND email=?", teamId, email);
    if (exists) {
      run(`UPDATE beta_members SET name=COALESCE(NULLIF(?,''),name),
             band_id=COALESCE(?,band_id), level_id=COALESCE(?,level_id),
             status=CASE WHEN status='removed' THEN 'invited' ELSE status END
           WHERE id=?`, String(r.name || ""), r.band_id ?? null, r.level_id ?? null, exists.id);
      updated++;
    } else {
      run("INSERT INTO beta_members(team_id,email,name,band_id,level_id) VALUES(?,?,?,?,?)",
        teamId, email, String(r.name || "").slice(0, 80), r.band_id ?? null, r.level_id ?? null);
      added++;
    }
  }
  return { added, updated };
}

/** Bands represented in a team — what fills the "send to which band" dropdown. */
export function bandsInTeam(teamId: number) {
  ensureBetaSchema();
  return all<any>(`
    SELECT b.id, b.name, COUNT(m.id) n
      FROM beta_members m JOIN bands b ON b.id=m.band_id
     WHERE m.team_id=? AND m.status!='removed'
     GROUP BY b.id, b.name ORDER BY b.name`, teamId);
}

export function logMessage(o: {
  teamId: number; senderId: number; bandId?: number | null; subject: string; body: string;
}) {
  ensureBetaSchema();
  const r = run("INSERT INTO beta_messages(team_id,sender_user_id,band_id,subject,body) VALUES(?,?,?,?,?)",
    o.teamId, o.senderId, o.bandId ?? null, o.subject.slice(0, 200), o.body.slice(0, 20000));
  return Number(r.lastInsertRowid);
}

export function logSend(messageId: number, memberId: number | null, email: string, ok: boolean, error?: string) {
  ensureBetaSchema();
  run("INSERT INTO beta_sends(message_id,member_id,email,ok,error) VALUES(?,?,?,?,?)",
    messageId, memberId, email, ok ? 1 : 0, error ? String(error).slice(0, 300) : null);
}

export function finishMessage(messageId: number) {
  ensureBetaSchema();
  const s = one<any>(`SELECT SUM(ok) ok, SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) fail
                        FROM beta_sends WHERE message_id=?`, messageId);
  run("UPDATE beta_messages SET sent_ok=?, sent_fail=? WHERE id=?",
    Number(s?.ok || 0), Number(s?.fail || 0), messageId);
}

/** What was sent, to whom, and whether it landed. */
export function historyFor(teamId: number, limit = 30) {
  ensureBetaSchema();
  return all<any>(`
    SELECT m.*, b.name band,
           (SELECT GROUP_CONCAT(email, ', ') FROM beta_sends s WHERE s.message_id=m.id AND s.ok=0) failed_to
      FROM beta_messages m LEFT JOIN bands b ON b.id=m.band_id
     WHERE m.team_id=? ORDER BY m.id DESC LIMIT ?`, teamId, limit);
}
