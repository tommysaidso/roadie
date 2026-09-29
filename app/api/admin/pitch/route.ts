import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
export const dynamic = "force-dynamic";

const SLUG = "roadie_ring";

export async function GET() {
  const row = one<any>("SELECT content FROM pitch_docs WHERE slug=?", SLUG);
  const content = row ? JSON.parse(row.content || "{}") : {};
  return NextResponse.json({ content });
}

export async function POST(req: NextRequest) {
  const content = await req.json();
  const existing = one<any>("SELECT id FROM pitch_docs WHERE slug=?", SLUG);
  if (existing) {
    run("UPDATE pitch_docs SET content=?, updated_at=datetime('now') WHERE slug=?",
      JSON.stringify(content), SLUG);
  } else {
    run("INSERT INTO pitch_docs(slug, content) VALUES(?,?)", SLUG, JSON.stringify(content));
  }
  return NextResponse.json({ ok: true });
}
