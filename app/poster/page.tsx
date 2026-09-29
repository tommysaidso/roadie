import { all, one } from "@/lib/db";
import { Page } from "@/components/ui";
import PosterStudio from "@/components/PosterStudio";
export const dynamic = "force-dynamic";
export default function PosterPage(){
  const bands = all<any>("SELECT id,name,genre,genres,home_city,draw FROM bands ORDER BY name");
  const venues = all<any>("SELECT id,name,city,capacity,genres FROM venues ORDER BY city,name");
  const bookings = all<any>(`SELECT b.id,b.date,b.guarantee, ba.id band_id, ba.name band, ba.draw, ba.genre,
      v.id venue_id, v.name venue, v.city, v.capacity
      FROM bookings b JOIN bands ba ON ba.id=b.band_id JOIN venues v ON v.id=b.venue_id ORDER BY b.date`);
  const sponsors = all<any>("SELECT id,name,kind FROM sponsors ORDER BY name");
  const roi = one<any>("SELECT SUM(impressions) impr, SUM(clicks) clk FROM ad_placements WHERE impressions>0") || {};
  return (
    <Page title="Poster & Pitch Studio" sub="ROADIE drafts the artwork. Make a stop poster the host site and band can post anywhere — or a one-page sponsorship proposal a band brings to a local store or route sponsor as proof. Download or print.">
      <PosterStudio bands={bands} venues={venues} bookings={bookings} sponsors={sponsors} roi={roi}/>
    </Page>
  );
}
