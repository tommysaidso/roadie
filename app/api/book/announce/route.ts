import { NextRequest, NextResponse } from "next/server";
import { all, one } from "@/lib/db";
import { sendEmail } from "@/lib/google";
import { requireUser, ownsBand, ownsVenue, forbid, rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";

// Announce a confirmed booking to the mailing lists we already hold:
//   - the BAND's list  = fan_messages (follow/signup) rows for band_id
//   - the VENUE's list = fan_messages (follow/signup) rows for venue_id
// Only the band owner or venue owner on that booking can trigger it, and it
// stays ASK-BEFORE-SEND: GET previews the audience, POST actually sends.
//
//   GET  ?bookingId=            → { band_list: n, venue_list: n, preview }
//   POST { bookingId, audience: "band" | "venue" | "both", subject?, html? }

function audienceEmails(bandId: number | null, venueId: number | null, which: string): string[] {
  const rows: any[] = [];
  if ((which === "band" || which === "both") && bandId)
    rows.push(...all(`SELECT DISTINCT lower(fan_email) e FROM fan_messages
      WHERE band_id=? AND kind IN ('follow','signup') AND fan_email LIKE '%@%'`, bandId));
  if ((which === "venue" || which === "both") && venueId)
    rows.push(...all(`SELECT DISTINCT lower(fan_email) e FROM fan_messages
      WHERE venue_id=? AND kind IN ('follow','signup') AND fan_email LIKE '%@%'`, venueId));
  return [...new Set(rows.map(r => String(r.e)))];
}

function loadBooking(bookingId: number) {
  return one<any>(`SELECT b.*, ba.name band_name, v.name venue_name, v.city venue_city
    FROM bookings b JOIN bands ba ON ba.id=b.band_id JOIN venues v ON v.id=b.venue_id
    WHERE b.id=?`, bookingId);
}

function canAnnounce(user: any, bk: any) {
  return ownsBand(user, bk.band_id) || ownsVenue(user, bk.venue_id);
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const bk = loadBooking(Number(req.nextUrl.searchParams.get("bookingId") || 0));
  if (!bk) return NextResponse.json({ error: "booking not found" }, { status: 404 });
  if (!canAnnounce(g.user, bk)) return forbid("Only the band or venue on this booking can announce it.");
  return NextResponse.json({
    ok: true,
    booking: { id: bk.id, date: bk.date, band: bk.band_name, venue: bk.venue_name, city: bk.venue_city, status: bk.status },
    band_list: audienceEmails(bk.band_id, null, "band").length,
    venue_list: audienceEmails(null, bk.venue_id, "venue").length,
    default_subject: `${bk.band_name} live at ${bk.venue_name} — ${bk.date}`,
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "announce", 10, 60 * 60 * 1000); if (limited) return limited;
  const b = await req.json();
  const bk = loadBooking(Number(b.bookingId || 0));
  if (!bk) return NextResponse.json({ error: "booking not found" }, { status: 404 });
  if (!canAnnounce(g.user, bk)) return forbid("Only the band or venue on this booking can announce it.");
  if (!["confirmed", "contract_sent", "signed"].includes(String(bk.status)))
    return NextResponse.json({ error: `Booking is '${bk.status}' — announce after it is confirmed.` }, { status: 409 });

  const which = ["band", "venue", "both"].includes(b.audience) ? b.audience : "both";
  const emails = audienceEmails(bk.band_id, bk.venue_id, which);
  if (!emails.length) return NextResponse.json({ error: "No mailing-list emails collected yet for that audience." }, { status: 404 });

  const subject = String(b.subject || `${bk.band_name} live at ${bk.venue_name} — ${bk.date}`).slice(0, 200);
  const html = String(b.html || `<p><b>${bk.band_name}</b> plays <b>${bk.venue_name}</b>${bk.venue_city ? " in " + bk.venue_city : ""} on <b>${bk.date}</b>.</p><p>See you on the floor.</p>`);

  let sent = 0; const failed: string[] = [];
  const cap = Math.min(emails.length, 200);   // safety valve per call
  for (const to of emails.slice(0, cap)) {
    try { await sendEmail({ to, subject, html }); sent++; }
    catch { failed.push(to); if (failed.length >= 3) break; }   // creds broken → bail early
  }
  return NextResponse.json({ ok: true, audience: which, list_size: emails.length, sent, failed: failed.length, capped: emails.length > cap });
}
