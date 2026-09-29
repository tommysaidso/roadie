import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
export const dynamic = "force-dynamic";

// Private, token-gated download of the ROADIE bundle from your own domain.
// Place a built zip on the server at ROADIE_DIST_PATH and set ROADIE_DOWNLOAD_TOKEN.
// Then:  https://roadie.mymymy.studio/api/grab?key=<token>
// Wrong/no token => 404 (the link stays unlisted). Nothing is bypassed — it just
// serves a file you put there.
export async function GET(req:NextRequest){
  const token = process.env.ROADIE_DOWNLOAD_TOKEN;
  const key = req.nextUrl.searchParams.get("key");
  if(!token || key!==token) return new NextResponse("Not found", { status:404 });
  const p = process.env.ROADIE_DIST_PATH || path.join(process.cwd(), "dist", "roadie.zip");
  if(!fs.existsSync(p)) return new NextResponse("No build staged", { status:404 });
  const data = fs.readFileSync(p);
  return new NextResponse(data, { status:200, headers:{
    "content-type":"application/zip",
    "content-disposition":`attachment; filename="roadie.zip"`,
    "cache-control":"no-store",
  }});
}
