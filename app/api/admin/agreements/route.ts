import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import {
  ensureAgreementSchema, agreementsForRoute, feedbackForRoute,
  openAgreement, seedMemberAcks, markSent, acknowledge, decline,
  RING_TERMS_VERSION,
} from "@/lib/agreements";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Operator view of ring paperwork.
 *
 * Answers one question: which bands on this ring are good to go, and who is
 * holding it up. Deliberately does NOT execute anything — `acknowledged` means
 * the band and every member have read the terms and intend to proceed. The
 * contract itself is signed on paper after legal review.
 */
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Operator only.");

  ensureAgreementSchema();
  const routeId = Number(req.nextUrl.searchParams.get("route_id") || 0);
  if (!routeId) return NextResponse.json({ error: "route_id required" }, { status: 400 });

  const db = getDb();
  const route = db.prepare(`SELECT id, name, season FROM routes WHERE id=?`).get(routeId) as any;
  const agreements = agreementsForRoute(routeId);

  // Bands committed to a stop on this ring that have no agreement record at
  // all — the gap that actually bites, because they look booked and are not
  // papered.
  const missing = db.prepare(
    `SELECT DISTINCT b.id, b.name
       FROM bookings bk
       JOIN stops s ON s.id = bk.stop_id
       JOIN bands b ON b.id = bk.band_id
      WHERE s.route_id = ?
        AND b.id NOT IN (SELECT band_id FROM ring_agreements WHERE route_id = ?)`
  ).all(routeId, routeId) as any[];

  return NextResponse.json({
    route,
    version: RING_TERMS_VERSION,
    agreements,
    missing,
    feedback: feedbackForRoute(routeId),
    summary: {
      total: agreements.length,
      good_to_go: agreements.filter((a: any) => a.good_to_go).length,
      awaiting: agreements.filter((a: any) => !a.good_to_go && a.status !== "declined").length,
      declined: agreements.filter((a: any) => a.status === "declined").length,
      stale_version: agreements.filter((a: any) => a.stale_version).length,
      unpapered_bands: missing.length,
    },
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Operator only.");

  let b: any = {};
  try { b = await req.json(); } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  ensureAgreementSchema();

  try {
    switch (String(b.action)) {
      case "open": {
        const a = openAgreement(Number(b.route_id), Number(b.band_id),
                                String(b.band_name || ""), String(g.user.email || ""));
        const n = seedMemberAcks(a.id, Number(b.band_id));
        return NextResponse.json({ ok: true, agreement: a, members_seeded: n });
      }
      case "sent":
        markSent(Number(b.agreement_id));
        return NextResponse.json({ ok: true });
      case "acknowledge": {
        // Operator recording a confirmation received off-platform (a phone call,
        // an email). Attributed and dated, not a signature.
        const r = acknowledge(Number(b.agreement_id), String(b.email || ""),
                              String(b.note || `recorded by ${g.user.email}`));
        return NextResponse.json({ ok: true, progress: r });
      }
      case "decline":
        decline(Number(b.agreement_id), String(b.why || ""));
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
