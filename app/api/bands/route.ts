import { NextRequest, NextResponse } from "next/server";
import { all, one, run } from "@/lib/db";
import { requireUser, ownsBand, forbid } from "@/lib/guard";
import { geocodeCity } from "@/lib/geocode";
import { nearestHubId, ensureHubSchema } from "@/lib/hubs";
import { startTrial } from "@/lib/participation";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  ensureHubSchema();
  // ?q= filters by name/city so a band can find ITSELF without the client
  // pulling the whole roster down and filtering in the browser.
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q) {
    const like = `%${q}%`;
    return NextResponse.json({ bands: all(
      "SELECT * FROM bands WHERE name LIKE ? OR home_city LIKE ? ORDER BY (name LIKE ?) DESC, name LIMIT 20",
      like, like, `${q}%`) });
  }
  return NextResponse.json({ bands: all("SELECT * FROM bands ORDER BY name") });
}
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureHubSchema();
  const b = await req.json();
  // Geocode the home town so the band exists on maps + in matching from day one.
  // Accepts "Kelowna", "Kelowna BC", "Regina, SK" - unknown towns still save.
  const geo = geocodeCity(b.home_city || "");
  const lat = b.lat ?? geo.lat, lng = b.lng ?? geo.lng;
  const hubId = (lat && lng) ? nearestHubId(lat, lng) : null;
  const links = b.links || b.socials || "{}";
  const r = run(`INSERT INTO bands(name,genre,genres,home_city,home_region,lat,lng,bio_short,bio,members,draw,rate_min,rate_max,touring,socials,links,hub_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.name,b.genre,b.genres,geo.city||b.home_city,geo.region||b.home_region||"BC",lat,lng,
    b.bio_short,b.bio,b.members,b.draw,b.rate_min,b.rate_max,b.touring?1:0,b.socials || links,links,hubId);
  try { startTrial("band", Number(r.lastInsertRowid)); } catch {}
  return NextResponse.json({ id: r.lastInsertRowid, region: geo.region || null, located: !!lat });
}

export async function PATCH(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const b = await req.json();
  const id = Number(b.id || 0);
  if (!ownsBand(g.user, id)) return forbid("You can only update your own band.");
  const cur:any = one("SELECT links,socials FROM bands WHERE id=?", id);
  if (!cur) return NextResponse.json({ error:"band not found" }, { status:404 });
  let links:Record<string,string> = {};
  try { links = JSON.parse(cur.links || cur.socials || "{}"); } catch {}
  const incoming = b.links && typeof b.links === "object" ? b.links : {};
  for (const [k,v] of Object.entries(incoming)) {
    const key = String(k || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    const val = String(v || "").trim();
    if (!key) continue;
    if (val) links[key] = val;
    else delete links[key];
  }
  // Profile fields, not just links.
  //
  // This handler used to write links/socials ONLY, which meant home town was
  // effectively write-once at signup — a band that moved, or that typed the
  // wrong town in the wizard, had no way to correct it and no error to tell
  // them why. Home town is not cosmetic here: it drives ring routing, "who is
  // near this stop", and the whole local-first crew and booking model.
  //
  // Changing the town re-geocodes, because a stale lat/lng silently places the
  // band in the wrong place while the text looks right — worse than not moving
  // at all.
  const sets: string[] = ["links=?", "socials=?"];
  const vals: any[] = [JSON.stringify(links), JSON.stringify(links)];

  const TEXT_FIELDS = ["name", "genre", "genres", "bio_short", "bio", "members"];
  for (const f of TEXT_FIELDS) {
    if (typeof b[f] === "string") { sets.push(`${f}=?`); vals.push(b[f].trim()); }
  }
  for (const f of ["draw", "rate_min", "rate_max"]) {
    if (b[f] !== undefined && b[f] !== null && b[f] !== "") {
      sets.push(`${f}=?`); vals.push(Number(b[f]));
    }
  }
  if (b.touring !== undefined) { sets.push("touring=?"); vals.push(b.touring ? 1 : 0); }

  if (typeof b.home_city === "string" && b.home_city.trim()) {
    const geo = geocodeCity(b.home_city);
    sets.push("home_city=?"); vals.push(geo.city || b.home_city.trim());
    const region = geo.region || (typeof b.home_region === "string" ? b.home_region : "");
    if (region) { sets.push("home_region=?"); vals.push(region); }
    if (geo.lat != null && geo.lng != null) {
      sets.push("lat=?"); vals.push(geo.lat);
      sets.push("lng=?"); vals.push(geo.lng);
    }
  } else if (typeof b.home_region === "string" && b.home_region.trim()) {
    sets.push("home_region=?"); vals.push(b.home_region.trim());
  }

  run(`UPDATE bands SET ${sets.join(", ")} WHERE id=?`, ...vals, id);
  const updated:any = one(
    "SELECT id,name,home_city,home_region,lat,lng,genre,genres,draw,touring FROM bands WHERE id=?",
    id);
  return NextResponse.json({ ok:true, links, band: updated });
}
