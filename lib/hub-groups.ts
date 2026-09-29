// Country grouping for hub pickers.
//
// Deliberately NO database import. lib/hubs.ts pulls in better-sqlite3, and the
// moment a client component imports from there Next tries to bundle node's `fs`
// for the browser and the build dies. These are pure functions over rows the
// caller already has, so both sides can use them.
//
// Canada and the USA are separate lists, never one flat dropdown. Two reasons,
// and the second matters more:
//
//   1. Scale — six US hubs today and the corridor keeps growing. Mixed in, the
//      Canadian rings get lost inside them.
//   2. The rules genuinely differ. Work permits, withholding and gear carnets
//      all change at the line. A picker implying the two are interchangeable is
//      telling a band something untrue about their tour.

export const COUNTRY_LABEL: Record<string, string> = { CA: "Canada", US: "USA", MX: "Mexico" };

/** Home country first, then the rest. */
export const COUNTRY_ORDER = ["CA", "US", "MX"];

export function countryOf(h: any) {
  return String(h?.country || "CA").toUpperCase();
}

/**
 * A label that can't be misread.
 *
 * "SoCal Mountains Hub · CA" reads as Canada when CA is California, so any
 * non-Canadian hub spells out its country.
 */
export function hubLabel(h: any): string {
  const country = countryOf(h);
  const prov = String(h?.province || "").toUpperCase();
  const place = country === "CA" ? prov : `${prov}, ${COUNTRY_LABEL[country] || country}`;
  return `${h?.name}${place ? ` · ${place}` : ""}${h?.live === 0 ? " (not live)" : ""}`;
}

/** Hubs bucketed by country, in COUNTRY_ORDER. */
export function hubsByCountry(hubs: any[]) {
  const groups: { country: string; label: string; hubs: any[] }[] = [];
  for (const c of COUNTRY_ORDER) {
    const list = (hubs || []).filter(h => countryOf(h) === c);
    if (list.length) groups.push({ country: c, label: COUNTRY_LABEL[c] || c, hubs: list });
  }
  // An unexpected country still has to appear somewhere rather than vanish.
  const known = new Set(COUNTRY_ORDER);
  const rest = (hubs || []).filter(h => !known.has(countryOf(h)));
  if (rest.length) groups.push({ country: "OTHER", label: "Elsewhere", hubs: rest });
  return groups;
}

export function isUsHub(h: any) {
  return countryOf(h) === "US";
}
