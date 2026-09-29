import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { requireUser, ownsBand, forbid, isElevated } from "@/lib/guard";
import {
  ensureRtvSchema, parseVideoUrl, approvedClips, clipsForBand, clipRow, shape,
  bumpPlay, RTV_KINDS,
} from "@/lib/rtv";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — the public wall is approved clips only. `mine=1` returns a band's own
// submissions including the ones still waiting, so they can see where they are.
export async function GET(req: NextRequest) {
  ensureRtvSchema();
  const url = new URL(req.url);

  if (url.searchParams.get("mine")) {
    const g = requireUser(req); if (g.deny) return g.deny;
    const bandId = Number(url.searchParams.get("band")) || Number(g.user?.band_id) || 0;
    if (!bandId) return NextResponse.json({ clips: [] });
    if (!ownsBand(g.user, bandId)) return forbid("You can only see your own band's submissions.");
    return NextResponse.json({ clips: clipsForBand(bandId) });
  }

  if (url.searchParams.get("queue")) {
    const g = requireUser(req); if (g.deny) return g.deny;
    if (!isElevated(g.user)) return forbid("Reviewing RTV is operator-only.");
    return NextResponse.json({
      clips: all<any>("SELECT * FROM rtv_submissions WHERE status='pending' ORDER BY created_at").map(shape),
    });
  }

  return NextResponse.json({ clips: approvedClips() });
}

// POST — submit a video, or (operator) approve/reject one, or count a play.
export async function POST(req: NextRequest) {
  ensureRtvSchema();
  const b = await req.json().catch(() => ({}));

  // Play counts are the one public write: no auth, no payload beyond an id.
  if (b?.action === "played") {
    const row = clipRow(Number(b?.id));
    if (row && row.status === "approved") bumpPlay(row.id);
    return NextResponse.json({ ok: true });
  }

  const g = requireUser(req); if (g.deny) return g.deny;

  if (b?.action === "review") {
    if (!isElevated(g.user)) return forbid("Reviewing RTV is operator-only.");
    const row = clipRow(Number(b?.id));
    if (!row) return NextResponse.json({ error: "No such submission." }, { status: 404 });
    const status = ["approved", "rejected", "pending"].includes(String(b?.status)) ? String(b.status) : "pending";
    run("UPDATE rtv_submissions SET status=?, review_note=?, reviewed_at=datetime('now') WHERE id=?",
      status, String(b?.review_note || ""), row.id);
    return NextResponse.json({ id: row.id, status });
  }

  const bandId = Number(b?.band_id) || Number(g.user?.band_id) || 0;
  if (!bandId) return NextResponse.json({ error: "Link your account to a band first." }, { status: 400 });
  if (!ownsBand(g.user, bandId)) return forbid("You can only submit your own band's videos.");

  const title = String(b?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Give the video a title." }, { status: 400 });

  const parsed = parseVideoUrl(String(b?.url || ""));
  if (!parsed) {
    return NextResponse.json({
      error: "That link can't be played here. Use a YouTube or Vimeo link, or a direct .mp4/.webm file.",
    }, { status: 400 });
  }

  const band = one<any>("SELECT name,home_city,genre FROM bands WHERE id=?", bandId);
  const tags = JSON.stringify(
    Array.isArray(b?.tags) ? b.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 20) : []);
  const kind = RTV_KINDS.includes(String(b?.kind)) ? String(b.kind) : "music_video";
  const year = Number(b?.year) > 1900 ? Math.round(Number(b.year)) : null;

  // Same video twice is an accident, not a second submission.
  const dupe = one<any>(
    "SELECT id,status FROM rtv_submissions WHERE band_id=? AND provider=? AND video_id=?",
    bandId, parsed.provider, parsed.video_id);
  if (dupe) return NextResponse.json({ id: dupe.id, status: dupe.status, duplicate: true });

  const r = run(
    `INSERT INTO rtv_submissions
       (band_id,band_name,home_city,genre,title,url,provider,video_id,kind,year,tags,notes,status)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
    bandId, band?.name || "", band?.home_city || "", band?.genre || "",
    title, String(b?.url).trim(), parsed.provider, parsed.video_id,
    kind, year, tags, String(b?.notes || ""));

  return NextResponse.json({ id: Number(r.lastInsertRowid), status: "pending" });
}

export async function DELETE(req: NextRequest) {
  ensureRtvSchema();
  const g = requireUser(req); if (g.deny) return g.deny;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Pass ?id=" }, { status: 400 });
  const row = clipRow(id);
  if (!row) return NextResponse.json({ deleted: true });
  if (!ownsBand(g.user, row.band_id)) return forbid("You can only pull your own band's videos.");
  run("DELETE FROM rtv_submissions WHERE id=?", id);
  return NextResponse.json({ deleted: true });
}
