import { NextRequest, NextResponse } from "next/server";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { getHub, listHubs } from "@/lib/hubs";
import { listArea, saveOutreach, signupJamPoints, liftFor } from "@/lib/canvass";
export const dynamic = "force-dynamic";

// Admin/dev-team only — canvassing is operator plumbing, not a public surface.
const ELEVATED = new Set(["super_admin", "manager", "admin", "operator"]);
function operator(req: NextRequest) {
  const u = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  return u && ELEVATED.has(String(u.role)) ? u : null;
}

export async function GET(req: NextRequest) {
  const u = operator(req);
  if (!u) return NextResponse.json({ error: "operator only" }, { status: 403 });
  const hub = getHub(req.nextUrl.searchParams.get("hub") || undefined);
  const { logged, targets } = listArea(hub.id);
  const withLift = logged.map(r => ({ ...r, lift: r.offer_id ? liftFor(r.offer_id) : null }));
  return NextResponse.json({
    hub, hubs: listHubs().map(h => ({ slug: h.slug, name: h.name, country: h.country, province: h.province, live: h.live })),
    logged: withLift, targets,
  });
}

export async function POST(req: NextRequest) {
  const u = operator(req);
  if (!u) return NextResponse.json({ error: "operator only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.action === "signup") {
    if (!b.business_name || !(b.discountPct >= 0)) return NextResponse.json({ error: "business_name + discountPct required" }, { status: 400 });
    const r = signupJamPoints({
      outreachId: b.outreachId || undefined, hub_id: b.hub_id ?? null, business_name: b.business_name,
      city: b.city ?? null, region: b.region ?? null, discountPct: Number(b.discountPct),
      title: b.title ?? null, terms: b.terms ?? null, scope: b.scope || "city",
      email: b.email ?? null, contact: b.contact ?? null, created_by: (u as any).id ?? null,
    });
    return NextResponse.json({ ok: true, ...r });
  }
  // default: save/log an outreach row
  if (!b.business_name) return NextResponse.json({ error: "business_name required" }, { status: 400 });
  const id = saveOutreach({
    id: b.id || undefined, hub_id: b.hub_id ?? null, business_name: b.business_name,
    city: b.city ?? null, region: b.region ?? null, venue_id: b.venue_id ?? null,
    email: b.email ?? null, contact: b.contact ?? null, status: b.status || "target",
    channel: b.channel ?? null, note: b.note ?? null, assigned_to: b.assigned_to ?? null,
  });
  return NextResponse.json({ ok: true, id });
}
