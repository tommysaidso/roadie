import { NextRequest, NextResponse } from "next/server";
import { coinbaseCreateCharge, verifyCoinbaseWebhook, markPaid, cadToUsd } from "@/lib/billing";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { one, run } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET  /api/billing/coinbase?kind=offer|vendor_spot&id=N
//   → creates a Coinbase Commerce charge (USD) and returns the hosted URL
// POST /api/billing/coinbase
//   → Coinbase webhook handler (charge:confirmed)

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Billing is operator-only.");

  const sp   = new URL(req.url).searchParams;
  const kind = sp.get("kind") as "offer" | "vendor_spot";
  const id   = Number(sp.get("id"));
  if (!["offer", "vendor_spot"].includes(kind) || !id) {
    return NextResponse.json({ error: "Pass kind (offer|vendor_spot) and id." }, { status: 400 });
  }

  if (kind === "offer") {
    const offer = one<any>(
      "SELECT o.*, s.name sponsor_name FROM sponsor_offers o LEFT JOIN sponsors s ON s.id=o.sponsor_id WHERE o.id=?", id);
    if (!offer || !offer.price) {
      return NextResponse.json({ error: "Offer not found or no price set." }, { status: 404 });
    }
    const currency = (offer.currency || "cad") as "cad" | "usd";
    const amountUsd = currency === "usd" ? offer.price : cadToUsd(offer.price);
    const ch = await coinbaseCreateCharge({
      name: offer.sponsor_name || "ROADIE sponsor",
      description: offer.title,
      amountUsd,
      metadata: { kind: "offer", ref_id: String(id) },
    });
    run("UPDATE sponsor_offers SET payment_link=COALESCE(payment_link,?), updated_at=datetime('now') WHERE id=?",
        ch.hostedUrl, id);
    return NextResponse.json({ hostedUrl: ch.hostedUrl, chargeId: ch.chargeId });
  }

  // vendor_spot
  const spot = one<any>("SELECT * FROM vendor_spots WHERE id=?", id);
  if (!spot || !spot.fee) {
    return NextResponse.json({ error: "Vendor spot not found or no fee set." }, { status: 404 });
  }
  const ch = await coinbaseCreateCharge({
    name: spot.vendor_name,
    description: `ROADIE vendor spot (${spot.kind || "vendor"})`,
    amountUsd: cadToUsd(spot.fee),
    metadata: { kind: "vendor_spot", ref_id: String(id) },
  });
  run("UPDATE vendor_spots SET payment_link=COALESCE(payment_link,?) WHERE id=?", ch.hostedUrl, id);
  return NextResponse.json({ hostedUrl: ch.hostedUrl, chargeId: ch.chargeId });
}

export async function POST(req: NextRequest) {
  const sig     = req.headers.get("x-cc-webhook-signature") ?? "";
  const payload = await req.text();

  let event: any;
  try {
    event = verifyCoinbaseWebhook(payload, sig);
  } catch (err: any) {
    console.error("[billing/coinbase] Webhook verification failed:", err?.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const type: string = event?.event?.type ?? "";
  if (type === "charge:confirmed") {
    const charge = event.event.data;
    const { kind, ref_id } = charge?.metadata ?? {};
    if (kind && ref_id) {
      markPaid(kind as "offer" | "vendor_spot", Number(ref_id), charge.id);
    }
  }

  return NextResponse.json({ received: true });
}
