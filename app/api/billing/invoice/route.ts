import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { one, run } from "@/lib/db";
import {
  stripeCreateInvoice, coinbaseCreateCharge,
  detectCurrency, cadToUsd, billingConfigured,
} from "@/lib/billing";
import { smtpSend } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Extract the first email address from a free-text contact string.
function emailFrom(contact: string | null | undefined): string {
  return contact?.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? "";
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Billing is operator-only.");

  const b = await req.json().catch(() => ({}));
  const kind = String(b?.kind ?? "") as "offer" | "vendor_spot";
  const id   = Number(b?.id);
  if (!["offer", "vendor_spot"].includes(kind) || !id) {
    return NextResponse.json({ error: "Pass kind (offer|vendor_spot) and id." }, { status: 400 });
  }

  const cfg = billingConfigured();

  // ── Sponsor offer ──────────────────────────────────────────────────────────
  if (kind === "offer") {
    const offer = one<any>(`
      SELECT o.*, s.name sponsor_name, s.contact sponsor_contact,
             s.city sponsor_city, s.region sponsor_region
        FROM sponsor_offers o
        LEFT JOIN sponsors s ON s.id = o.sponsor_id
       WHERE o.id = ?`, id);
    if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    if (!offer.price || offer.price <= 0) {
      return NextResponse.json({ error: "Set a price on this offer before generating an invoice." }, { status: 400 });
    }

    const currency = (offer.currency || detectCurrency(offer.sponsor_region)) as "cad" | "usd";
    const amountCents = Math.round(offer.price * 100);
    const amountUsd   = currency === "usd" ? offer.price : cadToUsd(offer.price);
    const contactEmail = emailFrom(offer.sponsor_contact);
    const sponsorName  = offer.sponsor_name || offer.sponsor_current_name || "Sponsor";
    const description  = `ROADIE — ${offer.title}${offer.term ? ` (${offer.term})` : ""}`;
    const meta = { kind: "offer", ref_id: String(id) };

    let stripeInvoiceId: string | null = null;
    let stripeUrl: string | null = null;
    let coinbaseUrl: string | null = null;

    if (cfg.stripe && contactEmail) {
      try {
        const inv = await stripeCreateInvoice({
          email: contactEmail, name: sponsorName,
          description, amountCents, currency, metadata: meta,
        });
        stripeInvoiceId = inv.invoiceId;
        stripeUrl       = inv.paymentLink;
      } catch (err: any) {
        console.error("[billing] Stripe invoice error:", err?.message);
      }
    }

    if (cfg.coinbase) {
      try {
        const ch = await coinbaseCreateCharge({ name: sponsorName, description, amountUsd, metadata: meta });
        coinbaseUrl = ch.hostedUrl;
      } catch (err: any) {
        console.error("[billing] Coinbase charge error:", err?.message);
      }
    }

    const paymentLink = stripeUrl ?? coinbaseUrl ?? null;
    run(`UPDATE sponsor_offers
         SET payment_link=?, stripe_invoice_id=?, updated_at=datetime('now')
         WHERE id=?`, paymentLink, stripeInvoiceId, id);

    if (paymentLink && contactEmail) {
      const cryptoLine = coinbaseUrl && stripeUrl
        ? `<p style="margin-top:14px;font-size:13px;">Prefer crypto? Pay in USDC, ETH, SOL or any major coin: <a href="${coinbaseUrl}">${coinbaseUrl}</a></p>`
        : "";
      try {
        await smtpSend({
          to: contactEmail,
          subject: `Invoice: ${offer.title}`,
          html: `<p>Hi ${sponsorName},</p>
<p>Your sponsorship agreement with ROADIE is confirmed. Here is your invoice:</p>
<p style="margin:20px 0;"><a href="${paymentLink}" style="font-size:16px;font-weight:bold;">${paymentLink}</a></p>
<p>Amount: ${currency.toUpperCase()} $${Number(offer.price).toLocaleString()} &mdash; due within 30 days.</p>${cryptoLine}
<p>Reply to this email with any questions.</p>
<p>ROADIE Technologies Inc.</p>`,
        });
      } catch (err: any) {
        console.error("[billing] Invoice email error:", err?.message);
      }
    }

    return NextResponse.json({ ok: true, paymentLink, coinbaseUrl, stripeInvoiceId, contactEmail });
  }

  // ── Vendor spot ────────────────────────────────────────────────────────────
  const spot = one<any>("SELECT * FROM vendor_spots WHERE id=?", id);
  if (!spot) return NextResponse.json({ error: "Vendor spot not found." }, { status: 404 });
  if (!spot.fee || spot.fee <= 0) {
    return NextResponse.json({ error: "Set a fee on this vendor spot before generating an invoice." }, { status: 400 });
  }

  const amountCents  = Math.round(spot.fee * 100);
  const amountUsd    = cadToUsd(spot.fee);
  const contactEmail = emailFrom(spot.contact);
  const description  = `ROADIE vendor spot — ${spot.vendor_name}${spot.kind ? ` (${spot.kind})` : ""}`;
  const meta = { kind: "vendor_spot", ref_id: String(id) };

  let stripeInvoiceId: string | null = null;
  let stripeUrl: string | null = null;
  let coinbaseUrl: string | null = null;

  if (cfg.stripe && contactEmail) {
    try {
      const inv = await stripeCreateInvoice({
        email: contactEmail, name: spot.vendor_name,
        description, amountCents, currency: "cad", metadata: meta,
      });
      stripeInvoiceId = inv.invoiceId;
      stripeUrl       = inv.paymentLink;
      run("UPDATE vendor_spots SET stripe_invoice_id=? WHERE id=?", inv.invoiceId, id);
    } catch (err: any) {
      console.error("[billing] Stripe vendor spot error:", err?.message);
    }
  }

  if (cfg.coinbase) {
    try {
      const ch = await coinbaseCreateCharge({ name: spot.vendor_name, description, amountUsd, metadata: meta });
      coinbaseUrl = ch.hostedUrl;
    } catch (err: any) {
      console.error("[billing] Coinbase vendor spot error:", err?.message);
    }
  }

  const paymentLink = stripeUrl ?? coinbaseUrl ?? null;
  if (paymentLink) run("UPDATE vendor_spots SET payment_link=? WHERE id=?", paymentLink, id);

  if (paymentLink && contactEmail) {
    try {
      await smtpSend({
        to: contactEmail,
        subject: `ROADIE vendor spot — secure your spot`,
        html: `<p>Hi ${spot.vendor_name},</p>
<p>Your vendor spot at the ROADIE ring is confirmed. Complete your booking with payment:</p>
<p style="margin:20px 0;"><a href="${paymentLink}" style="font-size:16px;font-weight:bold;">${paymentLink}</a></p>
<p>Amount: CAD $${Number(spot.fee).toLocaleString()} &mdash; due within 30 days.</p>
<p>ROADIE Technologies Inc.</p>`,
      });
    } catch (err: any) {
      console.error("[billing] Vendor spot email error:", err?.message);
    }
  }

  return NextResponse.json({ ok: true, paymentLink, coinbaseUrl, stripeInvoiceId, contactEmail });
}
