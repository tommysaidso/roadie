import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { llmAnswer } from "@/lib/llm";
import { requireUser, ownsBand, ownsVenue, forbid, rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";

// Gig promo post builder — templated, fun, fits the band + the bar.
// POST { bookingId, tone? } → 3 ready-to-paste social captions (hype / funny /
// classy), hashtags, and a poster-studio link. LLM writes them when a key is
// configured; the templates below mean it ALWAYS works offline too.
//
// This is a paid-tier tool in the participation model — trial users get it
// free for 3 months (soft-gated client-side for now).

const T = {
  hype: (b: string, v: string, c: string, d: string) =>
    `🔥 ${b.toUpperCase()} takes over ${v} — ${d}. ${c} won't know what hit it. Doors early, ears ringing late. Bring everyone.`,
  funny: (b: string, v: string, c: string, d: string) =>
    `Your couch will still be there tomorrow. ${b} at ${v} on ${d} will not. Choose wisely, ${c}. 🍻`,
  classy: (b: string, v: string, c: string, d: string) =>
    `An evening with ${b} — live at ${v}, ${c}. ${d}. Good rooms, good people, real music. See you there.`,
};

function tags(b: string, v: string, c: string) {
  const clean = (x: string) => x.replace(/[^a-z0-9]/gi, "");
  return ["#livemusic", `#${clean(c)}`, `#${clean(b)}`, `#${clean(v)}`, "#supportlocalmusic", "#roadie"];
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "promo", 40, 60 * 60 * 1000); if (limited) return limited;
  const b = await req.json();
  const bk = one<any>(`SELECT b.*, ba.name band_name, ba.genre, v.name venue_name, v.city
    FROM bookings b JOIN bands ba ON ba.id=b.band_id JOIN venues v ON v.id=b.venue_id WHERE b.id=?`,
    Number(b.bookingId || 0));
  if (!bk) return NextResponse.json({ error: "booking not found" }, { status: 404 });
  if (!ownsBand(g.user, bk.band_id) && !ownsVenue(g.user, bk.venue_id))
    return forbid("Only the band or venue on this booking can build promo for it.");

  const base = {
    hype: T.hype(bk.band_name, bk.venue_name, bk.city || "town", bk.date),
    funny: T.funny(bk.band_name, bk.venue_name, bk.city || "town", bk.date),
    classy: T.classy(bk.band_name, bk.venue_name, bk.city || "town", bk.date),
  };

  // LLM polish — best-effort; template fallback keeps it instant + offline-safe.
  let posts = base;
  try {
    const t = await llmAnswer(
      `Write 3 short social posts (max 220 chars each) promoting a live show: ${bk.band_name} (${bk.genre || "live"} band) at ${bk.venue_name} in ${bk.city}, ${bk.date}. ` +
      `Voices: 1 HYPE (loud, all-caps energy), 2 FUNNY (self-aware, local), 3 CLASSY (warm, grown-up). Fun, never corporate. No hashtags. Format exactly:\nHYPE: ...\nFUNNY: ...\nCLASSY: ...`, "");
    if (t) {
      const m = (k: string) => t.match(new RegExp(`${k}:\\s*(.+)`, "i"))?.[1]?.trim();
      posts = { hype: m("HYPE") || base.hype, funny: m("FUNNY") || base.funny, classy: m("CLASSY") || base.classy };
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    booking: { id: bk.id, band: bk.band_name, venue: bk.venue_name, city: bk.city, date: bk.date },
    posts, hashtags: tags(bk.band_name, bk.venue_name, bk.city || "local"),
    poster_url: "/poster",
    tip: "Pick a voice, paste it everywhere, attach the poster. Then blast the mailing lists from the booking (announce).",
  });
}
