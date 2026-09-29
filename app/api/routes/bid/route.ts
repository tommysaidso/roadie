import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { requireUser, ownsBand, forbid, rateLimit } from "@/lib/guard";
import { ensureRouteBidSchema, getBid, submitBid, withdrawBid, listBidsForBand, BILL_ASKS } from "@/lib/routebids";
export const dynamic = "force-dynamic";

// Band-facing: put your hand up for a whole ring.
//
// Distinct from readiness ("consider us when you're near") and from stop
// interest ("we want that one night"). This is an act saying it will ride the
// run — the operator decides.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureRouteBidSchema();
  const bandId = Number(g.user?.band_id || 0);
  if (!bandId) return NextResponse.json({ error: "no_band", message: "Claim your band first." }, { status: 404 });

  const routeId = Number(req.nextUrl.searchParams.get("routeId") || 0);
  if (routeId) {
    return NextResponse.json({ bid: getBid(routeId, bandId), asks: BILL_ASKS });
  }
  return NextResponse.json({ bids: listBidsForBand(bandId), asks: BILL_ASKS });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "route-bid", 20); if (limited) return limited;
  ensureRouteBidSchema();

  const body = await req.json().catch(() => ({}));
  const routeId = Number(body.routeId || 0);
  const bandId = Number(body.bandId || 0) || Number(g.user?.band_id || 0);
  if (!routeId || !bandId) return NextResponse.json({ error: "routeId and a band are required" }, { status: 400 });
  if (!ownsBand(g.user, bandId)) return forbid("You can only bid for your own band.");

  const route = one<any>("SELECT id,name,status FROM routes WHERE id=?", routeId);
  if (!route) return NextResponse.json({ error: "no such ring" }, { status: 404 });
  // Bidding a run that has already finished isn't an error worth a stack trace,
  // but it shouldn't quietly succeed either.
  if (["done", "cancelled", "settled"].includes(String(route.status))) {
    return NextResponse.json({ error: "That ring has already run." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, bid: submitBid(routeId, bandId, body), route: route.name });
}

export async function DELETE(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureRouteBidSchema();
  const routeId = Number(req.nextUrl.searchParams.get("routeId") || 0);
  const bandId = Number(g.user?.band_id || 0);
  if (!routeId || !bandId) return NextResponse.json({ error: "routeId required" }, { status: 400 });
  if (!ownsBand(g.user, bandId)) return forbid("You can only withdraw your own bid.");
  return NextResponse.json({ ok: true, bid: withdrawBid(routeId, bandId) });
}
