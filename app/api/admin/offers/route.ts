import { NextRequest, NextResponse } from "next/server";
import { all, one, run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureStudioSchema, offerToken } from "@/lib/studio";
import { stripeCreateInvoice, coinbaseCreateCharge, detectCurrency, cadToUsd, billingConfigured } from "@/lib/billing";
import { smtpSend } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "sent", "negotiating", "signed", "passed"];
const TIERS = ["local", "route", "ring", "title"];

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Sponsor offers are operator-only.");
  ensureStudioSchema();

  return NextResponse.json({
    offers: all<any>(`
      SELECT o.*, s.name sponsor_current_name, s.city sponsor_city, s.contact sponsor_contact,
             p.name project_name, p.poster project_poster
        FROM sponsor_offers o
        LEFT JOIN sponsors s ON s.id=o.sponsor_id
        LEFT JOIN studio_projects p ON p.id=o.project_id
       ORDER BY CASE o.status WHEN 'negotiating' THEN 0 WHEN 'sent' THEN 1
                              WHEN 'draft' THEN 2 WHEN 'signed' THEN 3 ELSE 4 END,
                o.updated_at DESC`),
    sponsors: all<any>("SELECT id,name,kind,city,budget_monthly,contact FROM sponsors ORDER BY name"),
    projects: all<any>("SELECT id,name,poster FROM studio_projects ORDER BY updated_at DESC LIMIT 50"),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Sponsor offers are operator-only.");
  ensureStudioSchema();

  const b = await req.json().catch(() => ({}));
  const title = String(b?.title || "").trim();
  if (!title) return NextResponse.json({ error: "An offer needs a title — that's the subject line they see." }, { status: 400 });

  const status = STATUSES.includes(String(b?.status)) ? String(b.status) : "draft";
  const tier = TIERS.includes(String(b?.tier)) ? String(b.tier) : "local";
  const sponsorId = Number(b?.sponsor_id) || null;
  const sponsorName = String(
    b?.sponsor_name ||
    (sponsorId ? one<any>("SELECT name FROM sponsors WHERE id=?", sponsorId)?.name : "") || "");
  const deliverables = JSON.stringify(
    Array.isArray(b?.deliverables) ? b.deliverables.map((d: any) => String(d)).filter(Boolean) : []);
  const price = Number.isFinite(Number(b?.price)) ? Math.round(Number(b.price)) : null;

  const fields = [
    sponsorId, sponsorName, title, tier,
    String(b?.pitch || ""), deliverables, price,
    String(b?.term || ""), String(b?.in_kind || ""),
    Number(b?.project_id) || null, Number(b?.hero_gen_id) || null,
    status, String(b?.notes || ""),
  ];

  if (b?.id) {
    const id = Number(b.id);
    const prev = one<any>("SELECT * FROM sponsor_offers WHERE id=?", id);
    if (!prev) return NextResponse.json({ error: "No such offer." }, { status: 404 });
    run(`UPDATE sponsor_offers SET
           sponsor_id=?, sponsor_name=?, title=?, tier=?, pitch=?, deliverables=?, price=?,
           term=?, in_kind=?, project_id=?, hero_gen_id=?, status=?, notes=?,
           sent_at    = CASE WHEN ?='sent'   AND sent_at    IS NULL THEN datetime('now') ELSE sent_at END,
           decided_at = CASE WHEN ? IN ('signed','passed') THEN datetime('now') ELSE decided_at END,
           updated_at = datetime('now')
         WHERE id=?`, ...fields, status, status, id);

    // Auto-invoice when a deal moves to signed and has a price.
    // Fires in the background — status save completes regardless.
    if (status === "signed" && prev.status !== "signed" && price && price > 0) {
      autoInvoiceOffer(id).catch(err => console.error("[offers] Auto-invoice error:", err?.message));
    }

    return NextResponse.json({ id, saved: true });
  }

  const r = run(
    `INSERT INTO sponsor_offers
       (sponsor_id,sponsor_name,title,tier,pitch,deliverables,price,term,in_kind,
        project_id,hero_gen_id,status,notes,token,created_by)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ...fields, offerToken(), String(g.user?.email || ""));
  return NextResponse.json({ id: Number(r.lastInsertRowid), saved: true });
}

async function autoInvoiceOffer(offerId: number) {
  const offer = one<any>(`
    SELECT o.*, s.name sponsor_name, s.contact sponsor_contact, s.region sponsor_region
      FROM sponsor_offers o
      LEFT JOIN sponsors s ON s.id = o.sponsor_id
     WHERE o.id = ?`, offerId);
  if (!offer || !offer.price) return;

  const cfg = billingConfigured();
  const currency = (offer.currency || detectCurrency(offer.sponsor_region)) as "cad" | "usd";
  const amountCents = Math.round(offer.price * 100);
  const amountUsd   = currency === "usd" ? offer.price : cadToUsd(offer.price);
  const description = `ROADIE — ${offer.title}${offer.term ? ` (${offer.term})` : ""}`;
  const meta = { kind: "offer", ref_id: String(offerId) };
  const contactEmail = offer.sponsor_contact?.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? "";
  const sponsorName  = offer.sponsor_name || "Sponsor";

  let stripeUrl: string | null = null;
  let coinbaseUrl: string | null = null;
  let stripeInvoiceId: string | null = null;

  if (cfg.stripe && contactEmail) {
    try {
      const inv = await stripeCreateInvoice({
        email: contactEmail, name: sponsorName,
        description, amountCents, currency, metadata: meta,
      });
      stripeUrl = inv.paymentLink;
      stripeInvoiceId = inv.invoiceId;
    } catch (err: any) {
      console.error("[offers] Stripe invoice error:", err?.message);
    }
  }

  if (cfg.coinbase) {
    try {
      const ch = await coinbaseCreateCharge({ name: sponsorName, description, amountUsd, metadata: meta });
      coinbaseUrl = ch.hostedUrl;
    } catch (err: any) {
      console.error("[offers] Coinbase charge error:", err?.message);
    }
  }

  const paymentLink = stripeUrl ?? coinbaseUrl ?? null;
  if (paymentLink || stripeInvoiceId) {
    run("UPDATE sponsor_offers SET payment_link=?, stripe_invoice_id=?, updated_at=datetime('now') WHERE id=?",
        paymentLink, stripeInvoiceId, offerId);
  }

  if (paymentLink && contactEmail) {
    const cryptoLine = coinbaseUrl && stripeUrl
      ? `<p style="margin-top:14px;font-size:13px;">Prefer crypto? Pay in USDC, ETH, SOL or any major coin: <a href="${coinbaseUrl}">${coinbaseUrl}</a></p>`
      : "";
    await smtpSend({
      to: contactEmail,
      subject: `Invoice: ${offer.title}`,
      html: `<p>Hi ${sponsorName},</p>
<p>Your sponsorship agreement with ROADIE is now signed. Here is your invoice:</p>
<p style="margin:20px 0;"><a href="${paymentLink}" style="font-size:16px;font-weight:bold;">${paymentLink}</a></p>
<p>Amount: ${currency.toUpperCase()} $${Number(offer.price).toLocaleString()} &mdash; due within 30 days.</p>${cryptoLine}
<p>Reply to this email with any questions.</p>
<p>ROADIE Technologies Inc.</p>`,
    }).catch(err => console.error("[offers] Invoice email error:", err?.message));
  }
}

export async function DELETE(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Sponsor offers are operator-only.");
  ensureStudioSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Pass ?id=" }, { status: 400 });
  run("DELETE FROM sponsor_offers WHERE id=?", id);
  return NextResponse.json({ deleted: true });
}
