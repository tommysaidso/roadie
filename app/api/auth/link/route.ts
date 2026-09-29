import { NextRequest, NextResponse } from "next/server";
import { userForToken, linkProfile, SESSION_COOKIE } from "@/lib/auth";
import { isElevated } from "@/lib/guard";
import { one, run } from "@/lib/db";
import { startTrial } from "@/lib/participation";
import { ensureHotelSchema } from "@/lib/hotels";
export const dynamic = "force-dynamic";

// Claim/link a profile record (band | venue | sponsor) to the signed-in user.
// SECURITY: a record can only be claimed if it is currently UNCLAIMED
// (its user_id is null AND no other user already points to it). Elevated
// roles (admin/operator) may reassign freely. This closes the hijack where
// any signed-in user could link ANY recordId to their own account.
const TABLES: Record<string, { table: string; col: string }> = {
  band:    { table: "bands",    col: "band_id" },
  venue:   { table: "venues",   col: "venue_id" },
  sponsor: { table: "sponsors", col: "sponsor_id" },
};

export async function POST(req: NextRequest) {
  const u = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  try { ensureHotelSchema(); } catch {}
  const { role, recordId, legal_owner, business_license } = await req.json();
  const spec = TABLES[String(role || "")];
  const id = Number(recordId || 0);
  if (!spec || !id) return NextResponse.json({ error: "role + recordId required" }, { status: 400 });

  const rec: any = one(`SELECT id, user_id FROM ${spec.table} WHERE id=?`, id);
  if (!rec) return NextResponse.json({ error: `${role} not found` }, { status: 404 });

  const elevated = isElevated(u);
  // Already owned by this user → idempotent success.
  if (Number(rec.user_id) === Number(u.id)) {
    linkProfile(u.id, role, id);
    return NextResponse.json({ ok: true, already: true });
  }
  // Owned by someone else → only elevated may reassign.
  if (rec.user_id && !elevated) {
    return NextResponse.json({ error: "That profile is already claimed by another account." }, { status: 409 });
  }
  // Belt-and-suspenders: another user column pointing here without record user_id.
  const other: any = one(`SELECT id FROM users WHERE ${spec.col}=? AND id<>?`, id, u.id);
  if (other && !elevated) {
    return NextResponse.json({ error: "That profile is already claimed by another account." }, { status: 409 });
  }

  run(`UPDATE ${spec.table} SET user_id=? WHERE id=?`, u.id, id);
  // Legal identity of the claim: who owns/runs it + business license number.
  // With both provided the claim goes to 'pending' for verification; a bare
  // claim stays 'unverified' until they fill it in. Partners see the status.
  try {
    if (legal_owner || business_license) {
      run(`UPDATE ${spec.table} SET legal_owner=COALESCE(?,legal_owner),
        business_license=COALESCE(?,business_license),
        verification_status=CASE WHEN COALESCE(?,'')<>'' AND COALESCE(?,'')<>'' THEN 'pending' ELSE verification_status END
        WHERE id=?`,
        legal_owner||null, business_license||null, legal_owner||"", business_license||"", id);
    }
  } catch {}
  // Claiming starts the 3-month full-tools trial.
  try { startTrial(role as any, id); } catch {}
  // Claiming a temp/sample listing activates it as a real member.
  try { run(`UPDATE ${spec.table} SET member_status='member' WHERE id=? AND member_status='sample'`, id); } catch {}
  linkProfile(u.id, role, id);
  return NextResponse.json({ ok: true });
}
