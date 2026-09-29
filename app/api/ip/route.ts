import { NextRequest, NextResponse } from "next/server";
import { requireUser, rateLimit } from "@/lib/guard";
import {
  ensureIpSchema, PLATFORMS, accountsFor, addAccount, removeAccount,
  placementsFor, addPlacement, confirmPlacement, eventsFor, detectFor,
} from "@/lib/iptrack";

export const dynamic = "force-dynamic";

// An artist's own IP ledger: where their work is, and what it has done.
//
// Strictly first-person. Every route is scoped to the signed-in user — there is
// no way to ask this about somebody else, because "show me where that artist's
// music is" is not a question this should ever answer.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureIpSchema();
  return NextResponse.json({
    platforms: PLATFORMS,
    accounts: accountsFor(g.user.id),
    placements: placementsFor(g.user.id),
    events: eventsFor(g.user.id, 60),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureIpSchema();
  const b = await req.json().catch(() => ({} as any));
  const action = String(b?.action || "");

  if (action === "add_account") {
    if (!b?.platform) return NextResponse.json({ error: "Which platform?" }, { status: 400 });
    addAccount(g.user.id, b);
    return NextResponse.json({ accounts: accountsFor(g.user.id) });
  }

  if (action === "remove_account") {
    removeAccount(g.user.id, Number(b?.id));
    return NextResponse.json({ accounts: accountsFor(g.user.id) });
  }

  if (action === "add_placement") {
    const r = addPlacement(g.user.id, b);
    if ((r as any).error) return NextResponse.json(r, { status: 400 });
    return NextResponse.json({ placements: placementsFor(g.user.id) });
  }

  if (action === "confirm") {
    confirmPlacement(g.user.id, Number(b?.id), b?.yes !== false);
    return NextResponse.json({ placements: placementsFor(g.user.id) });
  }

  // Go and look at a connected account.
  if (action === "detect") {
    const limited = rateLimit(req, "ipdetect", 20, 60 * 60 * 1000); if (limited) return limited;
    const acct = accountsFor(g.user.id).find((a: any) => a.id === Number(b?.id));
    if (!acct) return NextResponse.json({ error: "Not one of your accounts." }, { status: 404 });
    const r = await detectFor(g.user.id, acct);
    return NextResponse.json({ ...r, placements: placementsFor(g.user.id) });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
