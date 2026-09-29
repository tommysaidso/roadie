import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/guard";
import { ownedIds } from "@/lib/profiles";
import { sendEmail, mailConfigured } from "@/lib/google";
import {
  ensureVideoSchema, createRequest, requestsForBand, draftTreatment, VideoBrief,
} from "@/lib/videorequests";

export const dynamic = "force-dynamic";

const TO = process.env.ROADIE_VIDEO_INBOX || "development@evprod.com";

// A band asking us to make them a music video.
//
// Signed in only — this creates work for real people, and an open endpoint
// would fill the inbox with nothing. Rate limited for the same reason.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureVideoSchema();
  const bandId = Number(new URL(req.url).searchParams.get("band")) || 0;
  if (!bandId) return NextResponse.json({ requests: [] });
  // Their own band's requests only.
  const owned = new Set<number>(ownedIds(g.user, "band"));
  if (g.user?.band_id) owned.add(Number(g.user.band_id));
  if (!owned.has(bandId)) return NextResponse.json({ requests: [] });
  return NextResponse.json({ requests: requestsForBand(bandId) });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "videoreq", 8, 60 * 60 * 1000); if (limited) return limited;
  ensureVideoSchema();

  const b = await req.json().catch(() => ({} as any));
  const bandId = Number(b?.band_id) || null;

  // Only for a band you actually control.
  if (bandId) {
    const owned = new Set<number>(ownedIds(g.user, "band"));
    if (g.user?.band_id) owned.add(Number(g.user.band_id));
    if (!owned.has(bandId)) {
      return NextResponse.json({ error: "That isn't your band." }, { status: 403 });
    }
  }

  const song = String(b?.song || "").trim();
  if (!song) return NextResponse.json({ error: "Which song is it for?" }, { status: 400 });

  const band = bandId ? one<any>("SELECT name FROM bands WHERE id=?", bandId) : null;

  const brief: VideoBrief = {
    band_id: bandId ?? undefined,
    band_name: band?.name || String(b?.band_name || ""),
    user_id: g.user?.id,
    contact_email: String(b?.contact_email || g.user?.email || "").slice(0, 160),
    song, song_link: String(b?.song_link || "").slice(0, 400),
    kind: String(b?.kind || "performance").slice(0, 20),
    look: String(b?.look || "").slice(0, 1000),
    story: String(b?.story || "").slice(0, 2000),
    locations: String(b?.locations || "").slice(0, 1000),
    people: String(b?.people || "").slice(0, 500),
    must_have: String(b?.must_have || "").slice(0, 500),
    avoid: String(b?.avoid || "").slice(0, 500),
    refs: String(b?.refs || "").slice(0, 800),
    timing: String(b?.timing || "").slice(0, 200),
    budget: String(b?.budget || "").slice(0, 200),
    diy: b?.diy ? 1 : 0,
  };

  // Draft the treatment before saving, so the record carries it — but never
  // let a slow or missing model stop the request landing.
  brief.treatment = (await draftTreatment(brief)) || "";

  const row = createRequest(brief);

  // Tell us it arrived. If mail is down the request is still saved, and the
  // band is still told it came through — losing the record would be the bad
  // failure, not a missing notification.
  let notified = false;
  if (mailConfigured()) {
    try {
      await sendEmail({
        to: TO,
        subject: `Music video request — ${brief.band_name || "a band"} — ${song}`,
        html: mailFor(row),
      });
      notified = true;
    } catch { /* saved either way */ }
  }

  return NextResponse.json({ ok: true, request: row, notified });
}

const esc = (s: any) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function mailFor(r: any) {
  const row = (k: string, v: any) => v
    ? `<tr><td style="padding:4px 10px 4px 0;color:#666;vertical-align:top;white-space:nowrap">${k}</td>
         <td style="padding:4px 0">${esc(v).replace(/\n/g, "<br>")}</td></tr>` : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:640px">
    <h2 style="margin:0 0 4px">${esc(r.band_name || "A band")} wants a music video</h2>
    <p style="margin:0 0 14px;color:#666">${esc(r.song)}${r.diy ? " · wants to make it themselves with our tools" : ""}</p>
    ${r.treatment ? `<div style="padding:12px 14px;border-left:3px solid #ff3d6e;background:#faf7f8;white-space:pre-wrap">${esc(r.treatment)}</div>` : ""}
    <table style="margin-top:14px;border-collapse:collapse">
      ${row("Contact", r.contact_email)}
      ${row("Song link", r.song_link)}
      ${row("Type", r.kind)}
      ${row("Look", r.look)}
      ${row("What happens", r.story)}
      ${row("Locations", r.locations)}
      ${row("Who's in it", r.people)}
      ${row("Must have", r.must_have)}
      ${row("Avoid", r.avoid)}
      ${row("Likes", r.refs)}
      ${row("Timing", r.timing)}
      ${row("Budget", r.budget)}
    </table>
  </div>`;
}
