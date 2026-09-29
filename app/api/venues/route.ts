import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { geocodeCity } from "@/lib/geocode";
import { nearestHubId, ensureHubSchema } from "@/lib/hubs";
import { ensureVenueCalendarSchema, fetchAndSync } from "@/lib/ics";
import { startTrial } from "@/lib/participation";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  ensureHubSchema();
  // 898 rows is far too much to ship on every load. ?q= filters by name or
  // town and ?limit= caps it; with neither you still get the full list, so
  // existing callers (map, planner) keep working unchanged.
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const limit = Math.min(Number(sp.get("limit")) || 0, 500);
  if (q) {
    const like = `%${q}%`;
    return NextResponse.json({ venues: all(
      "SELECT * FROM venues WHERE name LIKE ? OR city LIKE ? ORDER BY (name LIKE ?) DESC, city, name LIMIT ?",
      like, like, `${q}%`, limit || 50) });
  }
  if (limit) return NextResponse.json({ venues: all("SELECT * FROM venues ORDER BY city,name LIMIT ?", limit) });
  return NextResponse.json({ venues: all("SELECT * FROM venues ORDER BY city,name") });
}
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureHubSchema();
  const v = await req.json();
  const geo = geocodeCity(v.city || "");
  const lat = v.lat ?? geo.lat, lng = v.lng ?? geo.lng;
  const hubId = (lat && lng) ? nearestHubId(lat, lng) : null;
  ensureVenueCalendarSchema();
  // Self-created venue = signed-up member, owned by the creator.
  const r = run(`INSERT INTO venues(name,city,region,lat,lng,capacity,genres,contact,pay_model,notes,hub_id,user_id,member_status,calendar_url)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, v.name, geo.city||v.city, geo.region||v.region||"BC", lat, lng,
    v.capacity||null, v.genres||"",
    v.contact||"", v.pay_model||"door_split", v.notes||"new - pending hub verification", hubId,
    g.user.id, "member", v.calendar_url||null);
  const id = Number(r.lastInsertRowid);
  try { startTrial("venue", id); } catch {}
  // Optional: calendar URL supplied at signup → identify + first sync right away.
  let calendar: any = null;
  if (v.calendar_url) { try { calendar = await fetchAndSync(id, String(v.calendar_url)); } catch(e:any){ calendar = { error: e.message }; } }
  return NextResponse.json({ id, region: geo.region || null, located: !!lat, calendar });
}
