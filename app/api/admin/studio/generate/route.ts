import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import fs from "node:fs";
import path from "node:path";
import {
  ensureStudioSchema, buildWorkflow, recentGens,
  dropWorkorder, newWorkorderId, poolReachable,
  refStoreDir, stageReference,
} from "@/lib/studio";

export const dynamic = "force-dynamic";

// GET — the gallery behind the studio. Operators only; these are unreleased
// sponsor materials, not public art.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();
  return NextResponse.json({ gens: recentGens(60) });
}

// POST — queue one or two prompts. Two panes come back as one batch so the
// side-by-side comparison is a real A/B on the same click.
export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const body = await req.json().catch(() => ({}));
  const panes = Array.isArray(body?.panes) ? body.panes : [body];
  const wanted = panes
    .map((p: any) => ({ ...p, prompt: String(p?.prompt || "").trim() }))
    .filter((p: any) => p.prompt);

  if (!wanted.length) {
    return NextResponse.json({ error: "Type a prompt first — that's the only required field." }, { status: 400 });
  }
  if (wanted.length > 2) {
    return NextResponse.json({ error: "Two panes at a time. More than that and you stop comparing and start guessing." }, { status: 400 });
  }

  // Fail loudly and early if the NAS queue isn't mounted. Writing into a
  // missing share would otherwise look like a job that never renders.
  const reach = poolReachable();
  if (!reach.ok) return NextResponse.json({ error: reach.detail }, { status: 503 });

  const batch = `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const sponsorId = Number(body?.sponsor_id) || null;
  const out: any[] = [];

  for (let i = 0; i < wanted.length; i++) {
    const p = wanted[i];
    const built = buildWorkflow(p);
    const workorderId = newWorkorderId();

    let error: string | null = null;
    try {
      // A reference was already staged at upload time; re-stage into this
      // workorder's _assets/ dir so a puller that does its own upload finds it.
      if (built.reference) {
        const local = path.join(refStoreDir(), built.reference);
        if (!fs.existsSync(local)) {
          throw new Error(`reference ${built.reference} is no longer on disk — upload it again`);
        }
        stageReference(local, built.reference, workorderId);
      }

      dropWorkorder({
        workorderId,
        graph: built.workflow,
        name: `roadie__${batch}__pane${i}`,
        target: "4070",           // SDXL needs the 12GB card, not the 3060
        inputAssets: built.inputAssets,
      });
    } catch (e: any) {
      error = `Could not queue the render: ${e?.message || e}`;
    }

    const r = run(
      `INSERT INTO studio_gens
         (batch,pane,prompt,negative,look,size,seed,steps,cfg,workorder_id,
          reference,strength,status,error,sponsor_id,created_by)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      batch, i, p.prompt, String(p.negative || ""),
      String(p.look || "PHOTOREAL").toUpperCase(), String(p.size || "wide"),
      built.seed, Math.round(p.steps ?? 28), Number(p.cfg ?? 6.5),
      workorderId, built.reference, built.reference ? built.denoise : null,
      error ? "failed" : "queued", error,
      sponsorId, String(g.user?.email || ""),
    );

    out.push({
      id: Number(r.lastInsertRowid), pane: i, batch,
      status: error ? "failed" : "queued",
      seed: built.seed, workorder_id: workorderId,
      reference: built.reference, strength: built.reference ? built.denoise : null,
      error,
    });
  }

  const anyOk = out.some(o => o.status !== "failed");
  return NextResponse.json({ batch, gens: out, ok: anyOk }, { status: anyOk ? 200 : 502 });
}
