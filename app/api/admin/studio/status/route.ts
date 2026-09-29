import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureStudioSchema, pollPool, imageUrl } from "@/lib/studio";

export const dynamic = "force-dynamic";

// Poll a batch (or a list of ids). The browser hits this every couple of
// seconds while the panes are cooking.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const url = new URL(req.url);
  const batch = url.searchParams.get("batch");
  const ids = (url.searchParams.get("ids") || "").split(",").map(Number).filter(Boolean);

  let rows: any[] = [];
  if (batch) rows = all<any>("SELECT * FROM studio_gens WHERE batch=? ORDER BY pane", batch);
  else if (ids.length) rows = all<any>(`SELECT * FROM studio_gens WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
  else return NextResponse.json({ error: "Pass ?batch= or ?ids=" }, { status: 400 });

  const out: any[] = [];
  for (const row of rows) {
    // Terminal states are never re-polled — the fleet's history is pruned and
    // a done job would eventually start reporting as missing.
    if (row.status === "queued" && row.workorder_id) {
      const p = pollPool(row.workorder_id);
      if (p.status !== "queued") {
        run("UPDATE studio_gens SET status=?, images=?, error=? WHERE id=?",
          p.status, JSON.stringify(p.images || []), p.error || null, row.id);
        row.status = p.status;
        row.images = JSON.stringify(p.images || []);
        row.error = p.error || null;
      }
    }
    let images: any[] = [];
    try { images = JSON.parse(row.images || "[]"); } catch { images = []; }
    out.push({
      id: row.id, pane: row.pane, batch: row.batch, status: row.status,
      prompt: row.prompt, look: row.look, size: row.size, seed: row.seed,
      steps: row.steps, cfg: row.cfg, error: row.error,
      urls: images.map((_: any, i: number) => imageUrl(row.id, i)),
    });
  }

  return NextResponse.json({ gens: out, pending: out.filter(o => o.status === "queued").length });
}
