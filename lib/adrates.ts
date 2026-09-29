// CORPORATE ADVERTISING RATE CARD — the bread that pays for the tours.
//
// This is the top of the advertising line described in lib/advertising.ts. The
// products there say WHAT a buyer gets; this says WHAT IT COSTS. It is kept in
// its own file because rates are Ben's call and change on his word, not on a
// refactor.
//
// THE MODEL, IN ONE LINE: everything derives from one number — 25,000 a town —
// and the bundles are priced modestly below the sum of their parts.
//
// SAME NUMBER, DIFFERENT CURRENCY. A town costs 25,000 in Canada and 25,000 in
// the United States — CAD there, USD here, and we do not convert between them. This is deliberate and it is not laziness:
//
//   - A US advertiser buying US markets is quoted in the currency of the
//     budget they hold. Nobody has to do FX in their head in a meeting.
//   - We never carry the exchange risk between quoting and invoicing.
//   - The rate card reads identically in both territories, so one deck works
//     on both sides of the border.
//
// The consequence, stated honestly so nobody is surprised: the two prices are
// not equal in value. A US ring is worth more in absolute money than a Canadian
// one at any normal exchange rate. That is the intended trade — simplicity and
// a clean local quote, in exchange for not squeezing FX out of the deal.

export type Territory = "CA" | "US";

export type AdRate = {
  key: "ring" | "network";
  label: string;
  amount: number;
  period: string;
  scope: string;
  includes: string[];
  note: string;
};

/** Currency follows the territory the advertising runs in, not the seller. */
export function currencyFor(territory: Territory): "CAD" | "USD" {
  return territory === "US" ? "USD" : "CAD";
}

/**
 * The numbers. Same numerals in both territories — see the header.
 *
 * `network` is a FLAT price, not a ring count multiplied out, so it stays
 * correct whether the network is five corridors or eight and adding one never
 * quietly raises a price somebody already signed.
 */
export const TOWN_RATE = 25_000;      // one town: a produced, owned commercial
export const RING_RATE = 150_000;     // one corridor, both seasons (~6 filmed towns)
export const NETWORK_RATE = 1_000_000; // all 48 towns, both seasons

/**
 * THE LADDER IS DERIVED FROM ONE NUMBER: 25,000 a town.
 *
 *   town      25,000
 *   ring     150,000   = 6 towns, priced flat
 *   network  1,000,000 = 48 towns (1,200,000 piecemeal), about 17% off
 *
 * The bundle discount is deliberately modest. A steeper one makes the ring price
 * meaningless — nobody buys a corridor at 150,000 if the whole network is barely
 * more — and that is exactly the trap an earlier draft of this card fell into.
 * If the town price moves, move all three together and re-check the spread.
 */
export const TOWNS_PER_RING = 6;      // filmed towns per corridor across two seasons
export const NETWORK_TOWNS = 48;      // the whole run

/**
 * What the network bundle saves against buying rings one at a time.
 * Returns null when there are too few rings for the bundle to be a discount —
 * which is a real case worth catching rather than printing a negative saving.
 */
export function networkSaving(ringCount: number) {
  const piecemeal = ringCount * RING_RATE;
  const saving = piecemeal - NETWORK_RATE;
  if (saving <= 0) return null;
  return { piecemeal, saving, pct: Math.round((saving / piecemeal) * 100) };
}

export function money(amount: number, territory: Territory) {
  const cur = currencyFor(territory);
  const sym = cur === "USD" ? "US$" : "CA$";
  return `${sym}${amount.toLocaleString("en-CA")}`;
}

/**
 * The rate card for a territory.
 *
 * `ringCount` comes from the database rather than a constant, so the card can
 * never advertise rings we do not run.
 */
export function rateCard(territory: Territory, ringCount: number): AdRate[] {
  const saving = networkSaving(ringCount);
  return [
    {
      key: "ring",
      label: "One ring",
      amount: RING_RATE,
      period: "per ring, both seasons",
      scope: "Every filmed town on one corridor across both seasons — about six towns, not one market at a time.",
      includes: [
        "A produced commercial in every town on the ring, masters yours to keep",
        "Category exclusivity on that corridor for the whole run",
        "Name and credit at every stop on the ring",
        "Per-stop reporting on the live ROI board",
        "Fan offer tokens across the ring — set your own discount, honoured at every stop",
      ],
      note: "The natural first buy. One corridor, both seasons, one number.",
    },
    {
      key: "network",
      label: "The whole network",
      amount: NETWORK_RATE,
      period: "both seasons",
      scope: `Every ring we run in ${territory === "US" ? "the United States" : "Canada"}.`,
      includes: [
        "Everything in a ring buy, on every ring",
        "Category exclusivity across the entire network",
        "The message carried as the spine of the run",
        "Fan offer tokens network-wide — one discount, honoured in every town we run",
        "First refusal on any ring added mid-season, at no extra cost",
      ],
      note: saving
        ? `${money(saving.piecemeal, territory)} of rings for ${money(NETWORK_RATE, territory)} — ` +
          `${money(saving.saving, territory)} below buying them separately, about ${saving.pct}% off.`
        : "A flat price for the whole network, whatever it grows to this season.",
    },
  ];
}
