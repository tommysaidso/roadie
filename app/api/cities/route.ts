import { NextRequest, NextResponse } from "next/server";
import { suggestCities } from "@/lib/geocode";

export const dynamic = "force-dynamic";

// Town suggestions for the "Start near you" box.
//
// Public and unauthenticated on purpose — this is the front door, and the data
// is a list of Canadian town names, which is not a secret. No key reaches the
// browser and there is nothing to meter, because the answers come from our own
// gazetteer rather than a places API.
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") || "";
  const cities = suggestCities(q, 8);
  return NextResponse.json({ cities }, {
    // Same query gives the same answer forever; let the browser keep it.
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
