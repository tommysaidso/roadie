import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { loadVendor, mediaDir } from "@/lib/vendorPage";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

// Serves a vendor's floor clip, with byte ranges so phones can seek and play inline.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await ctx.params;
  if (!loadVendor(slug) || !/^[\w-]+\.(mp4|webm|mov)$/.test(file)) return new Response("Not found", { status: 404 });
  const p = path.join(mediaDir(slug), file);
  if (!fs.existsSync(p)) return new Response("Not found", { status: 404 });
  const size = fs.statSync(p).size;
  const type = MIME[file.split(".").pop() as string];
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const stream = fs.createReadStream(p, { start, end });
    return new Response(stream as any, { status: 206, headers: { "content-type": type, "content-length": String(end - start + 1),
      "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "cache-control": "public, max-age=86400" } });
  }
  return new Response(fs.createReadStream(p) as any, { headers: { "content-type": type, "content-length": String(size),
    "accept-ranges": "bytes", "cache-control": "public, max-age=86400" } });
}
