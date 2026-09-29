// Stripe and Coinbase Commerce via fetch — no npm package needed.
// lib/ is bind-mounted into the container; packages are not. Same constraint
// that led to the hand-rolled SMTP mailer.
//
// STRIPE KEY: the key uses rk_live_ prefix (Restricted Key). For invoices to
// work, the key needs Customers+InvoiceItems+Invoices write permissions.
// Expand them in Stripe Dashboard → API keys → Restricted key → Edit.

import crypto from "node:crypto";
import { run } from "./db";

export function billingConfigured() {
  return {
    stripe: !!process.env.STRIPE_SECRET_KEY,
    coinbase: !!process.env.COINBASE_COMMERCE_API_KEY,
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    coinbaseWebhook: !!process.env.COINBASE_COMMERCE_WEBHOOK_SECRET,
  };
}

// CAD for Canadian regions/countries, USD for US.
export function detectCurrency(countryOrRegion?: string | null): "cad" | "usd" {
  if (!countryOrRegion) return "cad";
  const v = countryOrRegion.toUpperCase();
  const usValues = new Set(["US", "USA", "WA", "OR", "ID", "MT", "ND", "SD", "MN", "WI", "MI", "NY", "VT", "NH", "ME", "AK"]);
  return usValues.has(v) ? "usd" : "cad";
}

// USD/CAD rate for crypto charges — update ROADIE_USD_PER_CAD in .env periodically.
export function cadToUsd(cad: number): number {
  const rate = Number(process.env.ROADIE_USD_PER_CAD || 0.74);
  return Math.round(cad * rate * 100) / 100;
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

function stripeKey() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY not configured");
  return k;
}

// Stripe REST API uses form-encoding with bracket notation for nested objects.
function flattenForm(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenForm(v as Record<string, unknown>, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

async function stripeReq(method: string, path: string, body?: Record<string, unknown>) {
  const encoded = body
    ? Object.entries(flattenForm(body))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(encoded ? { body: encoded } : {}),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data?.error as any)?.message ?? res.status;
    throw new Error(`Stripe ${method} ${path}: ${msg}`);
  }
  return data;
}

async function stripeFindOrCreateCustomer(email: string, name: string, meta: Record<string, string>) {
  const list = await stripeReq("GET", `/customers?email=${encodeURIComponent(email)}&limit=1`);
  const existing = (list.data as unknown[]);
  if (existing?.length) return existing[0] as { id: string };
  return stripeReq("POST", "/customers", { email, name, metadata: meta }) as Promise<{ id: string }>;
}

export async function stripeCreateInvoice(opts: {
  email: string;
  name: string;
  description: string;
  amountCents: number;      // integer cents in the given currency
  currency: "cad" | "usd";
  metadata: Record<string, string>;
  daysUntilDue?: number;
}) {
  const customer = await stripeFindOrCreateCustomer(opts.email, opts.name, opts.metadata);

  await stripeReq("POST", "/invoiceitems", {
    customer: customer.id,
    amount: opts.amountCents,
    currency: opts.currency,
    description: opts.description,
  });

  const inv = await stripeReq("POST", "/invoices", {
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: opts.daysUntilDue ?? 30,
    metadata: opts.metadata,
  }) as { id: string };

  const finalized = await stripeReq("POST", `/invoices/${inv.id}/finalize`, {}) as {
    id: string;
    hosted_invoice_url: string;
  };

  return { invoiceId: finalized.id, paymentLink: finalized.hosted_invoice_url };
}

export function verifyStripeWebhook(payload: string, sigHeader: string): unknown {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  const parts: Record<string, string[]> = {};
  for (const seg of sigHeader.split(",")) {
    const eq = seg.indexOf("=");
    const k = seg.slice(0, eq), v = seg.slice(eq + 1);
    (parts[k] ??= []).push(v);
  }
  const ts = parts.t?.[0];
  const sigs = parts.v1 ?? [];
  if (!ts || !sigs.length) throw new Error("Invalid Stripe-Signature header");
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) throw new Error("Stripe event timestamp too old");
  const expected = crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  const valid = sigs.some(s => {
    try { return crypto.timingSafeEqual(Buffer.from(s, "hex"), Buffer.from(expected, "hex")); }
    catch { return false; }
  });
  if (!valid) throw new Error("Stripe signature mismatch");
  return JSON.parse(payload);
}

// ─── Coinbase Commerce (any crypto, USD pricing) ────────────────────────────

function cbKey() {
  const k = process.env.COINBASE_COMMERCE_API_KEY;
  if (!k) throw new Error("COINBASE_COMMERCE_API_KEY not configured");
  return k;
}

export async function coinbaseCreateCharge(opts: {
  name: string;
  description: string;
  amountUsd: number;
  metadata: Record<string, string>;
}) {
  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": cbKey(),
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: opts.name,
      description: opts.description,
      pricing_type: "fixed_price",
      local_price: { amount: opts.amountUsd.toFixed(2), currency: "USD" },
      metadata: opts.metadata,
    }),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`Coinbase: ${data?.error?.message ?? res.status}`);
  return { chargeId: data.data.id as string, hostedUrl: data.data.hosted_url as string };
}

export function verifyCoinbaseWebhook(payload: string, sig: string): unknown {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret) throw new Error("COINBASE_COMMERCE_WEBHOOK_SECRET not configured");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  let valid = false;
  try { valid = crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")); }
  catch { /* length mismatch — stays false */ }
  if (!valid) throw new Error("Coinbase signature mismatch");
  return JSON.parse(payload);
}

// ─── Shared: mark a deal paid (called from both webhook handlers) ────────────

export function markPaid(kind: "offer" | "vendor_spot", refId: number, invoiceId: string) {
  if (kind === "offer") {
    run("UPDATE sponsor_offers SET paid_at=datetime('now'), stripe_invoice_id=? WHERE id=? AND paid_at IS NULL",
        invoiceId, refId);
  } else {
    run("UPDATE vendor_spots SET status='paid', stripe_invoice_id=? WHERE id=?", invoiceId, refId);
  }
  try {
    run(`INSERT INTO billing_payments (kind, ref_id, stripe_invoice_id, status, paid_at)
         VALUES (?, ?, ?, 'paid', datetime('now'))`, kind, refId, invoiceId);
  } catch { /* billing_payments table created at startup — safe to ignore on first boot */ }
}
