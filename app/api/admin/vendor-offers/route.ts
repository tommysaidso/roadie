import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { all, one, run } from "@/lib/db";

export const dynamic = "force-dynamic";

// ADMIN VIEW of vendor offers.
//
// Deliberately NOT gated on ROADIE_VENDOR_TOKENS. The public API is dark while
// the feature is off, but an operator has to be able to set the offers up before
// the switch is thrown — otherwise turning it on means an empty platform and a
// scramble. Nothing here is reachable without an operator account.

function guard(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return { deny: g.deny };
  if (!isElevated(g.user)) return { deny: forbid("Vendor offers are operator-only.") };
  return { user: g.user };
}

export async function GET(req: NextRequest) {
  const g = guard(req); if (g.deny) return g.deny;
  const offers = all<any>(
    `SELECT o.*,
            (SELECT COUNT(*) FROM vendor_offer_redemptions r WHERE r.offer_id = o.id) AS redemptions
       FROM vendor_offers o
      ORDER BY o.suspended, o.active DESC, o.business_name`,
  );
  return NextResponse.json({ ok: true, offers, enabled: process.env.ROADIE_VENDOR_TOKENS === "1" });
}

export async function POST(req: NextRequest) {
  const g = guard(req); if (g.deny) return g.deny;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "suspend") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ error: "Which offer?" }, { status: 400 });
    run(`UPDATE vendor_offers SET suspended=? WHERE id=?`, body.suspended ? 1 : 0, id);
    return NextResponse.json({ ok: true });
  }

  if (action === "save") {
    const business = String(body.business_name || "").trim().slice(0, 120);
    const title = String(body.title || "").trim().slice(0, 120);
    if (!business) return NextResponse.json({ error: "Which business is giving the discount?" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Give the offer a name a fan would understand." }, { status: 400 });

    const kind = ["percent", "amount", "freebie"].includes(body.kind) ? body.kind : "percent";
    let value = Number(body.value || 0);
    // A percentage over 100 is a typo, not a giveaway.
    if (kind === "percent") value = Math.max(0, Math.min(100, Math.round(value)));
    else if (kind === "amount") value = Math.max(0, Math.round(value));
    else value = 0;

    const scope = ["city", "region", "anywhere"].includes(body.scope) ? body.scope : "city";
    // A city-scoped offer with no city can never be found by anyone.
    if (scope === "city" && !String(body.city || "").trim()) {
      return NextResponse.json({ error: "A town-only offer needs a town." }, { status: 400 });
    }
    if (scope === "region" && !String(body.region || "").trim()) {
      return NextResponse.json({ error: "A province-wide offer needs a province." }, { status: 400 });
    }
    // Nobody can claim an offer aimed at nobody.
    if (!body.for_bands && !body.for_fans) {
      return NextResponse.json({ error: "Pick bands, fans, or both." }, { status: 400 });
    }

    const fields = [
      business, body.city || null, body.region || null, scope,
      body.for_bands ? 1 : 0, body.for_fans ? 1 : 0,
      kind, value, body.currency === "USD" ? "USD" : "CAD",
      title, body.terms || null,
      body.valid_from || null, body.valid_to || null,
      body.max_redemptions ?? null, Number(body.per_fan_limit ?? 0),
      body.active ? 1 : 0,
    ];

    const id = Number(body.id || 0);
    if (id) {
      if (!one<any>(`SELECT id FROM vendor_offers WHERE id=?`, id)) {
        return NextResponse.json({ error: "No such offer." }, { status: 404 });
      }
      run(
        `UPDATE vendor_offers
            SET business_name=?, city=?, region=?, scope=?, for_bands=?, for_fans=?,
                kind=?, value=?, currency=?, title=?, terms=?,
                valid_from=?, valid_to=?, max_redemptions=?, per_fan_limit=?, active=?
          WHERE id=?`,
        ...fields, id,
      );
      return NextResponse.json({ ok: true, id });
    }

    run(
      `INSERT INTO vendor_offers
         (business_name, city, region, scope, for_bands, for_fans,
          kind, value, currency, title, terms, valid_from, valid_to,
          max_redemptions, per_fan_limit, active, sponsor_id, created_by)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...fields, Number(body.sponsor_id || 0) || null, g.user.id ?? null,
    );
    return NextResponse.json({ ok: true, created: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
