import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook, markPaid } from "@/lib/billing";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

// Stripe sends the raw body — we must read it as text before JSON parsing
// so signature verification works on exactly what was received.
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const payload = await req.text();

  let event: any;
  try {
    event = verifyStripeWebhook(payload, sig);
  } catch (err: any) {
    console.error("[billing/webhook] Stripe verification failed:", err?.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const type: string = event?.type ?? "";
  const obj: any = event?.data?.object ?? {};

  if (type === "invoice.paid") {
    const { kind, ref_id } = obj.metadata ?? {};
    if (kind && ref_id) {
      markPaid(kind as "offer" | "vendor_spot", Number(ref_id), obj.id);
    }
  }

  if (type === "invoice.payment_failed") {
    const { kind, ref_id } = obj.metadata ?? {};
    if (kind && ref_id) {
      try {
        run(`INSERT INTO billing_payments (kind, ref_id, stripe_invoice_id, status)
             VALUES (?, ?, ?, 'failed')`, kind, Number(ref_id), obj.id);
      } catch { /* ignore duplicate */ }
    }
  }

  // invoice.voided — keep the stripe_invoice_id reference but don't mark paid
  return NextResponse.json({ received: true });
}
