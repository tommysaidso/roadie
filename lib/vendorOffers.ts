// VENDOR OFFERS — a standing discount from a business on the platform.
//
// Small and separate from everything else. Advertising is the tour's mainstay
// and local vendors bid to host us; this is neither. A vendor already on the app
// decides to offer a discount, and any band or fan travelling through that area
// can claim it AT ANY TIME — not only on a ring night, not only in a town we are
// playing, and not bundled into anything anyone bought.
//
// The reason it earns its place: a touring band spends its year passing through
// towns where it knows nobody. A standing list of places that will look after
// them is worth more than a poster. For the vendor it is trade they would not
// otherwise have seen, from people already in town.
//
// SHIPPED OFF. `enabled()` is false unless ROADIE_VENDOR_TOKENS=1.

import { all, one, run } from "@/lib/db";

export type OfferScope = "city" | "region" | "anywhere";
export type OfferKind = "percent" | "amount" | "freebie";

export type VendorOffer = {
  id: number;
  business_name: string;
  city: string | null;
  region: string | null;
  scope: OfferScope;
  for_bands: number;
  for_fans: number;
  kind: OfferKind;
  value: number | null;
  currency: string;
  title: string;
  terms: string | null;
  valid_from: string | null;
  valid_to: string | null;
  max_redemptions: number | null;
  per_fan_limit: number;
  active: number;
  suspended: number;
};

/** The master switch. Everything checks this first. */
export function enabled() {
  return process.env.ROADIE_VENDOR_TOKENS === "1";
}

const LIVE = `active = 1 AND suspended = 0
  AND (valid_from IS NULL OR valid_from <= date('now'))
  AND (valid_to   IS NULL OR valid_to   >= date('now'))`;

/**
 * What is on offer where I am right now.
 *
 * Matched on the traveller's location rather than on a show, because the whole
 * point is that it works on an ordinary Tuesday when no ring is running.
 * `anywhere` offers always match; region matches the province; city matches the
 * town. Nearest and most specific first.
 */
export function offersNear(
  opts: { city?: string | null; region?: string | null; audience?: "band" | "fan" },
): VendorOffer[] {
  if (!enabled()) return [];
  const aud = opts.audience === "band" ? "for_bands = 1" : "for_fans = 1";
  return all<VendorOffer>(
    `SELECT * FROM vendor_offers
      WHERE ${LIVE} AND ${aud}
        AND ( scope = 'anywhere'
           OR (scope = 'region' AND region IS NOT NULL AND region = ?)
           OR (scope = 'city'   AND city   IS NOT NULL AND city   = ?) )
      ORDER BY CASE scope WHEN 'city' THEN 0 WHEN 'region' THEN 1 ELSE 2 END,
               business_name`,
    opts.region ?? "", opts.city ?? "",
  );
}

/** How the discount reads at a glance. */
export function describe(o: VendorOffer): string {
  if (o.kind === "percent") return `${o.value}% off`;
  if (o.kind === "amount") {
    const sym = o.currency === "USD" ? "US$" : "CA$";
    return `${sym}${((o.value || 0) / 100).toFixed(2)} off`;
  }
  return o.title;
}

/**
 * Can this traveller claim it?
 *
 * The ledger is checked rather than the client trusted: the token is shown on a
 * phone to a person behind a counter, so the only real defence against a
 * screenshot being passed around is the count on our side.
 */
export function canRedeem(offerId: number, userId: number | null): { ok: boolean; why?: string } {
  if (!enabled()) return { ok: false, why: "Offers are not switched on." };

  const o = one<VendorOffer>(`SELECT * FROM vendor_offers WHERE id = ? AND ${LIVE}`, offerId);
  if (!o) return { ok: false, why: "That offer is not available." };

  if (o.max_redemptions != null) {
    const used = one<any>(`SELECT COUNT(*) n FROM vendor_offer_redemptions WHERE offer_id = ?`, offerId)?.n ?? 0;
    if (used >= o.max_redemptions) return { ok: false, why: "That offer has been fully claimed." };
  }

  // per_fan_limit 0 means unlimited, which is the default — it is a standing
  // discount, not a coupon. A limit can only be enforced against an account, so
  // say so plainly rather than letting an anonymous claim slip past it.
  if (o.per_fan_limit > 0) {
    if (!userId) return { ok: false, why: "Sign in to claim this one." };
    const mine = one<any>(
      `SELECT COUNT(*) n FROM vendor_offer_redemptions WHERE offer_id = ? AND user_id = ?`,
      offerId, userId,
    )?.n ?? 0;
    if (mine >= o.per_fan_limit) return { ok: false, why: "You have already used this offer." };
  }

  return { ok: true };
}

/**
 * Record a claim and return the short code shown at the counter.
 *
 * The code is minted per claim, not per offer, so a photo of someone else's
 * screen is not a reusable coupon — the vendor sees a code issued to that person
 * at that moment, and it can be checked afterwards.
 */
export function redeem(
  offerId: number, userId: number | null, bandId: number | null, ip: string | null,
) {
  const check = canRedeem(offerId, userId);
  if (!check.ok) return { ok: false as const, error: check.why };

  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  run(
    `INSERT INTO vendor_offer_redemptions(offer_id, user_id, band_id, token, ip)
     VALUES(?,?,?,?,?)`,
    offerId, userId, bandId, token, ip,
  );
  return { ok: true as const, token };
}

/** What a vendor sees: their own offers and whether anyone used them. */
export function offersForBusiness(sponsorId: number) {
  return all<any>(
    `SELECT o.*,
            (SELECT COUNT(*) FROM vendor_offer_redemptions r WHERE r.offer_id = o.id) AS redemptions
       FROM vendor_offers o
      WHERE o.sponsor_id = ?
      ORDER BY o.created_at DESC`,
    sponsorId,
  );
}
