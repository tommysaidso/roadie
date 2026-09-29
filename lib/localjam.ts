// LocalJams location template — ONE template, every town independent.
//
// The SoCal Jams page is the template; each town (localjams/<slug>) renders the
// SAME sections from ITS OWN data: venues, JamPoints vendors, artist spotlights
// (local + national). USA and Canada. No hardcoded SoCal copy leaks between them.
// See [project-localjams-hub], [jampoints-canvassing-loyalty-doctrine].
import { all, one } from "./db";

export type LJLoc = {
  slug: string; city: string; code: string; region: string;
  country: "US" | "CA"; color: string;
};

const G = "#37c26b", B = "#4f8ce0", O = "#e8622a", R = "#e0473a", C = "#33cfd6";

// Slugs match the FAL icon filenames in /public/localjams-icons/<slug>.png
export const LJ_LOCATIONS: LJLoc[] = [
  { slug: "vancouver-bc", city: "Vancouver", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "nanaimo-bc", city: "Nanaimo", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "victoria-bc", city: "Victoria", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "whistler-bc", city: "Whistler", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "kelowna-bc", city: "Kelowna", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "kootenays-bc", city: "Kootenays", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "smithers-bc", city: "Smithers", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "hazelton-bc", city: "Hazelton", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "prince-george-bc", city: "Prince George", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "quesnel-bc", city: "Quesnel", code: "BC", region: "British Columbia", country: "CA", color: G },
  { slug: "calgary-ab", city: "Calgary", code: "AB", region: "Alberta", country: "CA", color: O },
  { slug: "moose-jaw-sk", city: "Moose Jaw", code: "SK", region: "Saskatchewan", country: "CA", color: B },
  { slug: "winnipeg-mb", city: "Winnipeg", code: "MB", region: "Manitoba", country: "CA", color: B },
  { slug: "toronto-on", city: "Toronto", code: "ON", region: "Ontario", country: "CA", color: R },
  { slug: "montreal-qc", city: "Montreal", code: "QC", region: "Quebec", country: "CA", color: B },
  { slug: "seattle-wa", city: "Seattle", code: "WA", region: "Washington", country: "US", color: G },
  { slug: "vancouver-wa", city: "Vancouver WA", code: "WA", region: "Washington", country: "US", color: G },
  { slug: "los-angeles-ca", city: "Los Angeles", code: "CA", region: "California", country: "US", color: O },
  { slug: "big-bear-ca", city: "Big Bear", code: "CA", region: "California", country: "US", color: O },
  { slug: "san-diego-ca", city: "San Diego", code: "CA", region: "California", country: "US", color: C },
  { slug: "denver-co", city: "Denver", code: "CO", region: "Colorado", country: "US", color: B },
  { slug: "chicago-il", city: "Chicago", code: "IL", region: "Illinois", country: "US", color: B },
  { slug: "austin-tx", city: "Austin", code: "TX", region: "Texas", country: "US", color: O },
  { slug: "nashville-tn", city: "Nashville", code: "TN", region: "Tennessee", country: "US", color: R },
  { slug: "new-york-ny", city: "New York", code: "NY", region: "New York", country: "US", color: B },
  { slug: "miami-fl", city: "Miami", code: "FL", region: "Florida", country: "US", color: C },
];

export function findLoc(slug: string): LJLoc | null {
  return LJ_LOCATIONS.find(l => l.slug === slug) || null;
}

function safe<T>(fn: () => T[], d: T[] = []): T[] { try { return fn() || d; } catch { return d; } }

export function locData(loc: LJLoc) {
  const city = loc.city.replace(/\s+[A-Z]{2}$/, ""); // "Vancouver WA" -> "Vancouver"
  const like = city + "%";                            // match "Big Bear" to "Big Bear Lake"
  const venues = safe<any>(() => all(
    `SELECT id,name,city,capacity,genres,notes,pay_model,user_id,member_status
       FROM venues WHERE lower(city) LIKE lower(?) ORDER BY (user_id IS NOT NULL) DESC, name LIMIT 24`, like));
  const vendors = safe<any>(() => all(
    `SELECT business_name,title,value,kind,terms FROM vendor_offers
      WHERE lower(city) LIKE lower(?) AND active=1 AND suspended=0 ORDER BY created_at DESC LIMIT 24`, like));
  const local = safe<any>(() => all(
    `SELECT id,name,genre,home_city,hero_image,mymymy_artist_id,touring
       FROM bands WHERE lower(home_city) LIKE lower(?) ORDER BY touring DESC, draw DESC LIMIT 8`, like));
  const national = safe<any>(() => all(
    `SELECT id,name,genre,home_city,hero_image FROM bands
      WHERE touring=1 AND lower(home_city) NOT LIKE lower(?) ORDER BY draw DESC LIMIT 6`, like));
  const nextJam = safe<any>(() => all(
    `SELECT s.date, v.name venue FROM venue_slots s JOIN venues v ON v.id=s.venue_id
      WHERE lower(v.city) LIKE lower(?) AND s.status='open' ORDER BY s.date LIMIT 1`, like))[0] || null;
  return { venues, vendors, local, national, nextJam };
}
