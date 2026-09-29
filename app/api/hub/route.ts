import { NextRequest, NextResponse } from "next/server";
import { getHub, listHubs } from "@/lib/hubs";
export const dynamic = "force-dynamic";

const HUB_COOKIE = "roadie_hub";

export async function GET(req: NextRequest) {
  const slug = req.cookies.get(HUB_COOKIE)?.value || null;
  const hub = getHub(slug);
  return NextResponse.json({ hub, hubs: listHubs() });
}

// Switch the active hub (sets a cookie; live hubs only).
export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  const hubs = listHubs(true);
  const target = hubs.find((h) => h.slug === slug);
  if (!target) return NextResponse.json({ error: "unknown or not-yet-live hub" }, { status: 400 });
  const res = NextResponse.json({ ok: true, hub: target });
  res.cookies.set(HUB_COOKIE, target.slug, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
