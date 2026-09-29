import { NextRequest, NextResponse } from "next/server";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { rateLimit } from "@/lib/guard";
import { one, run } from "@/lib/db";
export const dynamic = "force-dynamic";

// A real band claims its seeded/unclaimed profile. Must be signed in (mymymy
// identity via SSO). Flips it from 'unclaimed' → 'verified' and assigns the owner.
export async function POST(req: NextRequest) {
  const u: any = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: "sign_in", message: "Sign in to claim your band." }, { status: 401 });
  const limited = rateLimit(req, "band-claim", 10);   // no legitimate reason to claim in bulk
  if (limited) return limited;
  const parts = new URL(req.url).pathname.split("/").filter(Boolean); // .../bands/<id>/claim
  const bid = Number(parts[parts.length - 2]);
  if (!bid) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const b: any = one("SELECT id,name,user_id,verification_status FROM bands WHERE id=?", bid);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Ownership lives in bands.user_id — NOT in verification_status. Gating on
  // status was a takeover hole: nothing in the signup path ever writes
  // 'verified' (see app/api/bands/route.ts and app/api/auth/link/route.ts,
  // which only reaches 'pending', and only when legal_owner + business_license
  // are supplied — the wizard never sends them). So every band created through
  // /setup stayed 'unverified' and any signed-in stranger could re-point
  // bands.user_id at themselves. Targets were enumerable too: /api/bands
  // returns verification_status publicly.
  if (b.user_id && Number(b.user_id) === Number(u.id)) {
    return NextResponse.json({ ok: true, band: b.name, already: true });   // idempotent
  }
  if (b.user_id) {
    return NextResponse.json(
      { error: "already_claimed", message: "This band is already claimed. If it's yours, contact support." },
      { status: 409 });
  }
  // Don't silently orphan a band this user already owns — bands.user_id would
  // still name them while users.band_id moved on, leaving ownership and access
  // disagreeing. One band per account until membership roles land.
  if (u.band_id && Number(u.band_id) !== Number(bid)) {
    return NextResponse.json(
      { error: "already_linked", message: "Your account is already linked to another band. Contact support to move it." },
      { status: 409 });
  }
  // PROOF, or a queue.
  //
  // Everything above only establishes that the band is unclaimed and this login
  // is free to take one. It says nothing about whether this person has any
  // connection to the band — and with names and ids public, an unclaimed band
  // is claimable by whoever gets there first.
  //
  // So a claim goes through instantly only when we have a reason to believe it:
  //   - an operator is doing it, or
  //   - we invited THIS email about THIS band (our outreach knows who we wrote
  //     to), or
  //   - their address matches the contact already on the record.
  // Anything else becomes a request a human approves. Slower, but a wrongly
  // handed-over band is not something you can quietly undo.
  const elevated = ["admin", "owner"].includes(String(u.role || ""));
  const email = String(u.email || "").toLowerCase();

  let proven = elevated;
  if (!proven && email) {
    try {
      const asked: any = one(
        "SELECT 1 x FROM reachouts WHERE kind='band' AND ref_id=? AND lower(email)=? AND ok=1", bid, email);
      if (asked) proven = true;
    } catch { /* no reachouts table yet — fall through to review */ }
  }
  if (!proven && email) {
    try {
      const c: any = one("SELECT contact FROM bands WHERE id=?", bid);
      if (c?.contact && String(c.contact).toLowerCase().includes(email)) proven = true;
    } catch { /* bands may not carry contact — fall through */ }
  }

  if (!proven) {
    try {
      run(`CREATE TABLE IF NOT EXISTS claim_requests (
             id INTEGER PRIMARY KEY, kind TEXT, ref_id INTEGER, user_id INTEGER,
             email TEXT, note TEXT, status TEXT DEFAULT 'pending',
             created_at TEXT DEFAULT (datetime('now')))`);
      const dup: any = one(
        "SELECT id FROM claim_requests WHERE kind='band' AND ref_id=? AND user_id=? AND status='pending'", bid, u.id);
      if (!dup) {
        run("INSERT INTO claim_requests(kind,ref_id,user_id,email) VALUES('band',?,?,?)",
          bid, u.id, email);
      }
    } catch { /* if we cannot queue it, still do not hand the band over */ }
    return NextResponse.json({
      ok: false, pending: true,
      message: `Thanks — we've put in a request for ${b.name}. We check these by hand so a band can't be taken by the wrong person. You'll hear back shortly.`,
    }, { status: 202 });
  }

  run("UPDATE bands SET verification_status='verified', member_status='member', user_id=? WHERE id=?", u.id, bid);
  // Link it BOTH ways. Setting only bands.user_id left users.band_id null, so
  // the owner still landed on an empty Garage after claiming their own band.
  run("UPDATE users SET band_id=?, role=CASE WHEN role IN ('fan','') OR role IS NULL THEN 'band' ELSE role END WHERE id=?", bid, u.id);
  return NextResponse.json({ ok: true, band: b.name });
}
