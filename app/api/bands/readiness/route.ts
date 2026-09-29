import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { requireUser, ownsBand, forbid, isElevated, rateLimit } from "@/lib/guard";
import { getReadiness, setReadiness, ensureReadinessSchema, BILL_POSITIONS, DEFAULT_RADIUS_KM } from "@/lib/readiness";
import { canGoAvailable, acceptTourTerms, tourAgreeState } from "@/lib/touragree";
export const dynamic = "force-dynamic";

// The "we're ready to play" flag. Stands until the act turns it off — it is not
// an application to one night, it is a standing declaration that this is a
// working act and the ring should consider them when it comes near.

function bandIdFor(req: NextRequest, user: any): number {
  const asked = Number(req.nextUrl.searchParams.get("bandId") || 0);
  if (asked && (isElevated(user) || ownsBand(user, asked))) return asked;
  return Number(user?.band_id || 0);
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureReadinessSchema();
  const bandId = bandIdFor(req, g.user);
  if (!bandId) {
    return NextResponse.json({
      error: "no_band",
      message: "Claim your band first — then you can tell the ring you're ready.",
    }, { status: 404 });
  }
  const band = one<any>("SELECT id,name,genres,genre,home_city,lat,lng,draw,rate_min FROM bands WHERE id=?", bandId);
  const r = getReadiness(bandId);
  return NextResponse.json({
    // So the toggle can show the gate before it is tapped, rather than failing
    // the save and explaining afterwards.
    tour_terms: tourAgreeState(bandId),
    band,
    readiness: r,
    defaults: { radius_km: DEFAULT_RADIUS_KM, positions: BILL_POSITIONS },
    // Coordinates are how the ring finds them. Without them the flag can be set
    // but will never match anything, so say so plainly rather than silently.
    locatable: !!(band?.lat && band?.lng),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "readiness", 30); if (limited) return limited;
  ensureReadinessSchema();

  const body = await req.json().catch(() => ({}));
  const bandId = Number(body.bandId || 0) || Number(g.user?.band_id || 0);
  if (!bandId) return NextResponse.json({ error: "no_band" }, { status: 400 });
  if (!ownsBand(g.user, bandId)) return forbid("You can only flag your own band.");

  // Accepting the tour terms can ride along with the same save, so ticking the
  // box and agreeing is one action rather than two round trips.
  if (body.accept_tour_terms) {
    acceptTourTerms({
      bandId,
      typedName: String(body.typed_name || ""),
      byEmail: String(g.user?.email || ""),
    });
  }

  // Going AVAILABLE is gated on having read the tour contract — the next thing
  // that happens to an available act is someone offering them dates, so the
  // terms have to be seen first. Going UNAVAILABLE is never gated: an act that
  // wants out gets out immediately.
  const turningOn = body.active === 1 || body.active === true;
  if (turningOn) {
    const gate = canGoAvailable(bandId);
    if (!gate.ok) {
      return NextResponse.json({
        error: gate.state.outdated
          ? "The tour terms have changed since you accepted them. Read the new version and confirm to stay available."
          : "Read and accept the tour contract before going available.",
        needs_tour_terms: true,
        tour_terms: gate.state,
      }, { status: 409 });
    }
  }

  const positions = Array.isArray(body.positions) ? body.positions.join(",") : body.positions;
  const saved = setReadiness(bandId, {
    active: body.active,
    radius_km: body.radius_km,
    positions,
    min_notice_days: body.min_notice_days,
    blackout: body.blackout,
    rate_min: body.rate_min,
    gig_ready: body.gig_ready,
    travel_overnight: body.travel_overnight,
    note: body.note,
  });
  return NextResponse.json({ ok: true, readiness: saved, tour_terms: tourAgreeState(bandId) });
}
