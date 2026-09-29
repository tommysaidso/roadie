// IP TRACKING — where an artist's work has gone, and what it did there.
//
// We are not a distributor and should not pretend to be. What we can honestly
// do is keep the artist's own picture complete: which platforms they are on,
// what they put there, and when.
//
// The mechanic Ben described, and the reason it works: the artist SIGNS IN to
// the platform once — the way you connect Suno — and the connection lives in
// their profile. From then on we can look, because they told us where to look
// and gave us the handle. That is "attempted detection" with consent, which is
// a completely different thing from scraping the web hoping to find them.
//
// Three honesty rules baked in:
//
//   1. Every record says HOW we know. Something the artist typed and something
//      we read from a connected account are not the same claim, and a ledger
//      that blurs them is worse than no ledger.
//   2. Detection never asserts ownership. Finding a track with your name on it
//      is evidence, not proof — it lands as `found`, for the artist to confirm.
//   3. We never post, upload or distribute on their behalf. Read and record.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureIpSchema() {
  if (ready) return;
  getDb().exec(`
    -- A platform the artist has connected or simply told us about.
    CREATE TABLE IF NOT EXISTS artist_accounts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      platform TEXT NOT NULL,          -- soundcloud | ascap | socan | spotify | suno | youtube | bandcamp | apple | other
      handle TEXT DEFAULT '',          -- their name/id on it
      profile_url TEXT DEFAULT '',
      -- 'connected' means they signed in and we hold a token; 'declared' means
      -- they typed it. Only the first can be checked automatically.
      link_kind TEXT DEFAULT 'declared',
      token TEXT,                      -- when connected; never returned to the client
      status TEXT DEFAULT 'active',    -- active | stale | removed
      last_checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, platform, handle)
    );

    -- One row per "this work of mine is on that platform".
    CREATE TABLE IF NOT EXISTS ip_placements (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      account_id INTEGER,
      work_ref TEXT DEFAULT '',        -- iswc / mymymy work id / our own title
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      external_id TEXT DEFAULT '',
      url TEXT DEFAULT '',
      -- How this got here. The whole point of the table.
      source TEXT DEFAULT 'declared',  -- declared | detected | registered | played_here
      confirmed INTEGER DEFAULT 0,     -- artist has said yes, this is mine
      first_seen TEXT DEFAULT (datetime('now')),
      last_seen TEXT,
      note TEXT DEFAULT '',
      UNIQUE(user_id, platform, external_id, title)
    );

    -- Every use we can actually witness: played on The Wire, sent in a pitch,
    -- downloaded from a promo. Our own house, where we genuinely know.
    CREATE TABLE IF NOT EXISTS ip_events (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      work_ref TEXT DEFAULT '',
      title TEXT DEFAULT '',
      kind TEXT NOT NULL,              -- played | sent | downloaded | licensed | registered
      where_at TEXT DEFAULT '',        -- 'The Wire', 'sponsor pitch', 'ASCAP'
      detail TEXT DEFAULT '',
      notified_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ip_events_user ON ip_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_ip_place_user ON ip_placements(user_id);
  `);
  ready = true;
}

export const PLATFORMS = [
  { id: "soundcloud", label: "SoundCloud",  detectable: true,  note: "Connect and we can read your public tracks." },
  { id: "spotify",    label: "Spotify",     detectable: true,  note: "Artist profile — we can list what's published." },
  { id: "youtube",    label: "YouTube",     detectable: true,  note: "Channel uploads." },
  { id: "bandcamp",   label: "Bandcamp",    detectable: false, note: "No open API — tell us the page and we'll keep the link." },
  { id: "suno",       label: "Suno",        detectable: false, note: "Paste what you've published; we hold the record." },
  { id: "ascap",      label: "ASCAP",       detectable: false, note: "Registrations you've filed. We track what you tell us." },
  { id: "socan",      label: "SOCAN",       detectable: false, note: "Canadian PRO registrations." },
  { id: "apple",      label: "Apple Music", detectable: false, note: "Link only." },
  { id: "other",      label: "Somewhere else", detectable: false, note: "" },
];

export const platformInfo = (id: string) => PLATFORMS.find(p => p.id === id) || PLATFORMS[PLATFORMS.length - 1];

export function accountsFor(userId: number) {
  ensureIpSchema();
  // Never hand the token back — it is the one field that must not leave here.
  return all<any>(`SELECT id,user_id,platform,handle,profile_url,link_kind,status,last_checked_at,created_at
                     FROM artist_accounts WHERE user_id=? AND status!='removed' ORDER BY platform`, userId);
}

export function addAccount(userId: number, a: {
  platform: string; handle?: string; profile_url?: string; link_kind?: string; token?: string;
}) {
  ensureIpSchema();
  const platform = platformInfo(String(a.platform)).id;
  const handle = String(a.handle || "").trim().slice(0, 120);
  const kind = a.token ? "connected" : (a.link_kind === "connected" ? "connected" : "declared");
  const existing = one<any>(
    "SELECT id FROM artist_accounts WHERE user_id=? AND platform=? AND handle=?", userId, platform, handle);
  if (existing) {
    run(`UPDATE artist_accounts SET profile_url=COALESCE(NULLIF(?,''),profile_url),
           link_kind=?, token=COALESCE(?,token), status='active' WHERE id=?`,
      String(a.profile_url || ""), kind, a.token ?? null, existing.id);
    return one<any>("SELECT id,platform,handle,profile_url,link_kind FROM artist_accounts WHERE id=?", existing.id);
  }
  const r = run(`INSERT INTO artist_accounts(user_id,platform,handle,profile_url,link_kind,token)
                 VALUES(?,?,?,?,?,?)`,
    userId, platform, handle, String(a.profile_url || "").slice(0, 400), kind, a.token ?? null);
  return one<any>("SELECT id,platform,handle,profile_url,link_kind FROM artist_accounts WHERE id=?",
    Number(r.lastInsertRowid));
}

