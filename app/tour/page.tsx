import { cookies } from "next/headers";
import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import TourWorkspace from "@/components/TourWorkspace";
import { ensureRingSchema } from "@/lib/ring";
import { getHub } from "@/lib/hubs";
export const dynamic = "force-dynamic";

// One Tour surface.
//
// This replaced six sibling nav items — Ring, Notice Board, Tour Map, Plan a
// Tour, Calendar, Border & Visas — that shared no context: you picked a ring on
// one page and the next page had never heard of it. Here the ring is chosen
// once at the top and every tab reads through it.
export default async function Tour() {
  ensureRingSchema();
  const jar = await cookies();
  const hub = getHub(jar.get("roadie_hub")?.value);

  const routes = all<any>(
    `SELECT * FROM routes WHERE status NOT IN ('cancelled') ORDER BY start_date DESC, id DESC`);

  const stops = all<any>(`
    SELECT s.*, r.name route_name, r.arc, r.season,
      (SELECT COUNT(*) FROM host_bids h WHERE h.stop_id=s.id) ground_bids,
      (SELECT COUNT(*) FROM stop_interest i WHERE i.stop_id=s.id AND i.interest='in') acts_in,
      (SELECT COUNT(*) FROM stop_interest i WHERE i.stop_id=s.id AND i.wants_host=1) host_asks,
      (SELECT name FROM bands b WHERE b.id=s.headliner_band_id) headliner
    FROM stops s LEFT JOIN routes r ON r.id=s.route_id
    ORDER BY s.seq, s.date`);

  // Notices are hub-scoped, not route-scoped — the board is the corridor's, and
  // a route can cross hubs, so it's filtered by the ring's hubs in the client.
  let notices: any[] = [];
  try {
    notices = all<any>(
      `SELECT * FROM notices ORDER BY created_at DESC LIMIT 60`);
  } catch { notices = []; }

  const hubs = all<any>("SELECT id,slug,name,province FROM hubs");

  return (
    <Page
      title="Tour"
      sub="One ring at a time: the stops and who's on each bill, the run as a calendar, what the corridor is asking for, and who wants in. Pick the ring once — everything below follows it."
    >
      <TourWorkspace routes={routes} stops={stops} notices={notices} hubs={hubs} hubName={hub?.name || ""} />
    </Page>
  );
}
