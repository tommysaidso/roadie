import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import {
  ensureTermsAckSchema, recordAck, ackState, needsAck, ackRoster,
  PLATFORM_TERMS_VERSION,
} from "@/lib/termsack";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET — does this account still need to acknowledge? (+ roster for operators) */
export async function GET(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) {
    // Signed out is not an error here — the banner just does not show.
    return NextResponse.json({ signed_in: false, version: PLATFORM_TERMS_VERSION });
  }
  ensureTermsAckSchema();

  const kind = req.nextUrl.searchParams.get("kind") || "";
  const out: any = {
    signed_in: true,
    version: PLATFORM_TERMS_VERSION,
    state: ackState(Number(g.user.id)),
    needs: needsAck(g.user, kind),
  };
  if (isElevated(g.user) && req.nextUrl.searchParams.get("roster")) {
    const rows = ackRoster();
    out.roster = rows;
    out.summary = {
      total: rows.length,
      acknowledged: rows.filter(r => r.terms_ack_at).length,
      outstanding: rows.filter(r => !r.terms_ack_at).length,
    };
  }
  return NextResponse.json(out);
}

/** POST — record it. */
export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  let b: any = {};
  try { b = await req.json(); } catch { /* empty body is fine for self-ack */ }
  ensureTermsAckSchema();

  // Operator back-fill: recording an acknowledgement someone gave off-platform.
  // Attributed to the operator who entered it and marked as a back-fill, never
  // disguised as the person having clicked it themselves.
  if (b.for_email && isElevated(g.user)) {
    const target = getDb().prepare(
      `SELECT id, email FROM users WHERE lower(email)=lower(?)`
    ).get(String(b.for_email)) as any;
    if (!target) {
      return NextResponse.json({ error: `No account for ${b.for_email}` }, { status: 404 });
    }
    const st = recordAck({
      userId: target.id, email: target.email,
      typedName: String(b.typed_name || ""),
      source: "operator_backfill",
      note: String(b.note || `back-filled by ${g.user.email}`),
    });
    return NextResponse.json({ ok: true, backfilled: target.email, state: st });
  }
  if (b.for_email) return forbid("Only an operator can record this for someone else.");

  const st = recordAck({
    userId: Number(g.user.id),
    email: String(g.user.email || ""),
    typedName: String(b.typed_name || g.user.display_name || ""),
    source: "self",
  });
  return NextResponse.json({ ok: true, state: st });
}
