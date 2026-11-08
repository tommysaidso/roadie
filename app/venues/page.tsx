import { cookies } from "next/headers";
import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import SlotMatch from "@/components/SlotMatch";
import PromoBanner from "@/components/PromoBanner";
import VenueFinder from "@/components/VenueFinder";
import VenueBrowser from "@/components/VenueBrowser";
import HubMap from "@/components/HubMap";
import { ensureVenueCalendarSchema } from "@/lib/ics";
import { getHub, hubLoop } from "@/lib/hubs";
export const metadata = { title: "Host Sites", alternates: { canonical: "/venues" } };
export const dynamic = "force-dynamic";

export default async function Venues() {
  ensureVenueCalendarSchema();

  // Scope to the ring the visitor is actually in. This page used to render
  // EVERY venue in the database with no hub predicate at all, so a Canadian
  // operator browsing the Interior saw California fairgrounds in the same list
  // — and all ~900 of them, expanded, in one wall.
  const jar = await cookies();
  const hub = getHub(jar.get("roadie_hub")?.value);
  const loop = hubLoop(hub);
  const gkey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const venues = all<any>("SELECT * FROM venues WHERE hub_id=? ORDER BY city,name", hub.id);
  const slotRows = all<any>(
    `SELECT s.*, v.name venue, v.city, v.id venue_id
       FROM venue_slots s JOIN venues v ON v.id=s.venue_id
      WHERE s.status='open' AND v.hub_id=?
      ORDER BY v.city, v.name, s.date`, hub.id);

  // One room, one block — a venue with four open nights was printing four
  // near-identical rows that read as duplicate venues.
  const byVenue: { venue: string; city: string; slots: any[] }[] = [];
  for (const s of slotRows) {
    const last = byVenue[byVenue.length - 1];
    if (last && last.venue === s.venue && last.city === s.city) last.slots.push(s);
    else byVenue.push({ venue: s.venue, city: s.city, slots: [s] });
  }

  return (
    <Page
      title="Host Sites"
      sub={`ROADIE brings the ring, the tent, the stage and the crowd. Rooms, fairgrounds and fields across ${hub.name} apply to host a stop — we pick the ground that fits the date. Sites can also post their own open nights, and ROADIE smart-places the right band into each one.`}
    >
      <PromoBanner src="/promo/venue-calendar.png" alt="Empty Tuesday? ROADIE fills it" />
      <VenueFinder />
      {/* Map-first: the ring's ground, pins for every room. Tap a pin and the
          list below opens that town — the map is the way in, the list follows. */}
      <HubMap venues={venues} bands={[]} defaultLoop={loop} googleKey={gkey}
        center={{ lat: hub.center_lat, lng: hub.center_lng }} zoom={hub.default_zoom}
        box={{ minLng: hub.bbox_min_lng, maxLng: hub.bbox_max_lng, minLat: hub.bbox_min_lat, maxLat: hub.bbox_max_lat }} />
      <VenueBrowser venues={venues} hubName={hub.name} loopCities={loop} />

      <h2 className="text-xl font-black mt-8 mb-3">Open slots — AI smart placement</h2>
      {byVenue.length === 0 && (
        <div className="card p-5 text-sm text-muted">
          No open nights posted in {hub.name} yet. Any claimed room can post one from its console.
        </div>
      )}
      <div className="space-y-4">
        {byVenue.map(g => (
          <div key={`${g.venue}|${g.city}`} className="card p-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-bold">{g.venue}</span>
              <span className="text-muted text-sm">• {g.city}</span>
              <span className="text-[11px] text-muted ml-auto">
                {g.slots.length} open night{g.slots.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {g.slots.map((s: any) => <SlotMatch key={s.id} slot={s} hideVenue />)}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
