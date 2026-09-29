import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { all, one, run } from "@/lib/db";
import {
  sets, clipsForSet, queueAlignment, applyAlignment, clipUrl, cutSheet, storageReady,
  renderCut, cutUploadUrl, finishRender, cutWatchUrl,
} from "@/lib/fanclips";
import { regenerateShareToken } from "@/lib/shareTokens";

export const dynamic = "force-dynamic";

// MULTICAM — the operator side, plus the worker's way back in.
//
// The alignment worker runs on a machine with ffmpeg and reports here. It
// authenticates with a shared secret rather than a session, because it is a
// script on a render box with no browser and no login.

function workerOk(req: NextRequest) {
  const want = process.env.ROADIE_WORKER_SECRET || "";
  if (!want) return false;                     // no secret set = no worker access
  const got = req.headers.get("x-roadie-worker") || "";
  // Fixed-length compare is not worth it here — the secret is high-entropy and
  // this endpoint is not enumerable — but bail on empties rather than match "".
  return !!got && got === want;
}

function guard(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return { deny: g.deny };
  if (!isElevated(g.user)) return { deny: forbid("Multicam is operator-only.") };
  return { user: g.user };
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const setId = Number(u.searchParams.get("set") || 0);

  // The cutter runs headless in this container and needs the sheet. It carries
  // the worker secret instead of a cookie.
  if (u.searchParams.get("worker") && workerOk(req)) {
    const sheet = cutSheet(setId);
    if (!sheet) return NextResponse.json({ error: "No such set." }, { status: 404 });
    return NextResponse.json(sheet);
  }

  const g = guard(req); if (g.deny) return g.deny;

  if (setId) {
    if (u.searchParams.get("cutsheet")) {
      const sheet = cutSheet(setId);
      if (!sheet) return NextResponse.json({ error: "No such set." }, { status: 404 });
      return NextResponse.json({ ok: true, ...sheet });
    }
    const watch = cutWatchUrl(setId);
    const clips = clipsForSet(setId).map((c: any) => ({
      ...c,
      // Signed for viewing in the console; short-lived on purpose.
      url: c.status === "uploaded" ? clipUrl(c, 1800) : null,
    }));
    return NextResponse.json({
      ok: true,
      set: one<any>(`SELECT * FROM multicam_sets WHERE id=?`, setId),
      clips, watch,
    });
  }

  return NextResponse.json({
    ok: true,
    ready: storageReady(),
    sets: sets(),
    stops: all<any>(
      `SELECT s.id, s.city, s.date, v.name AS venue, s.is_test, s.share_token
         FROM stops s LEFT JOIN venues v ON v.id = s.venue_id
        ORDER BY s.is_test DESC, s.date DESC LIMIT 60`),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  // ---- the worker reporting alignment results -------------------------
  // Checked BEFORE the session guard: this caller has no cookie.
  if (action === "align_result") {
    if (!workerOk(req)) {
      return NextResponse.json({ error: "Not authorised." }, { status: 401 });
    }
    const setId = Number(body.set_id || 0);
    const ref = Number(body.reference_clip_id || 0);
    const results = Array.isArray(body.results) ? body.results : [];
    if (!setId || !results.length) {
      return NextResponse.json({ error: "set_id and results are required." }, { status: 400 });
    }
    const r = applyAlignment(setId, ref, results);
    return NextResponse.json(r);
  }

  // ---- the cutter asking where to put the finished file ----------------
  if (action === "render_upload_url") {
    if (!workerOk(req)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
    const { key, url } = cutUploadUrl(Number(body.set_id || 0));
    if (!url) return NextResponse.json({ error: "Storage not configured." }, { status: 500 });
    return NextResponse.json({ ok: true, key, url });
  }

  // ---- the cutter reporting the outcome --------------------------------
  if (action === "render_result") {
    if (!workerOk(req)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
    return NextResponse.json(finishRender(
      Number(body.set_id || 0), !!body.ok, body.key, Number(body.bytes || 0) || undefined, body.note,
    ));
  }

  const g = guard(req); if (g.deny) return g.deny;

  if (action === "render") {
    const r = renderCut(Number(body.set_id || 0), {
      segmentSec: Number(body.segment_sec || 0) || undefined,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  }

  if (action === "create_set") {
    const stopId = Number(body.stop_id || 0) || null;
    const title = String(body.title || "").trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "Give the set a name." }, { status: 400 });
    const r = run(
      `INSERT INTO multicam_sets(stop_id, band_id, title) VALUES(?,?,?)`,
      stopId, Number(body.band_id || 0) || null, title,
    );
    return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
  }

  if (action === "assign") {
    // Pull loose clips shot at a stop into a set.
    const setId = Number(body.set_id || 0);
    const ids: number[] = Array.isArray(body.clip_ids) ? body.clip_ids.map(Number) : [];
    if (!setId || !ids.length) return NextResponse.json({ error: "Nothing to assign." }, { status: 400 });
    for (const id of ids) run(`UPDATE fan_clips SET set_id=? WHERE id=?`, setId, id);
    return NextResponse.json({ ok: true, moved: ids.length });
  }

  if (action === "align") {
    const r = queueAlignment(Number(body.set_id || 0));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  }

  if (action === "regen_qr") {
    // The incident-response button: rotate this show's link/QR because the
    // old one is suspected leaked or is being abused. The old token is
    // archived (stop_qr_archive), not discarded, and stops working the moment
    // this returns.
    const stopId = Number(body.stop_id || 0);
    if (!stopId) return NextResponse.json({ error: "Which show?" }, { status: 400 });
    const r = await regenerateShareToken(stopId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  }

  if (action === "clip_status") {
    const id = Number(body.id || 0);
    const status = ["uploaded", "approved", "hidden", "removed"].includes(body.status)
      ? body.status : null;
    if (!id || !status) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    run(`UPDATE fan_clips SET status=? WHERE id=?`, status, id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
