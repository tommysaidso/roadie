import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import RingBoard from "@/components/RingBoard";
import BidThisRing from "@/components/BidThisRing";
import StopRequestForm from "@/components/StopRequestForm";
import { ensureRingSchema } from "@/lib/ring";
export const dynamic = "force-dynamic";

export default function Ring() {
  ensureRingSchema();
  const routes = all<any>("SELECT * FROM routes WHERE status IN ('announced','running') ORDER BY start_date");
  const stops = all<any>(`
    SELECT s.*, r.name route_name, r.arc,
      (SELECT COUNT(*) FROM host_bids h WHERE h.stop_id=s.id) bids,
      (SELECT COUNT(*) FROM stop_interest i WHERE i.stop_id=s.id AND i.interest='in') acts_in,
      (SELECT COUNT(*) FROM stop_interest i WHERE i.stop_id=s.id AND i.wants_host=1) host_asks
    FROM stops s LEFT JOIN routes r ON r.id=s.route_id
    WHERE s.status IN ('announced','onsale','confirmed')
    ORDER BY s.date`);
  const bands = all<any>("SELECT id,name,home_city FROM bands ORDER BY name");

  // hotel counts by city for fan area info
  const hotelRows = all<any>("SELECT city, COUNT(*) n FROM perks WHERE kind='hotel_night' GROUP BY lower(city)");
  const hotelsByCity: Record<string, number> = {};
  hotelRows.forEach((h: any) => { hotelsByCity[(h.city || "").toLowerCase()] = Number(h.n); });

  return (
    <Page
      title="The Ring"
      sub="We bring the stage, the roof, the PA and the crowd. These are the dates the ring is rolling. Bands pick the stops they want and how far they'll travel — hometown acts can ask to host their own. Sites bid for the ground. All-ages, no alcohol, every stop."
    >
      <BidThisRing routes={routes} />
      <RingBoard routes={routes} stops={stops} bands={bands} hotelsByCity={hotelsByCity} />
      <div className="mt-10 card p-5">
        <StopRequestForm />
      </div>
    </Page>
  );
}
