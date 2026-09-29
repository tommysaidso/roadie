import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getHub } from "@/lib/hubs";

export const dynamic = "force-dynamic";

// Header counts, scoped to the ring the visitor is in.
//
// These were global COUNT(*)s, so the strip read "919 venues" no matter which
// hub you had selected — a Canadian operator on the Interior ring saw a number
// made mostly of Alberta, Vancouver Island and California rooms. Same reason
// the venues page was showing US fairgrounds next to BC pubs.
export async function GET(req: NextRequest) {
  const hub = getHub(req.cookies.get("roadie_hub")?.value);
  const id = hub?.id ?? null;

  const scoped = (sql: string, fallback: string) => {
    if (id == null) return one<any>(fallback)?.n ?? 0;
    try { return one<any>(sql, id)?.n ?? 0; } catch { return one<any>(fallback)?.n ?? 0; }
  };

  const bands = scoped("SELECT COUNT(*) n FROM bands WHERE hub_id=?", "SELECT COUNT(*) n FROM bands");
  const venues = scoped("SELECT COUNT(*) n FROM venues WHERE hub_id=?", "SELECT COUNT(*) n FROM venues");
  const openSlots = scoped(
    `SELECT COUNT(*) n FROM venue_slots s JOIN venues v ON v.id=s.venue_id
      WHERE s.status='open' AND v.hub_id=?`,
    "SELECT COUNT(*) n FROM venue_slots WHERE status='open'");

  let sponsorSpend = 0;
  try { sponsorSpend = one<any>("SELECT SUM(cost) c FROM ad_placements")?.c ?? 0; } catch {}

  return NextResponse.json({
    bands, venues, openSlots, sponsorSpend,
    hub: hub ? { slug: hub.slug, name: hub.name, province: hub.province } : null,
  });
}
