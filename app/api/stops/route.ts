import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { geocodeCity } from "@/lib/geocode";
import { ensureRingSchema } from "@/lib/ring";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  ensureRingSchema();
  const status = req.nextUrl.searchParams.get("status");
  const rows = status
    ? all(`SELECT s.*, r.name route_name, r.arc,
             (SELECT COUNT(*) FROM host_bids b WHERE b.stop_id=s.id) bid_count
           FROM stops s LEFT JOIN routes r ON r.id=s.route_id
           WHERE s.status=? ORDER BY s.date`, status)
    : all(`SELECT s.*, r.name route_name, r.arc,
             (SELECT COUNT(*) FROM host_bids b WHERE b.stop_id=s.id) bid_count
           FROM stops s LEFT JOIN routes r ON r.id=s.route_id ORDER BY s.date`);
  return NextResponse.json({ stops: rows, routes: all("SELECT * FROM routes ORDER BY start_date") });
}

export async function POST(req: NextRequest) {
  ensureRingSchema();
  const g = requireUser(req); if (g.deny) return g.deny;
  const s = await req.json();
  if (!s.date || !s.city) {
    return NextResponse.json({ error: "date and city are required" }, { status: 400 });
  }
  const geo = geocodeCity(s.city);
  const r = run(
    `INSERT INTO stops(route_id,seq,date,city,region,country,lat,lng,site_name,site_kind,venue_id,
       site_scale,capacity,lot_spaces,camping,overflow_field,gates_at,curfew,power,
       location_manager,location_manager_contact,advance_status,status,notes)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    s.route_id || null, s.seq ?? null, s.date, geo.city || s.city,
    geo.region || s.region || "BC", s.country || "CA",
    s.lat ?? geo.lat, s.lng ?? geo.lng,
    s.site_name || null, s.site_kind || "roadie_ring", s.venue_id || null,
    s.site_scale || "full_ring", s.capacity || null, s.lot_spaces || null,
    s.camping ? 1 : 0, s.overflow_field || null,
    s.gates_at || null, s.curfew || null, s.power || "generator",
    s.location_manager || null, s.location_manager_contact || null,
    s.location_manager ? "assigned" : "unassigned",
    s.status || "announced", s.notes || ""
  );
  return NextResponse.json({ id: r.lastInsertRowid });
}
