// Postal lookup for both countries, using each one's own words.
//
// Canada has POSTAL CODES (A1A 1A1); the USA has ZIP codes (98225). Calling
// either by the other's name is the kind of small wrongness that tells a member
// the thing wasn't built for them, so the label follows the country everywhere
// it appears.
//
// Both resolve at the same coarseness on purpose:
//   CA — the FSA, the first three characters. Its first letter is the province.
//   US — the ZIP3, the first three digits.
// That's enough to pick between rings hundreds of kilometres apart, and it
// needs no third-party lookup, no key and no bill.

import { locateZip, nearestHub, type ZipHit } from "./uszip";

export { nearestHub };

/** What the field is called where the member lives. */
export const POSTAL_LABEL: Record<string, string> = { CA: "Postal code", US: "ZIP code" };
export const POSTAL_PLACEHOLDER: Record<string, string> = { CA: "V1Y 1A1", US: "98225" };

// Canadian FSA first letter → province. Long-settled, so this can be a table.
const FSA_PROVINCE: Record<string, string> = {
  A: "NL", B: "NS", C: "PE", E: "NB",
  G: "QC", H: "QC", J: "QC",
  K: "ON", L: "ON", M: "ON", N: "ON", P: "ON",
  R: "MB", S: "SK", T: "AB", V: "BC", X: "NT", Y: "YT",
};

// Rough centres per FSA prefix — again, "which ring is nearest", not survey work.
const CA_ZONES: Record<string, { lat: number; lng: number; place: string }> = {
  // BC, finer because that's where the live rings are.
  V0: { lat: 50.00, lng: -120.00, place: "rural BC" },
  V1: { lat: 49.89, lng: -119.50, place: "southern interior" },
  V2: { lat: 49.05, lng: -122.30, place: "Fraser Valley" },
  V3: { lat: 49.19, lng: -122.85, place: "Surrey / Langley" },
  V4: { lat: 49.12, lng: -123.00, place: "Delta / Richmond" },
  V5: { lat: 49.25, lng: -123.00, place: "Vancouver / Burnaby" },
  V6: { lat: 49.26, lng: -123.12, place: "Vancouver" },
  V7: { lat: 49.32, lng: -123.07, place: "North Shore" },
  V8: { lat: 48.43, lng: -123.37, place: "Victoria area" },
  V9: { lat: 49.17, lng: -123.94, place: "Vancouver Island" },
  // Alberta
  T0: { lat: 52.00, lng: -113.50, place: "rural Alberta" },
  T1: { lat: 49.70, lng: -112.83, place: "southern Alberta" },
  T2: { lat: 51.05, lng: -114.07, place: "Calgary" },
  T3: { lat: 51.09, lng: -114.20, place: "Calgary" },
  T4: { lat: 52.27, lng: -113.81, place: "Red Deer area" },
  T5: { lat: 53.55, lng: -113.49, place: "Edmonton" },
  T6: { lat: 53.47, lng: -113.50, place: "Edmonton" },
  T7: { lat: 53.57, lng: -114.00, place: "Edmonton area" },
  T8: { lat: 55.17, lng: -118.80, place: "Grande Prairie area" },
  T9: { lat: 56.73, lng: -111.38, place: "Fort McMurray area" },
};

// Province centres, for anywhere without a finer entry.
const PROVINCE_CENTRE: Record<string, { lat: number; lng: number }> = {
  BC: { lat: 49.89, lng: -119.50 }, AB: { lat: 51.05, lng: -114.07 },
  SK: { lat: 52.13, lng: -106.67 }, MB: { lat: 49.90, lng: -97.14 },
  ON: { lat: 43.65, lng: -79.38 },  QC: { lat: 45.50, lng: -73.57 },
  NB: { lat: 45.96, lng: -66.64 },  NS: { lat: 44.65, lng: -63.58 },
  PE: { lat: 46.24, lng: -63.13 },  NL: { lat: 47.56, lng: -52.71 },
  YT: { lat: 60.72, lng: -135.06 }, NT: { lat: 62.45, lng: -114.37 },
};

export type PostalHit = {
  country: "CA" | "US";
  code: string;          // normalised for display
  region: string;        // province or state
  place: string;
  lat: number; lng: number;
  in_corridor: boolean;  // near a ring we actually run
  label: string;         // what to call this field
};

/** Canadian postal code → FSA location. */
function locateCa(raw: string): PostalHit | null {
  const clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 3) return null;
  const letter = clean[0];
  const province = FSA_PROVINCE[letter];
  if (!province) return null;
  if (!/[0-9]/.test(clean[1]) || !/[A-Z]/.test(clean[2])) return null;

  const fsa = clean.slice(0, 3);
  const zone = CA_ZONES[clean.slice(0, 2)];
  const centre = zone || PROVINCE_CENTRE[province] || { lat: 49.89, lng: -119.50 };
  return {
    country: "CA",
    code: clean.length >= 6 ? `${fsa} ${clean.slice(3, 6)}` : fsa,
    region: province,
    place: zone?.place || province,
    lat: centre.lat, lng: centre.lng,
    in_corridor: ["BC", "AB"].includes(province),
    label: POSTAL_LABEL.CA,
  };
}

function fromZip(z: ZipHit): PostalHit {
  return {
    country: "US",
    code: z.zip,
    region: z.state,
    place: z.place,
    lat: z.lat, lng: z.lng,
    in_corridor: z.in_corridor,
    label: POSTAL_LABEL.US,
  };
}

/**
 * Work out what they typed without asking them to declare it.
 *
 * A leading letter is a Canadian postal code, all digits is a US ZIP. Guessing
 * from the shape beats a country dropdown they have to answer before the field
 * will even accept input.
 */
export function locatePostal(raw: string, hint?: string): PostalHit | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const looksCa = /^[A-Za-z]/.test(s);
  const looksUs = /^\d/.test(s);

  if (looksCa || String(hint).toUpperCase() === "CA") {
    const ca = locateCa(s);
    if (ca) return ca;
  }
  if (looksUs || String(hint).toUpperCase() === "US") {
    const z = locateZip(s);
    if (z) return fromZip(z);
  }
  // Fall back to trying both rather than refusing on a hint that was wrong.
  return locateCa(s) || (locateZip(s) ? fromZip(locateZip(s)!) : null);
}
