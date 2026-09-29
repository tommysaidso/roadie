// US ZIP assist.
//
// A US member types a ZIP; we tell them which ring they're nearest and what
// they can actually do from there. Deterministic and offline — no key, no API
// bill, no rate limit, and it keeps working when a provider doesn't.
//
// Resolution is the ZIP3 (first three digits), which lands you in the right
// part of a state. That is plenty to choose between six rings hundreds of
// kilometres apart; a full 42,000-row ZIP table would be more precision than
// the question needs and more weight than it's worth.
//
// SCOPE, stated honestly: the western states are mapped properly because that
// is where the rings are. Everywhere else in the US resolves to "outside the
// corridor" rather than a wrong guess — and that answer is still useful,
// because the real offer to a band in Florida is the route north, not a ring
// they can't drive to.

import { haversineKm } from "./geo";

type Zone = { lo: number; hi: number; state: string; lat: number; lng: number; place: string };

// ZIP3 ranges for the Pacific corridor and its neighbours. Coordinates are the
// rough centre of that range's population, not a mathematical centroid — the
// point is "which ring is nearest", not survey accuracy.
const ZONES: Zone[] = [
  // Washington
  { lo: 980, hi: 981, state: "WA", lat: 47.61, lng: -122.33, place: "Seattle area" },
  { lo: 982, hi: 982, state: "WA", lat: 48.30, lng: -122.35, place: "northwest Washington" },  // 982 spans Everett AND Bellingham
  { lo: 983, hi: 984, state: "WA", lat: 47.25, lng: -122.44, place: "Tacoma area" },
  { lo: 985, hi: 985, state: "WA", lat: 47.04, lng: -122.90, place: "Olympia area" },
  { lo: 986, hi: 986, state: "WA", lat: 45.63, lng: -122.67, place: "Vancouver WA area" },
  { lo: 988, hi: 988, state: "WA", lat: 48.42, lng: -122.33, place: "Mount Vernon area" },
  { lo: 989, hi: 989, state: "WA", lat: 46.60, lng: -120.51, place: "Yakima area" },
  { lo: 990, hi: 992, state: "WA", lat: 47.66, lng: -117.43, place: "Spokane area" },
  { lo: 993, hi: 994, state: "WA", lat: 46.23, lng: -119.09, place: "Tri-Cities area" },
  // Oregon
  { lo: 970, hi: 972, state: "OR", lat: 45.52, lng: -122.68, place: "Portland area" },
  { lo: 973, hi: 973, state: "OR", lat: 44.94, lng: -123.04, place: "Salem area" },
  { lo: 974, hi: 974, state: "OR", lat: 44.05, lng: -123.09, place: "Eugene area" },
  { lo: 975, hi: 975, state: "OR", lat: 42.33, lng: -122.87, place: "Medford area" },
  { lo: 976, hi: 976, state: "OR", lat: 42.22, lng: -121.78, place: "Klamath Falls area" },
  { lo: 977, hi: 978, state: "OR", lat: 44.06, lng: -121.31, place: "Bend area" },
  { lo: 979, hi: 979, state: "OR", lat: 45.34, lng: -118.08, place: "eastern Oregon" },
  // California
  { lo: 900, hi: 908, state: "CA", lat: 34.05, lng: -118.24, place: "Los Angeles area" },
  { lo: 909, hi: 912, state: "CA", lat: 34.11, lng: -117.29, place: "San Bernardino area" },
  { lo: 913, hi: 918, state: "CA", lat: 34.19, lng: -118.60, place: "San Fernando Valley" },
  { lo: 919, hi: 921, state: "CA", lat: 32.72, lng: -117.16, place: "San Diego area" },
  { lo: 922, hi: 922, state: "CA", lat: 33.72, lng: -116.24, place: "Palm Springs area" },
  { lo: 923, hi: 925, state: "CA", lat: 33.98, lng: -117.37, place: "Riverside area" },
  { lo: 926, hi: 928, state: "CA", lat: 33.68, lng: -117.83, place: "Orange County" },
  { lo: 930, hi: 931, state: "CA", lat: 34.42, lng: -119.70, place: "Santa Barbara / Ventura" },
  { lo: 932, hi: 933, state: "CA", lat: 35.37, lng: -119.02, place: "Bakersfield area" },
  { lo: 934, hi: 934, state: "CA", lat: 34.95, lng: -120.44, place: "Santa Maria area" },
  { lo: 935, hi: 935, state: "CA", lat: 35.29, lng: -118.02, place: "Mojave area" },
  { lo: 936, hi: 938, state: "CA", lat: 36.75, lng: -119.77, place: "Fresno area" },
  { lo: 939, hi: 939, state: "CA", lat: 36.60, lng: -121.89, place: "Monterey area" },
  { lo: 940, hi: 941, state: "CA", lat: 37.77, lng: -122.42, place: "San Francisco area" },
  { lo: 942, hi: 942, state: "CA", lat: 38.58, lng: -121.49, place: "Sacramento area" },
  { lo: 943, hi: 944, state: "CA", lat: 37.44, lng: -122.14, place: "Peninsula" },
  { lo: 945, hi: 946, state: "CA", lat: 37.80, lng: -122.27, place: "East Bay" },
  { lo: 947, hi: 947, state: "CA", lat: 37.87, lng: -122.27, place: "Berkeley area" },
  { lo: 948, hi: 948, state: "CA", lat: 37.97, lng: -122.34, place: "Richmond area" },
  { lo: 949, hi: 949, state: "CA", lat: 38.08, lng: -122.56, place: "North Bay" },
  { lo: 950, hi: 951, state: "CA", lat: 37.34, lng: -121.89, place: "San Jose area" },
  { lo: 952, hi: 953, state: "CA", lat: 37.96, lng: -121.29, place: "Stockton area" },
  { lo: 954, hi: 954, state: "CA", lat: 38.44, lng: -122.71, place: "Santa Rosa area" },
  { lo: 955, hi: 955, state: "CA", lat: 40.80, lng: -124.16, place: "Eureka area" },
  { lo: 956, hi: 957, state: "CA", lat: 38.58, lng: -121.49, place: "Sacramento area" },
  { lo: 958, hi: 959, state: "CA", lat: 38.68, lng: -121.77, place: "Sacramento Valley" },
  { lo: 960, hi: 961, state: "CA", lat: 40.59, lng: -122.39, place: "Redding area" },
  // Alaska
  { lo: 995, hi: 995, state: "AK", lat: 61.22, lng: -149.90, place: "Anchorage area" },
  { lo: 996, hi: 996, state: "AK", lat: 61.58, lng: -149.44, place: "Mat-Su area" },
  { lo: 997, hi: 997, state: "AK", lat: 64.84, lng: -147.72, place: "Fairbanks area" },
  { lo: 998, hi: 998, state: "AK", lat: 58.30, lng: -134.42, place: "Juneau area" },
  { lo: 999, hi: 999, state: "AK", lat: 55.34, lng: -131.65, place: "Ketchikan area" },
  // Inland neighbours — not corridor, but close enough that the nearest ring
  // is a real answer rather than a shrug.
  { lo: 832, hi: 838, state: "ID", lat: 43.62, lng: -116.20, place: "Idaho" },
  { lo: 590, hi: 599, state: "MT", lat: 46.87, lng: -113.99, place: "Montana" },
  { lo: 889, hi: 898, state: "NV", lat: 39.53, lng: -119.81, place: "Nevada" },
  { lo: 820, hi: 831, state: "WY", lat: 41.14, lng: -104.82, place: "Wyoming" },
  { lo: 840, hi: 847, state: "UT", lat: 40.76, lng: -111.89, place: "Utah" },
  { lo: 850, hi: 865, state: "AZ", lat: 33.45, lng: -112.07, place: "Arizona" },
];

