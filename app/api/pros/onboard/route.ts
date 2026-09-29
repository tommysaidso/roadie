import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/guard";
import { proByToken, saveVendorOnboarding, proParticipation } from "@/lib/vendor";
export const dynamic = "force-dynamic";

// Public but token-secured: the emailed setup link IS the capability.
// GET  ?token=...     -> current values to prefill the wizard
// POST { token, ... } -> save business info + import client list, start trial
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const pro = proByToken(token);
  if (!pro) return NextResponse.json({ error: "Invalid or expired setup link." }, { status: 404 });
  let links: any = {}; try { links = JSON.parse(pro.links || "{}"); } catch {}
  return NextResponse.json({
    pro: {
      id: pro.id, name: pro.name, headline: pro.headline || "", kind: pro.kind || "",
      tags: pro.tags || "", city: pro.city || "", region: pro.region || "", bio: pro.bio || "",
      phone: pro.phone || "", address: pro.address || "", hours: pro.hours || "",
      website: pro.website || links.web || "", year_est: pro.year_est || "", services: pro.services || "",
      onboard_done_at: pro.onboard_done_at || null,
    },
    participation: proParticipation(pro.id),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "vendor_onboard", 30); if (limited) return limited;
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const res = saveVendorOnboarding(String(body.token || ""), body);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
