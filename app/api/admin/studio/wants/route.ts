import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureWantsSchema, wantsList, addWant, fillWant, suggestWants } from "@/lib/wants";
import { listStock } from "@/lib/stock";

export const dynamic = "force-dynamic";

// The shopping list: what still needs grabbing from Adobe / Storyblocks.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureWantsSchema();

  const pid = Number(new URL(req.url).searchParams.get("project")) || null;
  return NextResponse.json({ wants: wantsList(pid) });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureWantsSchema();

  const b = await req.json().catch(() => ({}));

  if (b?.action === "suggest") {
    const brief = String(b?.brief || "").trim();
    if (!brief) return NextResponse.json({ error: "Describe the promo first — the list comes from the brief." }, { status: 400 });

    // Tell the model what is already on the shelf so it doesn't send you
    // shopping for a shot you own.
    const have = listStock(120).map(i => i.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "));
    const ideas = await suggestWants(brief, have);
    if (!ideas.length) {
      return NextResponse.json({
        error: "Couldn't get a list back — add what you need by hand and it works the same.",
        wants: wantsList(Number(b?.project_id) || null),
      }, { status: 502 });
    }
    ideas.forEach((x, i) => addWant({
      project_id: Number(b?.project_id) || null, brief,
      description: x.description, kind: x.kind, why: x.why, position: i,
    }));
    return NextResponse.json({ wants: wantsList(Number(b?.project_id) || null), added: ideas.length });
  }

  if (b?.action === "fill") {
    const id = Number(b?.id);
    if (!id || !b?.stock_id) return NextResponse.json({ error: "Pass id and stock_id." }, { status: 400 });
    return NextResponse.json({ want: fillWant(id, String(b.stock_id)) });
  }

  if (b?.action === "skip") {
    run("UPDATE stock_wants SET status='skipped' WHERE id=?", Number(b?.id));
    return NextResponse.json({ wants: wantsList(Number(b?.project_id) || null) });
  }

  const description = String(b?.description || "").trim();
  if (!description) return NextResponse.json({ error: "Say what you need." }, { status: 400 });
  return NextResponse.json({
    want: addWant({
      project_id: Number(b?.project_id) || null,
      brief: String(b?.brief || ""), description,
      kind: b?.kind, why: b?.why,
    }),
  });
}

export async function DELETE(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureWantsSchema();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Pass ?id=" }, { status: 400 });
  run("DELETE FROM stock_wants WHERE id=?", id);
  return NextResponse.json({ deleted: true });
}
