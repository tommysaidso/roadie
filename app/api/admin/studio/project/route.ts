import { NextRequest, NextResponse } from "next/server";
import { all, one, run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureStudioSchema } from "@/lib/studio";

export const dynamic = "force-dynamic";

// Timeline documents. The whole edit is one JSON blob — save is an overwrite,
// which is what an editor autosave wants.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (id) {
    const p = one<any>("SELECT * FROM studio_projects WHERE id=?", id);
    if (!p) return NextResponse.json({ error: "No such project." }, { status: 404 });
    return NextResponse.json({ project: p });
  }
  return NextResponse.json({
    projects: all<any>(
      `SELECT id,name,sponsor_id,bpm,duration,poster,updated_at
         FROM studio_projects ORDER BY updated_at DESC LIMIT 50`),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const b = await req.json().catch(() => ({}));
  const name = String(b?.name || "").trim() || "Untitled promo";
  const doc = JSON.stringify(b?.doc ?? {});
  const bpm = Number(b?.bpm) || 120;
  const duration = Math.max(1, Number(b?.duration) || 15);
  const sponsorId = Number(b?.sponsor_id) || null;
  // A poster is a data URL; a runaway one would bloat every project listing.
  const poster = typeof b?.poster === "string" && b.poster.length < 400_000 ? b.poster : null;

  if (b?.id) {
    const id = Number(b.id);
    const exists = one<any>("SELECT id FROM studio_projects WHERE id=?", id);
    if (!exists) return NextResponse.json({ error: "No such project." }, { status: 404 });
    run(`UPDATE studio_projects
            SET name=?, sponsor_id=?, bpm=?, duration=?, doc=?,
                poster=COALESCE(?,poster), updated_at=datetime('now')
          WHERE id=?`,
      name, sponsorId, bpm, duration, doc, poster, id);
    return NextResponse.json({ id, saved: true });
  }

  const r = run(
    `INSERT INTO studio_projects(name,sponsor_id,bpm,duration,doc,poster,created_by)
     VALUES(?,?,?,?,?,?,?)`,
    name, sponsorId, bpm, duration, doc, poster, String(g.user?.email || ""));
  return NextResponse.json({ id: Number(r.lastInsertRowid), saved: true });
}

export async function DELETE(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Pass ?id=" }, { status: 400 });
  // Offers point at projects; clear the link rather than leave a dangling id.
  run("UPDATE sponsor_offers SET project_id=NULL WHERE project_id=?", id);
  run("DELETE FROM studio_projects WHERE id=?", id);
  return NextResponse.json({ deleted: true });
}
