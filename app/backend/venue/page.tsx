import { cookies } from "next/headers";
import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import VenueConsole from "./VenueConsole";
import OpportunityTracker from "@/components/OpportunityTracker";
import VenuePromo from "@/components/VenuePromo";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { isElevated } from "@/lib/guard";
export const dynamic = "force-dynamic";

export default async function VenueBackend() {
  const jar = await cookies();
  const me: any = userForToken(jar.get(SESSION_COOKIE)?.value);

  // The room picker used to list every venue in the database — 919 of them,
  // none of them yours. Posting a night on someone else's room is correctly
  // refused by the API, so the button just failed silently. Show the rooms this
  // account actually owns; operators still see everything.
  const mineId = me?.venue_id ? Number(me.venue_id) : null;
  const venues = isElevated(me)
    ? all<any>("SELECT id,name,city,capacity,genres FROM venues ORDER BY city,name")
    : mineId
      ? all<any>("SELECT id,name,city,capacity,genres FROM venues WHERE id=?", mineId)
      : [];

  const ids = venues.map(v => v.id);
  const bookings = ids.length
    ? all<any>(`SELECT b.id,b.band_id,b.venue_id,b.date,b.bill_position,b.status
                  FROM bookings b WHERE b.venue_id IN (${ids.map(() => "?").join(",")})
                 ORDER BY b.date DESC LIMIT 40`, ...ids)
    : [];
  const bandIds = [...new Set(bookings.map(b => b.band_id).filter(Boolean))];
  const bands = bandIds.length
    ? all<any>(`SELECT id,name,genres,genre,draw,home_city FROM bands WHERE id IN (${bandIds.map(() => "?").join(",")})`, ...bandIds)
    : all<any>("SELECT id,name,genres,genre,draw,home_city FROM bands ORDER BY name LIMIT 40");
  let sponsors: any[] = [];
  try { sponsors = all<any>("SELECT id,name,kind,city FROM sponsors ORDER BY name LIMIT 40"); } catch {}

  return (
    <Page
      title="Venue console"
      sub="Your room: post open nights, watch bookings land, let ROADIE suggest who fills each gap — and build the poster and the sponsor one-pager for the night without leaving the page."
    >
      {venues.length === 0 ? (
        <div className="card p-6">
          <div className="text-lg font-black">No room linked to this account yet</div>
          <p className="text-sm text-muted mt-1">
            Claim your room and this console becomes yours — open nights, bookings, fill
            suggestions, and the promo tools.
          </p>
          <a href="/venues" className="btn btn-neon text-sm mt-3 inline-block">Find and claim your room</a>
        </div>
      ) : (
        <>
          <VenueConsole venues={venues} />
          <h2 className="text-xl font-black mt-8 mb-3">Make something for the night</h2>
          <VenuePromo venues={venues} bands={bands} bookings={bookings} sponsors={sponsors} />
          <h2 className="text-xl font-black mt-8 mb-3">Fill suggestions for open nights</h2>
          <OpportunityTracker />
        </>
      )}
    </Page>
  );
}
