import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { one, run } from "@/lib/db";

export const dynamic = "force-dynamic";

const GCP_PUSH_URL = process.env.PITCH_UPDATE_URL || "http://34.19.88.242:8765/update";
const GCP_PUSH_TOKEN = process.env.PITCH_UPDATE_TOKEN || "4504de0757e02faf6cea4b380bf13612446ef4280192d93d";
const SLUG = "business_plan";

export async function GET(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Admin only.");

  const row = one<{ content: string }>(
    "SELECT content FROM pitch_docs WHERE slug=?", SLUG
  );
  const config = row ? JSON.parse(row.content) : {};
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Admin only.");

  const body = await req.json();

  if (body.action === "save") {
    const { config } = body;
    run(
      `INSERT INTO pitch_docs(slug,content,updated_at) VALUES(?,?,datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at`,
      SLUG, JSON.stringify(config)
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "push") {
    const { html } = body;
    if (!html || !html.trim().toLowerCase().startsWith("<!doctype")) {
      return NextResponse.json({ error: "invalid html" }, { status: 400 });
    }
    try {
      const res = await fetch(GCP_PUSH_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GCP_PUSH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: html }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return NextResponse.json({ error: `GCP push failed: ${res.status} ${txt}` }, { status: 502 });
      }
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({
        error: `GCP unreachable: ${e?.message || e}. Open port 8765 in GCP Console → VPC Network → Firewall → Add rule: tcp:8765.`,
        firewall_needed: true,
      }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
