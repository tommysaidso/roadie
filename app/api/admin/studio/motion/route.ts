import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import {
  ensureStudioSchema, genRow, resolveOutputImage,
  buildMotionWorkflow, motionSeconds, engineOf, MOTION_ENGINES, DEFAULT_ENGINE,
  dropWorkorder, newWorkorderId, poolReachable, stageReference, imageUrl,
} from "@/lib/studio";

export const dynamic = "force-dynamic";

// "Make it move" — turn a still we already rendered into a short clip.
//
// Deliberately generic: it takes any finished still and an optional episode
// tag, so the storyboard lane in ScriptLab can drop the same workorder shape
// without going through this route at all.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const episode = (new URL(req.url).searchParams.get("episode") || "").trim();
  const rows = episode
    ? all<any>("SELECT * FROM studio_gens WHERE kind='video' AND episode=? ORDER BY id DESC LIMIT 60", episode)
    : all<any>("SELECT * FROM studio_gens WHERE kind='video' ORDER BY id DESC LIMIT 60");

  return NextResponse.json({
    engines: Object.entries(MOTION_ENGINES).map(([key, e]) => ({
      key, label: e.label, note: e.note, needsEnd: e.needsEnd,
      maxFrames: e.maxFrames, fps: e.fps, step: e.step,
      maxSeconds: e.maxFrames / e.fps,
    })),
    defaultEngine: DEFAULT_ENGINE,
    clips: rows.map(r => ({
      id: r.id, status: r.status, episode: r.episode, prompt: r.prompt,
      engine: r.engine || null,
      frames: r.frames,
      seconds: r.frames ? motionSeconds(r.frames, r.engine) : null,
      source_gen_id: r.source_gen_id, error: r.error,
      url: r.status === "done" ? imageUrl(r.id, 0) : null,
    })),
    episodes: all<any>(
      "SELECT episode, COUNT(*) n FROM studio_gens WHERE kind='video' AND episode IS NOT NULL AND episode<>'' GROUP BY episode ORDER BY episode")
      .map(e => ({ episode: e.episode, count: e.n })),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const reach = poolReachable();
  if (!reach.ok) return NextResponse.json({ error: reach.detail }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const sourceId = Number(b?.gen_id);
  if (!sourceId) return NextResponse.json({ error: "Pass gen_id — the still to bring to life." }, { status: 400 });

  const eng = engineOf(b?.engine);
  const workorderId = newWorkorderId();
  const episode = String(b?.episode || "").trim();
  const warnings: string[] = [];

  /**
   * Resolve one finished still to a file, then push it into every machine's
   * ComfyUI input dir. Playtime's poller never uploads input_assets, so it has
   * to already be there or the render dies on a missing image.
   */
  function stageStill(row: any, tag: string) {
    if (!row) throw new Error("No such shot.");
    if (row.status !== "done") throw new Error("That shot hasn't finished rendering yet.");
    let imgs: any[] = [];
    try { imgs = JSON.parse(row.images || "[]"); } catch { imgs = []; }
    const still = imgs[0];
    if (!still?.filename) throw new Error("That shot has no image on disk.");
    const p = resolveOutputImage(still.subfolder || "", still.filename);
    if (!p) throw new Error(`Can't find ${still.filename} under any known output root.`);
    const base = `roadie_${tag}_${row.id}_${still.filename}`.replace(/[^A-Za-z0-9._-]+/g, "_");
    const { staged, failed } = stageReference(p, base, workorderId);
    if (!staged.length) throw new Error(`Couldn't put ${tag} on any render machine. ${failed.join(" | ")}`);
    warnings.push(...failed);
    return base;
  }

  const src = genRow(sourceId);
  let startBase: string, endBase: string | undefined;
  let endId: number | null = null;

  try {
    startBase = stageStill(src, "start");
    if (eng.needsEnd) {
      endId = Number(b?.end_gen_id) || 0;
      if (!endId) throw new Error(`${eng.label} needs a second shot — pass end_gen_id.`);
      if (endId === sourceId) throw new Error("Start and end are the same shot; there's nothing to move between.");
      endBase = stageStill(genRow(endId), "end");
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 409 });
  }

  let built: any;
  try {
    built = buildMotionWorkflow({
      startFrame: startBase,
      endFrame: endBase,
      engine: eng.key,
      motionPrompt: String(b?.motion || ""),
      seed: Number(b?.seed) || undefined,
      frames: Number(b?.frames) || eng.maxFrames,
      episode,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }

  let error: string | null = null;
  try {
    dropWorkorder({
      workorderId,
      graph: built.graph,
      name: `roadie_motion__${sourceId}${episode ? "__" + episode : ""}`,
      target: "4070",             // LTX video wants the 12GB card, never the 3060
      inputAssets: built.inputAssets,
    });
  } catch (e: any) {
    error = `Could not queue the clip: ${e?.message || e}`;
  }

  const r = run(
    `INSERT INTO studio_gens
       (batch,pane,prompt,negative,look,size,seed,steps,cfg,workorder_id,
        kind,source_gen_id,end_gen_id,engine,episode,frames,status,error,sponsor_id,created_by)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    `motion_${workorderId}`, 0,
    String(b?.motion || "").trim() || "(motion from still)", "",
    src.look || "PHOTOREAL", src.size || "wide",
    built.seed, 20, 5.0, workorderId,
    "video", sourceId, endId, built.engine, episode || null, built.frames,
    error ? "failed" : "queued", error,
    src.sponsor_id || null, String(g.user?.email || ""),
  );

  return NextResponse.json({
    id: Number(r.lastInsertRowid),
    status: error ? "failed" : "queued",
    engine: built.engine,
    frames: built.frames, seconds: built.seconds, seed: built.seed,
    episode: episode || null, error,
    warnings,
  }, { status: error ? 502 : 200 });
}
