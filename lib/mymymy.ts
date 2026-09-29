// Adapter into the mymymy catalog backend (FastAPI; live at https://app.mymymy.studio
// via the Cloudflare tunnel, or http://localhost:8000 in local dev).
// ROADIE is front-of-house; mymymy owns works / ISWC / variants / royalties.
// Falls back to the local works_cache so ROADIE runs fully standalone/offline.
import { all } from "./db";

const BASE = process.env.MYMYMY_API_URL || "http://localhost:8000";
const TOKEN = process.env.MYMYMY_SERVICE_TOKEN; // optional: bearer for authed reads

export interface Work {
  iswc?: string; title: string; primary_genre?: string;
  variant_count?: number; hero_video?: string; cover_url?: string; source?: string;
  // WHOSE work it is. A band is a collaboration; the song underneath belongs to
  // the people who wrote it, and mymymy models that correctly (Work.user_id is
  // a person, splits carry signatures). ROADIE's cache was keyed to the band
  // alone, which quietly lost that — so a shared song looked like band property
  // on this side of the wall.
  writer?: string;              // display name of the primary writer
  writer_user_id?: string;      // their mymymy identity
  shared?: boolean;             // more than one writer on it
  cleared_for_public?: boolean; // writers opted in AND splits settled
}

export async function getBandWorks(bandId: number, mymymyArtistId?: string): Promise<Work[]> {
  if (mymymyArtistId) {
    try {
      const headers: Record<string,string> = {};
      if (TOKEN) headers["authorization"] = `Bearer ${TOKEN}`;
      // mymymy exposes GET /works (per ARCHITECTURE). A public by-artist read can be added there;
      // we request it and gracefully fall back if it's not reachable / not yet public.
      const r = await fetch(`${BASE}/works?artist=${encodeURIComponent(mymymyArtistId)}`, {
        headers, signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : data?.works;
        if (Array.isArray(list)) return list.map((w: any) => ({
          iswc: w.iswc, title: w.title, primary_genre: w.primary_genre ?? w.genre,
          variant_count: w.variant_count ?? 0, hero_video: w.hero_video ?? "kenburns",
          cover_url: w.cover_url, source: "mymymy",
          writer: w.writer ?? w.primary_writer,
          writer_user_id: w.user_id,
          shared: Array.isArray(w.splits) ? w.splits.length > 1 : undefined,
          // Both halves are required: consent to be played, AND settled splits
          // so there is someone to pay. mymymy calls this royalty_eligible.
          cleared_for_public: w.roadie_eligible === true &&
            ["splits_locked","variants_queued","variants_ready","registered","monetizing"]
              .includes(String(w.state || "").toLowerCase()),
        }));
      }
    } catch { /* offline / not public yet -> cache */ }
  }
  return all<Work>("SELECT iswc,title,primary_genre,variant_count,hero_video,cover_url,source FROM works_cache WHERE band_id=?", bandId);
}

export function mymymyStatus() {
  return { base: BASE, authed: !!TOKEN, note: "Live when mymymy is reachable; otherwise ROADIE serves cached works." };
}
