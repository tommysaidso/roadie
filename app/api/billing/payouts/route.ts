import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { all, one, run } from "@/lib/db";
import { cadToUsd } from "@/lib/billing";

export const dynamic = "force-dynamic";

// GET  /api/billing/payouts?route_id=N  — list payout summaries for settled bookings
// POST /api/billing/payouts             — mark a payout as sent

const BAND_SPLIT  = 0.60;   // 60% of guarantee
const HOST_SPLIT  = 0.25;   // 25% to host/venue
const ROADIE_TAKE = 0.15;   // 15% to ROADIE

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Payouts are operator-only.");

  const sp       = new URL(req.url).searchParams;
  const routeId  = Number(sp.get("route_id")) || null;
  const statusIn = sp.get("status") || "settled";  // settled | all

  const where = [
    statusIn === "all" ? "1=1" : `b.status = 'settled'`,
    routeId ? `s.route_id = ${routeId}` : "1=1",
  ].join(" AND ");

  const rows = all<any>(`
    SELECT
      b.id booking_id,
      b.guarantee,
      b.status booking_status,
      b.date,
      ba.id band_id,
      ba.name band_name,
      ba.payout_method,
      ba.payout_wallet,
      ba.payout_coin,
      s.city stop_city,
      s.region stop_region,
      bp.id payout_id,
      bp.paid_at payout_paid_at,
      bp.status payout_status
    FROM bookings b
    JOIN bands ba ON ba.id = b.band_id
    LEFT JOIN stops s ON s.id = b.stop_id
    LEFT JOIN band_payouts bp ON bp.booking_id = b.id
    WHERE ${where}
    ORDER BY b.date DESC
  `);

  const summary = rows.map(r => {
    const guarantee   = Number(r.guarantee || 0);
    const bandOwed    = Math.round(guarantee * BAND_SPLIT);
    const hostOwed    = Math.round(guarantee * HOST_SPLIT);
    const roadieOwed  = Math.round(guarantee * ROADIE_TAKE);
    const bandOwedUsd = cadToUsd(bandOwed);

    return {
      booking_id:    r.booking_id,
      date:          r.date,
      stop:          r.stop_city ? `${r.stop_city}, ${r.stop_region}` : null,
      band_id:       r.band_id,
      band_name:     r.band_name,
      guarantee_cad: guarantee,
      band_owed_cad: bandOwed,
      band_owed_usd: bandOwedUsd,
      host_owed_cad: hostOwed,
      roadie_cad:    roadieOwed,
      payout_method: r.payout_method || "etransfer",
      payout_wallet: r.payout_wallet || null,
      payout_coin:   r.payout_coin   || null,
      payout_id:     r.payout_id     || null,
      payout_paid:   !!r.payout_paid_at,
      payout_paid_at: r.payout_paid_at || null,
    };
  });

  const totalOwed = summary.filter(r => !r.payout_paid)
    .reduce((acc, r) => acc + r.band_owed_cad, 0);

  return NextResponse.json({ payouts: summary, total_owed_cad: totalOwed });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Payouts are operator-only.");

  const b = await req.json().catch(() => ({}));
  const bookingId = Number(b?.booking_id);
  const method    = String(b?.method || "");
  const ref       = String(b?.ref    || "");  // tx hash, e-transfer ref, cheque #, etc.

  if (!bookingId) return NextResponse.json({ error: "Pass booking_id." }, { status: 400 });

  const booking = one<any>("SELECT * FROM bookings WHERE id=?", bookingId);
  if (!booking)  return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  // Ensure the band_payouts table exists (created here since it's a billing concern).
  try {
    const db = (await import("@/lib/db")).getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS band_payouts (
      id INTEGER PRIMARY KEY,
      booking_id INTEGER UNIQUE REFERENCES bookings(id),
      method TEXT,
      ref TEXT,
      amount_cad INTEGER,
      paid_at TEXT DEFAULT (datetime('now')),
      paid_by TEXT
    )`);
  } catch { /* already exists */ }

  const guarantee  = Number(booking.guarantee || 0);
  const amountCad  = Math.round(guarantee * BAND_SPLIT);

  run(`INSERT INTO band_payouts (booking_id, method, ref, amount_cad, paid_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(booking_id) DO UPDATE SET method=excluded.method, ref=excluded.ref,
         amount_cad=excluded.amount_cad, paid_at=datetime('now'), paid_by=excluded.paid_by`,
      bookingId, method, ref, amountCad, g.user.email);

  return NextResponse.json({ ok: true, booking_id: bookingId, amount_cad: amountCad });
}
