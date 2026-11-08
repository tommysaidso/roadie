import { NextRequest } from "next/server";
import { loadVendor, renderVendorPage } from "@/lib/vendorPage";

export const dynamic = "force-dynamic";

// A vendor's page is a complete document (its own night-glass look and ROADIE bar),
// rendered from the shared template and the vendor's facts file. See lib/vendorPage.ts.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const v = loadVendor(slug);
  if (!v) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host") || "roadie.mymymy.studio"}`;
  return new Response(renderVendorPage(v, origin), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}
