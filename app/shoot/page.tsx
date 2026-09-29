import { Page } from "@/components/ui";
import ShootUploader from "./ShootUploader";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ShootPage({ searchParams }: { searchParams: { stop?: string; k?: string } }) {
  // Recent nights only. A fan uploading is doing it hours or days after the
  // show, not months — and a list of every stop we have ever run is a scroll
  // nobody finishes.
  const stops = all<any>(
    `SELECT s.id, s.city, s.date, v.name AS venue
       FROM stops s LEFT JOIN venues v ON v.id = s.venue_id
      WHERE s.date <= date('now', '+1 day') OR s.is_test = 1
      ORDER BY s.is_test DESC, s.date DESC LIMIT 30`);

  return (
    <Page
      title="You were there. Send us what you shot."
      sub="Every phone in the room is a camera. Your clips get lined up against everyone else's from that night and cut into one multi-camera video of the show."
    >
      <ShootUploader stops={stops} initialStop={Number(searchParams?.stop) || undefined}
        shareToken={searchParams?.k || undefined} />
    </Page>
  );
}
