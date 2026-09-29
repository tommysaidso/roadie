import { NextRequest, NextResponse } from "next/server";
import { all, getDb, run } from "@/lib/db";
import { isElevated, requireUser, ownsBand, forbid } from "@/lib/guard";

export const dynamic = "force-dynamic";

function ensureBusinessSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY,
      band_id INTEGER,
      user_id INTEGER,
      image_data TEXT,
      vendor TEXT,
      purchased_at TEXT,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      currency TEXT DEFAULT 'CAD',
      category TEXT DEFAULT 'tour',
      notes TEXT,
      status TEXT DEFAULT 'captured',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY,
      band_id INTEGER,
      user_id INTEGER,
      receipt_id INTEGER,
      category TEXT DEFAULT 'tour',
      vendor TEXT,
      expense_date TEXT,
      amount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      currency TEXT DEFAULT 'CAD',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      band_id INTEGER,
      user_id INTEGER,
      booking_id INTEGER,
      client_name TEXT,
      client_email TEXT,
      line_items TEXT,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      currency TEXT DEFAULT 'CAD',
      status TEXT DEFAULT 'draft',
      due_date TEXT,
      issued_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  for (const table of ["receipts", "expenses", "invoices"]) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`); } catch {}
  }
}

function money(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.round(v * 100) / 100) : 0;
}

export async function GET(req: NextRequest) {
  ensureBusinessSchema();
  const g = requireUser(req);
  if (g.deny) return g.deny;
  const requestedBandId = Number(req.nextUrl.searchParams.get("band_id") || 0);
  const byBand = isElevated(g.user) && requestedBandId;
  const where = byBand ? "band_id=?" : "user_id=?";
  const scopeId = byBand ? requestedBandId : Number(g.user.id);

  const expenses = all(`SELECT * FROM expenses WHERE ${where} ORDER BY expense_date DESC, created_at DESC LIMIT 80`, scopeId);
  const receipts = all(`SELECT id,band_id,vendor,purchased_at,total,currency,category,notes,status,created_at FROM receipts WHERE ${where} ORDER BY created_at DESC LIMIT 80`, scopeId);
  const invoices = all(`SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT 80`, scopeId);
  const totals = {
    expenses: expenses.reduce((s: number, x: any) => s + Number(x.amount || 0), 0),
    tax: expenses.reduce((s: number, x: any) => s + Number(x.tax || 0), 0),
    invoiced: invoices.reduce((s: number, x: any) => s + Number(x.total || 0), 0),
    paid: invoices.filter((x: any) => x.status === "paid").reduce((s: number, x: any) => s + Number(x.total || 0), 0),
  };
  return NextResponse.json({ scope: byBand ? "band" : "account", band_id: byBand ? requestedBandId : g.user.band_id || null, totals, receipts, expenses, invoices });
}

export async function POST(req: NextRequest) {
  ensureBusinessSchema();
  const g = requireUser(req);
  if (g.deny) return g.deny;

  const body = await req.json();
  const requestedBandId = Number(body.band_id || 0);
  if (requestedBandId && !ownsBand(g.user, requestedBandId)) return forbid("You can only update books for your own account.");
  const bandId = requestedBandId || g.user.band_id || null;

  if (body.kind === "receipt") {
    const total = money(body.total);
    const tax = money(body.tax);
    const r = run(
      `INSERT INTO receipts(band_id,user_id,image_data,vendor,purchased_at,subtotal,tax,total,currency,category,notes)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      bandId,
      g.user.id,
      String(body.image_data || "").slice(0, 1_500_000),
      String(body.vendor || "Receipt").slice(0, 120),
      body.purchased_at || new Date().toISOString().slice(0, 10),
      money(body.subtotal || Math.max(0, total - tax)),
      tax,
      total,
      body.currency || "CAD",
      body.category || "tour",
      body.notes || "",
    );
    const receiptId = Number(r.lastInsertRowid);
    if (total > 0) {
      run(
        `INSERT INTO expenses(band_id,user_id,receipt_id,category,vendor,expense_date,amount,tax,currency,notes)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        bandId,
        g.user.id,
        receiptId,
        body.category || "tour",
        body.vendor || "Receipt",
        body.purchased_at || new Date().toISOString().slice(0, 10),
        total,
        tax,
        body.currency || "CAD",
        body.notes || "",
      );
    }
    return NextResponse.json({ ok: true, receipt_id: receiptId });
  }

  if (body.kind === "expense") {
    const r = run(
      `INSERT INTO expenses(band_id,user_id,category,vendor,expense_date,amount,tax,currency,notes)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      bandId,
      g.user.id,
      body.category || "tour",
      body.vendor || "",
      body.expense_date || new Date().toISOString().slice(0, 10),
      money(body.amount),
      money(body.tax),
      body.currency || "CAD",
      body.notes || "",
    );
    return NextResponse.json({ ok: true, expense_id: Number(r.lastInsertRowid) });
  }

  if (body.kind === "invoice") {
    const lineItems = Array.isArray(body.line_items) ? body.line_items : [{ description: body.description || "Performance", qty: 1, rate: money(body.total) }];
    const subtotal = lineItems.reduce((s: number, x: any) => s + money(x.qty || 1) * money(x.rate), 0);
    const tax = money(body.tax);
    const r = run(
      `INSERT INTO invoices(band_id,user_id,booking_id,client_name,client_email,line_items,subtotal,tax,total,currency,status,due_date,issued_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      bandId,
      g.user.id,
      body.booking_id || null,
      body.client_name || "",
      body.client_email || "",
      JSON.stringify(lineItems),
      subtotal,
      tax,
      money(body.total || subtotal + tax),
      body.currency || "CAD",
      body.status || "draft",
      body.due_date || null,
      body.issued_at || null,
    );
    return NextResponse.json({ ok: true, invoice_id: Number(r.lastInsertRowid) });
  }

  return NextResponse.json({ error: "Unknown business item kind." }, { status: 400 });
}
