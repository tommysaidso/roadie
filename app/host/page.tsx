import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import HostBidForm from "@/components/HostBidForm";
import { ensureRingSchema } from "@/lib/ring";
export const metadata = { title: "Host the Ring", alternates: { canonical: "/host" } };
export const dynamic = "force-dynamic";

export default function Host() {
  ensureRingSchema();
  const stops = all<any>(`
    SELECT s.id, s.date, s.city, s.region, s.site_name, s.site_kind, s.site_scale,
           s.capacity, s.lot_spaces, s.status, r.name route_name, r.arc,
           (SELECT COUNT(*) FROM host_bids h WHERE h.stop_id=s.id) bids
    FROM stops s LEFT JOIN routes r ON r.id=s.route_id
    WHERE s.status IN ('announced','onsale')
    ORDER BY s.date`);
  return (
    <Page
      title="Host the Ring"
      sub="The ring rolls into these towns on these dates whether or not a room puts its hand up. Hosting means the crowd loads in through your gate instead of past your door. Put up the ground, we bring the stage, the roof, the PA, the bill and the marketing."
    >
      <HostBidForm stops={stops} />
    </Page>
  );
}