export function removeAccount(userId: number, id: number) {
  ensureIpSchema();
  run("UPDATE artist_accounts SET status='removed', token=NULL WHERE id=? AND user_id=?", id, userId);
}

export function placementsFor(userId: number) {
  ensureIpSchema();
  return all<any>("SELECT * FROM ip_placements WHERE user_id=? ORDER BY platform, title", userId);
}

export function addPlacement(userId: number, p: {
  title: string; platform: string; url?: string; external_id?: string;
  work_ref?: string; source?: string; account_id?: number; note?: string;
}) {
  ensureIpSchema();
  const title = String(p.title || "").trim().slice(0, 300);
  if (!title) return { error: "Needs a title." };
  const platform = platformInfo(String(p.platform)).id;
  const src = ["declared", "detected", "registered", "played_here"].includes(String(p.source))
    ? String(p.source) : "declared";
  try {
    run(`INSERT INTO ip_placements(user_id,account_id,work_ref,title,platform,external_id,url,source,confirmed,last_seen)
         VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))`,
      userId, p.account_id ?? null, String(p.work_ref || ""), title, platform,
      String(p.external_id || ""), String(p.url || "").slice(0, 600), src,
      // Something the artist typed is already confirmed by definition; something
      // we detected is a suggestion until they say so.
      src === "detected" ? 0 : 1);
  } catch {
    run(`UPDATE ip_placements SET last_seen=datetime('now'), url=COALESCE(NULLIF(?,''),url)
          WHERE user_id=? AND platform=? AND title=?`, String(p.url || ""), userId, platform, title);
  }
  return { ok: true };
}

export function confirmPlacement(userId: number, id: number, yes: boolean) {
  ensureIpSchema();
  run("UPDATE ip_placements SET confirmed=? WHERE id=? AND user_id=?", yes ? 1 : 0, id, userId);
}

/**
 * Record a use we actually witnessed.
 *
 * Only ever called for things that happened HERE — a play on The Wire, a track
 * sent in a pitch. We do not invent events for platforms we cannot see.
 */
export function logEvent(userId: number, e: {
  kind: string; title?: string; work_ref?: string; where_at?: string; detail?: string;
}) {
  ensureIpSchema();
  run(`INSERT INTO ip_events(user_id,work_ref,title,kind,where_at,detail)
       VALUES(?,?,?,?,?,?)`,
    userId, String(e.work_ref || ""), String(e.title || "").slice(0, 300),
    String(e.kind || "played"), String(e.where_at || "").slice(0, 120),
    String(e.detail || "").slice(0, 400));
}

export function eventsFor(userId: number, limit = 100) {
  ensureIpSchema();
  return all<any>("SELECT * FROM ip_events WHERE user_id=? ORDER BY id DESC LIMIT ?", userId, limit);
}

/** What the artist hasn't been told about yet. */
export function unnotified(userId: number) {
  ensureIpSchema();
  return all<any>("SELECT * FROM ip_events WHERE user_id=? AND notified_at IS NULL ORDER BY id", userId);
}

export function markNotified(ids: number[]) {
  ensureIpSchema();
  if (!ids.length) return;
  run(`UPDATE ip_events SET notified_at=datetime('now') WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
}

/**
 * Look at a connected account and record what is there.
 *
 * SoundCloud is the one worth doing first — it is where Ben already plays, it
 * has a public API, and a handle is enough to read a public profile.
 *
 * Returns [] rather than throwing on every failure path. A platform being down,
 * rate-limiting us, or changing its API must never break the page that shows an
 * artist their own catalogue.
 */
export async function detectFor(userId: number, account: any): Promise<{ found: number; error?: string }> {
  ensureIpSchema();
  const platform = String(account?.platform || "");
  const handle = String(account?.handle || "").trim();
  if (!handle) return { found: 0, error: "No handle to look up." };

  if (platform === "soundcloud") {
    const cid = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!cid) return { found: 0, error: "SoundCloud isn't configured on this server yet." };
    try {
      const u = `https://api.soundcloud.com/users/${encodeURIComponent(handle)}/tracks?client_id=${cid}&limit=50`;
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return { found: 0, error: `SoundCloud said ${r.status}.` };
      const list: any[] = await r.json();
      let n = 0;
      for (const t of Array.isArray(list) ? list : []) {
        addPlacement(userId, {
          title: t.title, platform: "soundcloud", url: t.permalink_url,
          external_id: String(t.id || ""), source: "detected", account_id: account.id,
        });
        n++;
      }
      run("UPDATE artist_accounts SET last_checked_at=datetime('now') WHERE id=?", account.id);
      return { found: n };
    } catch (e: any) {
      return { found: 0, error: `Couldn't reach SoundCloud: ${e?.message || e}` };
    }
  }

  // Everything else is declared-only for now, and says so rather than
  // pretending to have looked.
  return { found: 0, error: `${platformInfo(platform).label} can't be checked automatically — add what you've put there.` };
}