export type ZipHit = {
  zip: string; zip3: number; state: string; place: string;
  lat: number; lng: number; in_corridor: boolean;
};

/** Parse and locate a US ZIP. Returns null if it isn't a plausible ZIP. */
export function locateZip(raw: string): ZipHit | null {
  const digits = String(raw || "").replace(/\D/g, "");
  // ZIP+4 is fine; we only ever use the first five.
  if (digits.length < 5) return null;
  const zip = digits.slice(0, 5);
  const zip3 = Number(zip.slice(0, 3));
  if (!Number.isFinite(zip3)) return null;

  const zone = ZONES.find(z => zip3 >= z.lo && zip3 <= z.hi);
  if (!zone) {
    // A real ZIP we simply don't map. Say so rather than guess a location —
    // a wrong "nearest ring" is worse than an honest "not near one".
    return { zip, zip3, state: "", place: "", lat: 0, lng: 0, in_corridor: false };
  }
  return {
    zip, zip3, state: zone.state, place: zone.place,
    lat: zone.lat, lng: zone.lng,
    in_corridor: ["WA", "OR", "CA", "AK"].includes(zone.state),
  };
}

/** Nearest hub to a point, with the straight-line distance. */
export function nearestHub(lat: number, lng: number, hubs: any[]) {
  let best: { hub: any; km: number } | null = null;
  for (const h of hubs || []) {
    const hlat = Number(h.center_lat), hlng = Number(h.center_lng);
    if (!Number.isFinite(hlat) || !Number.isFinite(hlng)) continue;
    const km = haversineKm([lat, lng], [hlat, hlng]);
    if (!best || km < best.km) best = { hub: h, km };
  }
  return best;
}
