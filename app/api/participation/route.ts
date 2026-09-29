import { NextRequest, NextResponse } from "next/server";
import { requireUser, ownsBand, ownsVenue, ownsSponsor, forbid } from "@/lib/guard";
import { participationStatus } from "@/lib/participation";
export const dynamic = "force-dynamic";

// GET ?kind=band|venue|sponsor&id=N → trial/threshold/required status + pitch line.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const kind = String(req.nextUrl.searchParams.get("kind") || "");
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!["band", "venue", "sponsor"].includes(kind) || !id)
    return NextResponse.json({ error: "kind (band|venue|sponsor) + id required" }, { status: 400 });
  const owns = kind === "band" ? ownsBand(g.user, id) : kind === "venue" ? ownsVenue(g.user, id) : ownsSponsor(g.user, id);
  if (!owns) return forbid("You can only view your own participation status.");
  const s = participationStatus(kind as any, id);
  if (!s) return NextResponse.json({ error: `${kind} not found` }, { status: 404 });
  return NextResponse.json(s);
}
