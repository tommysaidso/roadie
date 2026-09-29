import { NextRequest, NextResponse } from "next/server";
import { all, one, run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureRingSchema } from "@/lib/ring";
import { candidatesForStop } from "@/lib/readiness";
export const dynamic = "force-dynamic";

// Episode detail for RoadieTV / the route sheet: read one stop with everything
// a shoot needs hanging off it, and let an operator edit it in place.
// Operator-only — this is production data (permits, contacts, day rates).

// Whitelist. Never spread the request body into SQL: route_id, venue_id and
// hub_id decide what a stop IS and must not be writable from a detail form.
const FIELDS = [
  "date", "city", "region", "site_name", "site_kind", "site_scale",
  "capacity", "lot_spaces", "camping", "overflow_field",
  "gates_at", "curfew", "power",
  "permit_status", "permit_notes",
  "location_manager", "location_manager_contact",
  "advance_status", "status", "notes",
] as const;

function payroll(stopId: number, routeId: number) {
  // Crew that travels the whole run is a season cost, not an episode cost, so
  // it's reported separately — otherwise every episode looks like it pays the
  // film unit again.
  let ev: any[] = [], loc: any[] = [];
  try { ev = all<any>("SELECT * FROM event_crew WHERE stop_id=? OR (route_id=? AND travels_full_run=1)", stopId, routeId); } catch {}
  try { loc = all<any>("SELECT * FROM local_crew WHERE stop_id=?", stopId); } catch {}
  const perDay = (r: any) => Number(r.rate || 0) * (String(r.rate_unit || "day") === "day" ? 1 : 1);
  const thisStop = ev.filter(c => Number(c.stop_id) === Number(stopId));
  const fullRun = ev.filter(c => Number(c.stop_id) !== Number(stopId));
  return {
    event_crew: ev.map(c => ({
      id: c.id, name: c.name, company: c.company, department: c.department, role: c.role,
      rate: c.rate, rate_unit: c.rate_unit, status: c.status,
      full_run: Number(c.stop_id) !== Number(stopId),
    })),
    local_crew: loc.map(c => ({ id: c.id, role: c.role, headcount: c.headcount, rate: c.rate, filled: c.filled })),
    totals: {
      episode_crew_day: thisStop.reduce((n, c) => n + perDay(c), 0),
      full_run_crew_day: fullRun.reduce((n, c) => n + perDay(c), 0),
      local_day: loc.reduce((n, c) => n + Number(c.rate || 0) * Number(c.headcount || 1), 0),
      local_unfilled: loc.filter(c => !c.filled).reduce((n, c) => n + Number(c.headcount || 1), 0),
    },
  };
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Episode detail is operator-only.");
  ensureRingSchema();
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const stop = one<any>("SELECT * FROM stops WHERE id=?", id);
  if (!stop) return NextResponse.json({ error: "not found" }, { status: 404 });
  const route = one<any>("SELECT * FROM routes WHERE id=?", stop.route_id);
  let interest: any[] = [];
  try { interest = all<any>("SELECT * FROM stop_interest WHERE stop_id=?", id); } catch {}
  // Who's in the round for this night. The headliner is booked; these are the
  // flagged acts near enough to fill the rest of the bill, already gated on
  // genre so nothing badly blended reaches the shortlist.
  let headliner: any = null;
  if (stop.headliner_band_id) {
    headliner = one<any>("SELECT id,name,genres,genre FROM bands WHERE id=?", stop.headliner_band_id);
  }
  let candidates: any[] = [];
  if (stop.lat != null && stop.lng != null) {
    try {
      candidates = candidatesForStop({
        lat: Number(stop.lat), lng: Number(stop.lng), date: stop.date,
        headlinerGenres: headliner?.genres || headliner?.genre || "",
        headlinerBandId: stop.headliner_band_id || null,
        allowBlend: /blend|mixed|variety/i.test(String(stop.notes || "")),
        limit: 12,
      }).map(c => ({
        band_id: c.band.id, name: c.band.name, genres: c.band.genres || c.band.genre || "",
        home_city: c.band.home_city, km: c.km, score: c.score,
        positions: String(c.band.positions || "").split(",").filter(Boolean),
        note: c.band.ready_note || "", reasons: c.reasons,
      }));
    } catch {}
  }

  return NextResponse.json({
    stop, route, headliner,
    hometown_acts: interest.length,
    candidates,
    candidates_note: stop.lat == null
      ? "This stop has no coordinates, so nobody can be matched to it."
      : null,
    ...payroll(id, Number(stop.route_id)),
  });
}

export async function PATCH(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Editing episodes is operator-only.");
  ensureRingSchema();
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id || 0);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!one<any>("SELECT id FROM stops WHERE id=?", id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sets: string[] = [], vals: any[] = [];
  for (const f of FIELDS) {
    if (!(f in body)) continue;
    sets.push(`${f}=?`);
    const v = body[f];
    vals.push(v === "" ? null : v);
  }
  if (!sets.length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  vals.push(id);
  run(`UPDATE stops SET ${sets.join(", ")} WHERE id=?`, ...vals);
  return NextResponse.json({ ok: true, stop: one<any>("SELECT * FROM stops WHERE id=?", id) });
}
