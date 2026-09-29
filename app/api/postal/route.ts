import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { locatePostal, nearestHub } from "@/lib/postal";

export const dynamic = "force-dynamic";

// "Where am I, and what can I do from here?"
//
// Open on purpose: someone deciding whether to sign up needs this answer BEFORE
// they have an account, and a wall in front of it costs the sale. No writes, no
// personal data stored — a postal code in, a ring out.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("code") || url.searchParams.get("zip") || "";
  const hint = url.searchParams.get("country") || "";

  const hit = locatePostal(raw, hint);
  if (!hit) {
    return NextResponse.json({
      error: "That doesn't look like a Canadian postal code or a US ZIP.",
    }, { status: 400 });
  }

  let hubs: any[] = [];
  try { hubs = all<any>("SELECT slug,name,country,province,center_lat,center_lng,tagline,live FROM hubs"); } catch {}

  // A US member is shown US rings; a Canadian is shown Canadian ones. Handing
  // someone the nearest ring across an international border as their answer
  // would skip the part where the border changes everything.
  const sameCountry = hubs.filter(h => String(h.country || "CA").toUpperCase() === hit.country);
  const near = hit.lat || hit.lng ? nearestHub(hit.lat, hit.lng, sameCountry) : null;

  return NextResponse.json({
    code: hit.code,
    country: hit.country,
    label: hit.label,
    region: hit.region,
    place: hit.place,
    in_corridor: hit.in_corridor,
    hub: near ? {
      slug: near.hub.slug, name: near.hub.name, country: near.hub.country,
      province: near.hub.province, tagline: near.hub.tagline,
      live: !!near.hub.live, km: Math.round(near.km),
    } : null,
    // The US rings aren't running yet, so the honest next step for a US member
    // is the route north — not a promise about a ring with no dates.
    crossing: hit.country === "US" ? "/crossing?from=US&to=CA" : null,
  });
}
