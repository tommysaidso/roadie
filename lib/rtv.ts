// RTV — bands submit videos they already have.
//
// Not a hosting deal: they keep the file wherever it lives (YouTube, Vimeo, or
// their own CDN) and RTV plays it in a rotation. Old-MTV shape — it runs, one
// after another, and you can pick a clip off the wall.
//
// The metadata travels with the clip: band, city, genre and tags are stamped
// onto the submission so a quick link or a marketing pull has everything it
// needs without re-joining half the database at read time.

import { all, one, run, getDb } from "./db";

let ready = false;

export function ensureRtvSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS rtv_submissions (
      id INTEGER PRIMARY KEY,
      band_id INTEGER REFERENCES bands(id),
      band_name TEXT,                  -- stamped at submit: metadata follows the clip
      home_city TEXT,
      genre TEXT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,               -- where the video actually lives
      provider TEXT,                   -- youtube | vimeo | file
      video_id TEXT,                   -- provider id, for the embed
      kind TEXT DEFAULT 'music_video', -- music_video | live | session | doc | other
      year INTEGER,
      tags TEXT DEFAULT '[]',          -- JSON array, for tagging / marketing pulls
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',   -- pending | approved | rejected
      review_note TEXT,
      plays INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rtv_status ON rtv_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_rtv_band ON rtv_submissions(band_id);
  `);
  ready = true;
}

export const RTV_KINDS = ["music_video", "live", "session", "doc", "other"];

/**
 * Work out where a video lives from the URL the band pasted.
 *
 * Only providers we can actually embed are accepted. Taking any URL and hoping
 * would give bands a clip that silently never plays, and they'd have no idea
 * why — better to refuse it at the door and say what works.
 */
export function parseVideoUrl(raw: string): { provider: string; video_id: string } | null {
  const url = String(raw || "").trim();
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id ? { provider: "youtube", video_id: id } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return { provider: "youtube", video_id: v };
    const m = u.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]+)/);
    if (m) return { provider: "youtube", video_id: m[2] };
    return null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{6,})/);
    return m ? { provider: "vimeo", video_id: m[1] } : null;
  }
  // A band hosting their own file is fine as long as it's a video we can play.
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) {
    return { provider: "file", video_id: url };
  }
  return null;
}

/** Embed/playback URL for an approved clip. */
export function embedUrl(row: any): string {
  if (row.provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(row.video_id)}?rel=0&modestbranding=1`;
  }
  if (row.provider === "vimeo") return `https://player.vimeo.com/video/${encodeURIComponent(row.video_id)}`;
  return row.url;
}

/** Poster art without an extra API call — YouTube exposes one by convention. */
export function thumbUrl(row: any): string | null {
  if (row.provider === "youtube") return `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`;
  return null;
}

export function shape(row: any) {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags || "[]"); } catch {}
  return {
    id: row.id, band_id: row.band_id, band_name: row.band_name,
    home_city: row.home_city, genre: row.genre,
    title: row.title, url: row.url, provider: row.provider, video_id: row.video_id,
    kind: row.kind, year: row.year, tags, notes: row.notes,
    status: row.status, review_note: row.review_note, plays: row.plays,
    embed: embedUrl(row), thumb: thumbUrl(row), created_at: row.created_at,
  };
}

export function approvedClips(limit = 200) {
  return all<any>(
    "SELECT * FROM rtv_submissions WHERE status='approved' ORDER BY created_at DESC LIMIT ?", limit)
    .map(shape);
}

export function clipsForBand(bandId: number) {
  return all<any>("SELECT * FROM rtv_submissions WHERE band_id=? ORDER BY id DESC", bandId).map(shape);
}

export function clipRow(id: number) {
  return one<any>("SELECT * FROM rtv_submissions WHERE id=?", id);
}

export function bumpPlay(id: number) {
  run("UPDATE rtv_submissions SET plays=COALESCE(plays,0)+1 WHERE id=?", id);
}
