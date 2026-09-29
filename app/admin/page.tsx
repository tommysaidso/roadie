import Link from "next/link";
import { all, one } from "@/lib/db";
import { Page } from "@/components/ui";
import AdminConsole from "@/components/AdminConsole";
import RtvQueue from "@/components/RtvQueue";
import { ensureRtvSchema } from "@/lib/rtv";
import { ensureRingSchema } from "@/lib/ring";
export const dynamic = "force-dynamic";

export default function Admin() {
  ensureRingSchema();
  ensureRtvSchema();
  const routes = all<any>(`
    SELECT r.*, (SELECT COUNT(*) FROM stops s WHERE s.route_id=r.id) stop_count
    FROM routes r ORDER BY r.start_date DESC`);
  const stops = all<any>(`
    SELECT s.*, r.name route_name,
      (SELECT COUNT(*) FROM host_bids h WHERE h.stop_id=s.id) bids,
      (SELECT COUNT(*) FROM stop_interest i WHERE i.stop_id=s.id AND i.interest='in') acts_in,
      (SELECT COUNT(*) FROM stop_interest i WHERE i.stop_id=s.id AND i.wants_host=1) host_asks,
      (SELECT COUNT(*) FROM vendor_spots v WHERE v.stop_id=s.id) vendors,
      (SELECT COALESCE(SUM(c.headcount),0) FROM local_crew c WHERE c.stop_id=s.id) crew
    FROM stops s LEFT JOIN routes r ON r.id=s.route_id
    ORDER BY s.date`);
  const bids = all<any>(`
    SELECT b.*, s.city stop_city, s.date stop_date
    FROM host_bids b LEFT JOIN stops s ON s.id=b.stop_id
    ORDER BY b.score DESC, b.created_at DESC`);
  const interest = all<any>(`
    SELECT i.*, bd.name band, bd.home_city, bd.genre, bd.draw, s.city stop_city, s.date stop_date
    FROM stop_interest i
    JOIN bands bd ON bd.id=i.band_id
    JOIN stops s ON s.id=i.stop_id
    ORDER BY i.wants_host DESC, bd.draw DESC`);
  const crew = all<any>(`
    SELECT c.*, r.name route_name, s.city stop_city, s.date stop_date
    FROM event_crew c
    LEFT JOIN routes r ON r.id=c.route_id
    LEFT JOIN stops s ON s.id=c.stop_id
    ORDER BY c.department, c.name`);
  const totals = one<any>(`
    SELECT (SELECT COUNT(*) FROM stops) stops,
           (SELECT COUNT(*) FROM host_bids) bids,
           (SELECT COUNT(*) FROM stop_interest WHERE interest='in') acts,
           (SELECT COUNT(*) FROM stops WHERE advance_status='unassigned') unassigned,
           (SELECT COUNT(*) FROM event_crew) crew`) || {};

  return (
    <Page
      title="Admin console"
      sub="Behind the curtain: build the route, score the ground bids, place the bill and staff each stop. Nothing here is visible to bands or the public."
      actions={
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Link href="/admin/agreements" className="btn btn-neon">Paperwork &amp; crew</Link>
          <Link href="/admin/studio" className="btn">Promo studio</Link>
          <Link href="/admin/offers" className="btn btn-neon">Sponsor offers</Link>
          <Link href="/admin/vendor-offers" className="btn">Vendor offers</Link>
          <Link href="/admin/multicam" className="btn">Fan multicam</Link>
          <Link href="/admin/ring-pitch" className="btn">Business plan</Link>
          <Link href="/admin/pitch" className="btn">Film pitch</Link>
          <Link href="/admin/production" className="btn">Production team</Link>
        </div>
      }
    >
      {/* Bands send videos to RTV and they don't air until somebody looks. Put
          the queue where the operator already is, so it isn't a page nobody
          remembers to open. */}
      <h2 className="text-xl font-black mb-3 mt-2">RTV — waiting on review</h2>
      <div className="mb-8"><RtvQueue /></div>

      <AdminConsole routes={routes} stops={stops} bids={bids} interest={interest} crew={crew} totals={totals} />
    </Page>
  );
}
