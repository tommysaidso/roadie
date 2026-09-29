import { NextRequest, NextResponse } from "next/server";
import { all, one, run } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/guard";
import { ensureRingSchema } from "@/lib/ring";
export const dynamic = "force-dynamic";

// Ranking is transparent on purpose: a site can see what would make its bid win.
function scoreBid(b: any, stop: any) {
  let s = 0;
  if (b.ground_ready) s += 0.20;
  if (b.power_onsite) s += 0.15;
  if (b.permit_help) s += 0.20;
  const needed = Number(stop?.capacity) || 0;
  const offered = Number(b.capacity_offered) || 0;
  if (needed && offered) s += Math.min(offered / needed, 1) * 0.20;
  const lots = Number(b.parking_spaces) || 0;
  if (lots) s += Math.min(lots / Math.max(Number(stop?.lot_spaces) || lots, 1), 1) * 0.10;
  const crew = Number(b.local_crew_offered) || 0;
  s += Math.min(crew / 20, 1) * 0.10;
  if (Number(b.guarantee_offered) > 0) s += 0.05;
  return Math.round(Math.min(s, 1) * 100) / 100;
}

export async function GET(req: NextRequest) {
  ensureRingSchema();
  const stopId = req.nextUrl.searchParams.get("stop_id");
  const rows = stopId
    ? all(`SELECT * FROM host_bids WHERE stop_id=? ORDER BY score DESC, created_at`, Number(stopId))
    : all(`SELECT b.*, s.city stop_city, s.date stop_date
           FROM host_bids b LEFT JOIN stops s ON s.id=b.stop_id
           ORDER BY b.created_at DESC LIMIT 200`);
  return NextResponse.json({ bids: rows });
}

export async function POST(req: NextRequest) {
  ensureRingSchema();
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "host-bid", 10); if (limited) return limited;
  const b = await req.json();
  if (!b.stop_id || !b.applicant_name) {
    return NextResponse.json({ error: "stop_id and applicant_name are required" }, { status: 400 });
  }
  const stop: any = one("SELECT * FROM stops WHERE id=?", Number(b.stop_id));
  if (!stop) return NextResponse.json({ error: "unknown stop" }, { status: 404 });

  const score = scoreBid(b, stop);
  const r = run(
    `INSERT INTO host_bids(stop_id,route_id,applicant_kind,applicant_id,applicant_name,city,region,
       site_offered,site_kind,capacity_offered,ground_ready,power_onsite,parking_spaces,permit_help,
       local_crew_offered,guarantee_offered,pitch,score,status,contact)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    stop.id, stop.route_id || null, b.applicant_kind || "venue", b.applicant_id || null,
    b.applicant_name, b.city || stop.city, b.region || stop.region,
    b.site_offered || null, b.site_kind || null, b.capacity_offered || null,
    b.ground_ready ? 1 : 0, b.power_onsite ? 1 : 0, b.parking_spaces || null,
    b.permit_help ? 1 : 0, b.local_crew_offered || 0, b.guarantee_offered || null,
    b.pitch || "", score, "submitted", b.contact || ""
  );
  return NextResponse.json({ id: r.lastInsertRowid, score });
}
