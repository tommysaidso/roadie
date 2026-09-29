import { NextRequest, NextResponse } from "next/server";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { all } from "@/lib/db";
import { listForVenue, listForCity, saveItem, removeItem, venueName, BACKLINE_CATEGORIES } from "@/lib/backline";
export const dynamic = "force-dynamic";

const ELEVATED = new Set(["super_admin", "manager", "admin", "operator"]);
function operator(req: NextRequest) {
  const u = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  return u && ELEVATED.has(String(u.role)) ? u : null;
}

// GET is PUBLIC: the shoppable list for a venue (?venue=) or a town (?city=).
// ?venues= returns a small venue-search list for the operator editor.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const venue = sp.get("venue");
  const city = sp.get("city");
  const q = sp.get("venues");
  if (q != null) {
    if (!operator(req)) return NextResponse.json({ error: "operator only" }, { status: 403 });
    const term = "%" + q.toLowerCase().trim() + "%";
    const rows = all<any>("SELECT id,name,city FROM venues WHERE lower(name) LIKE ? OR lower(city) LIKE ? ORDER BY name LIMIT 20", term, term);
    return NextResponse.json({ venues: rows, categories: BACKLINE_CATEGORIES });
  }
  if (venue) return NextResponse.json({ venue_name: venueName(Number(venue)), items: listForVenue(Number(venue)), categories: BACKLINE_CATEGORIES });
  if (city) return NextResponse.json({ items: listForCity(city) });
  return NextResponse.json({ error: "pass ?venue=, ?city= or ?venues=" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!operator(req)) return NextResponse.json({ error: "operator only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    removeItem(Number(b.id));
    return NextResponse.json({ ok: true });
  }
  if (!b.item || !b.venue_id) return NextResponse.json({ error: "venue_id + item required" }, { status: 400 });
  const id = saveItem({
    id: b.id || undefined, venue_id: Number(b.venue_id), category: b.category ?? null, item: String(b.item).slice(0, 160),
    brand: b.brand ?? null, sponsor_id: b.sponsor_id ?? null, buy_url: b.buy_url ?? null,
    price: b.price ?? null, notes: b.notes ?? null, active: b.active ?? 1,
  });
  return NextResponse.json({ ok: true, id });
}
