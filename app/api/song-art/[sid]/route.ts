import { NextRequest, NextResponse } from "next/server";
import { getArt, readArt } from "@/lib/songfiles";
export const dynamic = "force-dynamic";

// Public share/download link for a generated piece. The file already carries
// the mymymy.studio mark and its metadata tags, so it can be handed out as-is.
// ?dl=1 forces a download instead of inline playback.
export async function GET(req: NextRequest, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const rec = getArt(sid);
  if (!rec) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const buf = readArt(rec);
  if (!buf) return NextResponse.json({ error: "File is gone from disk." }, { status: 410 });

  const slug = String(rec.title || "roadie").replace(/\W+/g, "_").slice(0, 40) || "roadie";
  const ext = rec.kind === "clip" ? "mp4" : (rec.mime?.includes("jpeg") ? "jpg" : "png");
  const dl = req.nextUrl.searchParams.get("dl") === "1";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": rec.mime || "application/octet-stream",
      "content-length": String(buf.length),
      "content-disposition": `${dl ? "attachment" : "inline"}; filename="${slug}-${sid}.${ext}"`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
