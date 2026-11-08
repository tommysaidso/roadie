import { NextRequest, NextResponse } from "next/server";
import { all, ensureVendorSchema, ipHash, loadVendor, recentRequestCount, run, vendorKeyOk } from "@/lib/vendorPage";

export const dynamic = "force-dynamic";

const KINDS = new Set(["quote", "build_sheet", "buy", "lesson", "parts"]);
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// Anyone can send a vendor a request from their page (quote, build sheet, lesson, parts, ask to buy).
// The vendor reads them with their private key: GET ?key=...
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!loadVendor(slug)) return NextResponse.json({ error: "Unknown vendor" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: bots fill every field
  const kind = KINDS.has(b.kind) ? b.kind : "quote";
  const name = clip(b.name, 80), contact = clip(b.contact, 120);
  if (!name || contact.length < 5) return NextResponse.json({ error: "Add your name and an email or phone number" }, { status: 400 });
  ensureVendorSchema();
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ih = ipHash(ip || "unknown");
  if (recentRequestCount(ih) >= 8) return NextResponse.json({ error: "Too many requests from here in the last hour" }, { status: 429 });
  run("INSERT INTO vendor_requests(vendor_slug,kind,summary,name,contact,message,ip_hash) VALUES(?,?,?,?,?,?,?)",
    slug, kind, clip(b.summary, 1500), name, contact, clip(b.message, 1500), ih);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!vendorKeyOk(slug, req.nextUrl.searchParams.get("key"))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const rows = all<any>("SELECT id,kind,summary,name,contact,message,status,created_at FROM vendor_requests WHERE vendor_slug=? ORDER BY id DESC LIMIT 200", slug);
  return NextResponse.json({ requests: rows });
}
