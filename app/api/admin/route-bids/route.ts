import { NextRequest, NextResponse } from "next/server";
import { all, one } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureRouteBidSchema, listBidsForRoute, decideBid, coversStop, BID_STATUS } from "@/lib/routebids";
import { billFit } from "@/lib/genres";
export const dynamic = "force-dynamic";

// Operator view of who wants the run, and the decision.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Route bids are operator-only.");
  ensureRouteBidSchema();

  const routeId = Number(req.nextUrl.searchParams.get("routeId") || 0);
  const routes = all<any>("SELECT id,name,arc,season,start_date,end_date,status FROM routes ORDER BY start_date DESC");
  const route = routeId ? routes.find(r => Number(r.id) === routeId) : routes[0];
  if (!route) return NextResponse.json({ routes, route: null, bids: [], stops: [] });

  const stops = all<any>("SELECT id,seq,date,city,headliner_band_id FROM stops WHERE route_id=? ORDER BY seq, date", route.id);
  const headliners = new Map<number, any>();
  for (const s of stops) {
    if (!s.headliner_band_id || headliners.has(Number(s.id))) continue;
    headliners.set(Number(s.id), one<any>("SELECT id,name,genres,genre FROM bands WHERE id=?", s.headliner_band_id));
  }

  const bids = listBidsForRoute(route.id).map(b => {
    // Which nights this bid actually reaches, and whether it would clash with a
    // booked headliner on any of them — an act that fits none of the run is
    // worth seeing as such before anyone shortlists it.
    const covered = stops.filter(s => coversStop(b as any, s));
    const clashes: string[] = [];
    let fits = 0;
    for (const s of covered) {
      const h = headliners.get(Number(s.id));
      if (!h) { fits++; continue; }
      const f = billFit(h.genres || h.genre || "", b.genres || b.genre || "");
      if (f.verdict === "distant") clashes.push(`${s.city} (under ${h.name})`);
      else fits++;
    }
    return {
      ...b,
      nights_covered: covered.length,
      nights_fit: fits,
      genre_clashes: clashes,
    };
  });

  return NextResponse.json({ routes, route, stops: stops.length, bids, statuses: BID_STATUS });
}

export async function PATCH(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Deciding bids is operator-only.");
  ensureRouteBidSchema();
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id || 0);
  const status = String(body.status || "");
  if (!id || !BID_STATUS.includes(status as any)) {
    return NextResponse.json({ error: `id and status (${BID_STATUS.join("|")}) required` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, bid: decideBid(id, status, Number(g.user.id), body.note) });
}
