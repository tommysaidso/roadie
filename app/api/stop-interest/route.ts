import { NextRequest, NextResponse } from "next/server";
import { all, one, run } from "@/lib/db";
import { requireUser, ownsBand, forbid } from "@/lib/guard";
import { ensureRingSchema } from "@/lib/ring";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  ensureRingSchema();
  const bandId = req.nextUrl.searchParams.get("band_id");
  const stopId = req.nextUrl.searchParams.get("stop_id");
  if (bandId) {
    return NextResponse.json({
      interest: all(`SELECT i.*, s.city, s.date, s.site_name, s.site_kind, s.status stop_status
                     FROM stop_interest i JOIN stops s ON s.id=i.stop_id
                     WHERE i.band_id=? ORDER BY s.date`, Number(bandId)),
    });
  }
  if (stopId) {
    return NextResponse.json({
      interest: all(`SELECT i.*, b.name band, b.home_city, b.genre, b.draw
                     FROM stop_interest i JOIN bands b ON b.id=i.band_id
                     WHERE i.stop_id=? ORDER BY i.wants_host DESC, b.draw DESC`, Number(stopId)),
    });
  }
  return NextResponse.json({ error: "band_id or stop_id required" }, { status: 400 });
}

// A band claims its place on the ring: in/out, how far it will travel, and
// whether this is its hometown stop it wants to host.
export async function POST(req: NextRequest) {
  ensureRingSchema();
  const g = requireUser(req); if (g.deny) return g.deny;
  const i = await req.json();
  if (!i.stop_id || !i.band_id) {
    return NextResponse.json({ error: "stop_id and band_id are required" }, { status: 400 });
  }
  if (!ownsBand(g.user, i.band_id)) return forbid("You can only set interest for your own band.");

  const stop: any = one("SELECT id,route_id FROM stops WHERE id=?", Number(i.stop_id));
  if (!stop) return NextResponse.json({ error: "unknown stop" }, { status: 404 });

  run(
    `INSERT INTO stop_interest(stop_id,route_id,band_id,interest,travel_km,wants_bill,wants_host,note)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(stop_id,band_id) DO UPDATE SET
       interest=excluded.interest, travel_km=excluded.travel_km,
       wants_bill=excluded.wants_bill, wants_host=excluded.wants_host, note=excluded.note`,
    stop.id, stop.route_id || null, Number(i.band_id),
    i.interest || "in", i.travel_km || null,
    i.wants_bill || "any", i.wants_host ? 1 : 0, i.note || ""
  );
  return NextResponse.json({ ok: true });
}
