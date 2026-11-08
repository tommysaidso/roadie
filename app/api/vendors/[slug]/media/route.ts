import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { all, ensureVendorSchema, loadVendor, mediaDir, run, vendorKeyOk } from "@/lib/vendorPage";

export const dynamic = "force-dynamic";

// Floor clips the vendor shoots on their phone (capture page). Uploading needs the vendor's
// private key; the showcase reads the public list. Cloudflare caps a request near 100 MB.
const MAX = 95 * 1024 * 1024;
const TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!loadVendor(slug)) return NextResponse.json({ clips: [] }, { status: 404 });
  ensureVendorSchema();
  const rows = all<any>("SELECT file, created_at FROM vendor_media WHERE vendor_slug=? AND status='live' ORDER BY id DESC LIMIT 24", slug);
  return NextResponse.json({ clips: rows.map(r => ({ url: `/api/vendors/${slug}/media/${r.file}`, created_at: r.created_at })) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!loadVendor(slug)) return NextResponse.json({ error: "Unknown vendor" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the clip as a form upload" }, { status: 400 });
  if (!vendorKeyOk(slug, String(form.get("key") || ""))) return NextResponse.json({ error: "This capture link is not valid" }, { status: 403 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No clip attached" }, { status: 400 });
  const base = (file.type || "").split(";")[0];
  const ext = TYPES[base];
  if (!ext) return NextResponse.json({ error: "Clips must be MP4, WebM or MOV video" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Clip is too large; keep clips under about a minute" }, { status: 413 });
  const name = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(mediaDir(slug), name), Buffer.from(await file.arrayBuffer()));
  ensureVendorSchema();
  run("INSERT INTO vendor_media(vendor_slug,file,mime,bytes,ad_consent) VALUES(?,?,?,?,?)",
    slug, name, base, file.size, form.get("ad_consent") === "1" ? 1 : 0);
  return NextResponse.json({ ok: true, url: `/api/vendors/${slug}/media/${name}` });
}
