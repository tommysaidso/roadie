import { NextRequest, NextResponse } from "next/server";
import { requireUser, ownsVenue, forbid, rateLimit } from "@/lib/guard";
import { one } from "@/lib/db";
import { ensureVenueCalendarSchema, fetchAndSync, parseIcs, syncEventsToSlots, identifyCalendarUrl } from "@/lib/ics";
export const dynamic = "force-dynamic";

// Venue calendar ingest.
//   POST { venueId, url }   → identify + fetch + sync, and remember the URL
//   POST { venueId, ics }   → one-shot paste/upload of raw ICS text
//   GET  ?venueId=          → sync status + re-sync if ?refresh=1
export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "calsync", 30, 60 * 60 * 1000); if (limited) return limited;
  ensureVenueCalendarSchema();
  const b = await req.json();
  const venueId = Number(b.venueId || 0);
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });
  if (!ownsVenue(g.user, venueId)) return forbid("You can only manage your own venue's calendar.");
  if (!one("SELECT id FROM venues WHERE id=?", venueId)) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  try {
    if (b.url) {
      const result = await fetchAndSync(venueId, String(b.url));
      return NextResponse.json({ ok: true, mode: "url", ...result });
    }
    if (b.ics) {
      const events = parseIcs(String(b.ics));
      if (!events.length) return NextResponse.json({ error: "No events found in that calendar dump." }, { status: 400 });
      const result = syncEventsToSlots(venueId, events);
      return NextResponse.json({ ok: true, mode: "paste", ...result });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
  return NextResponse.json({ error: "Provide url (webcal/Google/ics link) or ics (raw calendar text)." }, { status: 400 });
}

export async function GET(req: NextRequest) {
  ensureVenueCalendarSchema();
  const venueId = Number(req.nextUrl.searchParams.get("venueId") || 0);
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });
  const v: any = one("SELECT id, calendar_url, calendar_kind, calendar_last_sync, calendar_last_result FROM venues WHERE id=?", venueId);
  if (!v) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  if (req.nextUrl.searchParams.get("refresh") === "1" && v.calendar_url) {
    const g = requireUser(req); if (g.deny) return g.deny;
    if (!ownsVenue(g.user, venueId)) return forbid("You can only refresh your own venue's calendar.");
    try {
      const result = await fetchAndSync(venueId, v.calendar_url);
      return NextResponse.json({ ok: true, refreshed: true, ...result });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
  }
  const idn = v.calendar_url ? identifyCalendarUrl(v.calendar_url) : null;
  return NextResponse.json({
    ok: true, calendar_url: v.calendar_url, kind: v.calendar_kind || idn?.kind || null,
    last_sync: v.calendar_last_sync, last_result: v.calendar_last_result ? JSON.parse(v.calendar_last_result) : null,
  });
}
