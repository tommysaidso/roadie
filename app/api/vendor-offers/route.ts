import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, ownsSponsor, forbid, rateLimit } from "@/lib/guard";
import { one, run } from "@/lib/db";
import {
  enabled, offersNear, offersForBusiness, redeem, describe,
} from "@/lib/vendorOffers";

export const dynamic = "force-dynamic";

// VENDOR OFFERS API — standing discounts for bands and fans passing through.
//
// The whole surface is dark unless ROADIE_VENDOR_TOKENS=1, and it answers 404
// rather than 403 when off: an unshipped feature should not advertise its own
// existence to anyone probing for it.

function off() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(req: NextRequest) {
  if (!enabled()) return off();

  const u = new URL(req.url);
  const mine = u.searchParams.get("mine");

  // A vendor reviewing their own offers must be signed in and own them.
  if (mine) {
    const g = requireUser(req); if (g.deny) return g.deny;
    const sponsorId = Number(mine);
    if (!ownsSponsor(g.user, sponsorId)) return forbid("Those are not your offers.");
    return NextResponse.json({ ok: true, offers: offersForBusiness(sponsorId) });
  }

  // The traveller's view. Always scoped to a place, so this can never be used to
  // pull every deal on the platform in one call.
  const city = (u.searchParams.get("city") || "").trim();
  const region = (u.searchParams.get("region") || "").trim();
  if (!city && !region) {
    return NextResponse.json({ error: "Where are you?" }, { status: 400 });
  }

  const audience = u.searchParams.get("audience") === "band" ? "band" : "fan";
  const offers = offersNear({ city, region, audience }).map(o => ({
    id: o.id,
    business_name: o.business_name,
    city: o.city,
    title: o.title,
    discount: describe(o),
    terms: o.terms,
    scope: o.scope,
  }));
  return NextResponse.json({ ok: true, offers });
}

export async function POST(req: NextRequest) {
  if (!enabled()) return off();

  const g = requireUser(req); if (g.deny) return g.deny;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  // ---- a band or fan claims an offer ----------------------------------
  if (action === "redeem") {
    // Rate-limited: this mints a code a business will honour for money.
    const rl = rateLimit(req, `offer-redeem:${g.user.id}`, 30, 60 * 60 * 1000);
    if (rl) return rl;
    const r = redeem(
      Number(body.offer_id || 0),
      g.user.id ?? null,
      Number(g.user.band_id || 0) || null,
      req.headers.get("x-forwarded-for") || null,
    );
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, token: r.token });
  }

  // ---- a vendor sets their own discount -------------------------------
  if (action === "save") {
    const sponsorId = Number(body.sponsor_id || 0);
    if (!sponsorId) return NextResponse.json({ error: "Which business?" }, { status: 400 });
    if (!ownsSponsor(g.user, sponsorId)) return forbid("You can only set offers for your own business.");

    const title = String(body.title || "").trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "Give the offer a name." }, { status: 400 });

    const kind = ["percent", "amount", "freebie"].includes(body.kind) ? body.kind : "percent";
    let value = Number(body.value || 0);
    // A percentage over 100 is a typo, not a giveaway. Clamp rather than trust.
    if (kind === "percent") value = Math.max(0, Math.min(100, Math.round(value)));
    if (kind === "amount") value = Math.max(0, Math.round(value));

    const scope = ["city", "region", "anywhere"].includes(body.scope) ? body.scope : "city";
    // "anywhere" means every town on the platform, which is a ROADIE-wide
    // commitment rather than one business's own call.
    if (scope === "anywhere" && !isElevated(g.user)) {
      return forbid("A platform-wide offer is arranged with ROADIE, not set on your own.");
    }

    const id = Number(body.id || 0);
    if (id) {
      const owned = one<any>(`SELECT sponsor_id FROM vendor_offers WHERE id = ?`, id);
      if (!owned) return NextResponse.json({ error: "No such offer." }, { status: 404 });
      if (!ownsSponsor(g.user, owned.sponsor_id)) return forbid("That is not your offer.");
      run(
        `UPDATE vendor_offers
            SET title=?, terms=?, kind=?, value=?, scope=?, city=?, region=?,
                for_bands=?, for_fans=?, valid_from=?, valid_to=?,
                max_redemptions=?, per_fan_limit=?, active=?
          WHERE id=?`,
        title, body.terms || null, kind, value, scope,
        body.city || null, body.region || null,
        body.for_bands === false ? 0 : 1, body.for_fans === false ? 0 : 1,
        body.valid_from || null, body.valid_to || null,
        body.max_redemptions ?? null, Number(body.per_fan_limit ?? 0),
        body.active === false ? 0 : 1, id,
      );
      return NextResponse.json({ ok: true, id });
    }

    run(
      `INSERT INTO vendor_offers
         (sponsor_id, business_name, city, region, scope, for_bands, for_fans,
          kind, value, currency, title, terms, valid_from, valid_to,
          max_redemptions, per_fan_limit, active, created_by)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      sponsorId,
      String(body.business_name || "").slice(0, 120),
      body.city || null, body.region || null, scope,
      body.for_bands === false ? 0 : 1, body.for_fans === false ? 0 : 1,
      kind, value, body.currency === "USD" ? "USD" : "CAD",
      title, body.terms || null,
      body.valid_from || null, body.valid_to || null,
      body.max_redemptions ?? null, Number(body.per_fan_limit ?? 0),
      body.active === false ? 0 : 1,
      g.user.id ?? null,
    );
    return NextResponse.json({ ok: true, created: true });
  }

  // ---- ROADIE's override, if a discount ever has to be pulled ----------
  if (action === "suspend") {
    if (!isElevated(g.user)) return forbid("Only an operator can suspend an offer.");
    run(`UPDATE vendor_offers SET suspended=? WHERE id=?`,
        body.suspended ? 1 : 0, Number(body.id || 0));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
