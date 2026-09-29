import { NextRequest, NextResponse } from "next/server";
import { all, one } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureHubSchema, hubLoop } from "@/lib/hubs";
export const dynamic = "force-dynamic";

// ADMIN ring intelligence — "pick a ring, show me every business in it and who
// I actually phone to hold the event."
//
// This is the operator's booking sheet, not a public directory. It answers, per
// town on the loop, in route order:
//   · which sites could physically hold the night, ranked by how bookable they are
//   · who to call first, and whether we even have a number
//   · the town's Chamber of Commerce, which is the door in when no room answers
//   · which towns have NOTHING — the legs that break the ring
//
// Deliberately NOT the band or business view: it exposes unclaimed listings,
// missing contacts and coverage holes, which is operator-only information.

type Row = Record<string, any>;

// How bookable is this site for a ring stop? Scored so the operator's call list
// sorts itself — a big room nobody can phone is worth less than a hall with a
// number on it.
function scoreSite(v: Row) {
  const why: string[] = [];
  let score = 0;
  const kind = String(v.genres || "").toLowerCase();
  const contactable = !!String(v.contact || "").trim();

  if (contactable) { score += 4; why.push("has a contact"); }
  else why.push("NO contact on file");

  if (/arena|fairground|stadium|field/.test(kind)) { score += 3; why.push("holds a crowd outdoors/large"); }
  else if (/community_hall|legion|event_venue|theatre/.test(kind)) { score += 3; why.push("purpose-built room"); }
  else if (/curling|bingo|fire_hall/.test(kind)) { score += 2; why.push("town hall-of-record"); }

  const cap = Number(v.capacity || 0);
  if (cap >= 400) { score += 3; why.push(`capacity ${cap}`); }
  else if (cap >= 150) { score += 2; why.push(`capacity ${cap}`); }
  else if (cap > 0) { score += 1; why.push(`capacity ${cap}`); }

  if (v.user_id) { score += 2; why.push("claimed — a human is behind it"); }
  if (String(v.verification_status || "") === "verified") { score += 1; why.push("verified business"); }
  if (v.calendar_url) { score += 1; why.push("publishes a calendar"); }
  if (String(v.member_status || "") === "sample") why.push("unclaimed listing");

  return { score, why };
}

export async function GET(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Ring intelligence is operator-only.");
  ensureHubSchema();

  const slug = (req.nextUrl.searchParams.get("hub") || "").trim();
  const hubs = all<Row>("SELECT * FROM hubs ORDER BY live DESC, id");
  const hub = slug ? one<Row>("SELECT * FROM hubs WHERE slug=?", slug) : hubs[0];
  if (!hub) return NextResponse.json({ error: "no such ring" }, { status: 404 });

  const venues = all<Row>("SELECT * FROM venues WHERE hub_id=? ORDER BY city, name", hub.id);

  let chambers: Row[] = [];
  try {
    chambers = all<Row>("SELECT * FROM contacts WHERE role='chamber_of_commerce'");
  } catch { chambers = []; }   // table only exists once an import has run

  let sponsors: Row[] = [];
  try {
    sponsors = all<Row>("SELECT * FROM sponsors WHERE hub_id=? ORDER BY name", hub.id);
  } catch { sponsors = []; }

  const norm = (s: any) => String(s || "").toLowerCase().trim();
  const loop = hubLoop(hub as any);                // route order, as authored
  const townsSeen = new Set<string>();
  const towns: Row[] = [];

  const pushTown = (name: string, onLoop: boolean) => {
    const key = norm(name);
    if (!key || townsSeen.has(key)) return;
    townsSeen.add(key);
    const sites = venues.filter(v => norm(v.city) === key)
      .map(v => {
        const { score, why } = scoreSite(v);
        return {
          id: v.id, name: v.name, kind: v.genres || "", capacity: v.capacity || null,
          contact: v.contact || "", claimed: !!v.user_id,
          member_status: v.member_status, verification_status: v.verification_status,
          score, why,
        };
      })
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));

    towns.push({
      town: name,
      on_loop: onLoop,
      site_count: sites.length,
      contactable: sites.filter(s => s.contact).length,
      claimed: sites.filter(s => s.claimed).length,
      best: sites.slice(0, 5),
      all_sites: sites,
      chamber: chambers.filter(c => norm(c.city) === key)
        .map(c => ({ name: c.name, phone: c.phone || "", website: c.website || "", email: c.email || "" })),
      // The whole point of the view: an on-loop town with no room is a broken leg.
      gap: onLoop && sites.length === 0,
    });
  };

  for (const t of loop) pushTown(String(t), true);          // route order first
  for (const v of venues) pushTown(String(v.city || ""), false);  // then anything else in the ring

  const onLoop = towns.filter(t => t.on_loop);
  return NextResponse.json({
    rings: hubs.map(h => ({ slug: h.slug, name: h.name, province: h.province, live: !!h.live })),
    hub: {
      slug: hub.slug, name: hub.name, province: hub.province, live: !!hub.live,
      tagline: hub.tagline, loop_cities: loop,
    },
    summary: {
      towns_on_loop: onLoop.length,
      towns_with_rooms: onLoop.filter(t => t.site_count > 0).length,
      broken_legs: onLoop.filter(t => t.gap).map(t => t.town),
      total_sites: venues.length,
      contactable: venues.filter(v => String(v.contact || "").trim()).length,
      claimed: venues.filter(v => v.user_id).length,
      chambers: chambers.filter(c => townsSeen.has(norm(c.city))).length,
      sponsors: sponsors.length,
    },
    towns,
    sponsors: sponsors.map(s => ({ id: s.id, name: s.name, city: s.city, kind: s.kind, claimed: !!s.user_id })),
  });
}
