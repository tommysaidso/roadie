// Sponsor Promo Studio — schema + gen gateway.
//
// The job this does: Ben is on the phone with a sponsor, needs a promo NOW.
// Type a prompt -> get images side by side -> drop the keepers on a timeline
// -> export a clip -> attach it to a sponsor offer and send it.
//
// Generation runs on the fleet's ComfyUI over HTTP. ROADIE keeps its own job
// rows and its own UI; it does not import anything from ABAI/FIOS.

import fs from "node:fs";
import path from "node:path";
import { all, one, run, getDb } from "./db";

// ---------------------------------------------------------------------------
// The render pool is PULL, not push
// ---------------------------------------------------------------------------
//
// We never speak HTTP to a render node. Every ComfyUI on the fleet binds
// loopback on its own machine (Playtime's two GPUs are 127.0.0.1:8186 and
// :8187 *there*; this box's own is 127.0.0.1:8188), so a peer port is
// unreachable by design even when the node is up and busy. The NAS jobs
// folder is the only inter-box channel.
//
// Drop a workorder in jobs/pending -> the poller on each machine claims what
// it can run and renders on its LOCAL ComfyUI -> a manifest appears in
// jobs/done and the PNG lands under the shared output root. Nothing has to
// reach anything.
//
// Two rules that are easy to get wrong and expensive to debug:
//   - The graph must appear under `workflow` AND `prompt` AND inside
//     `scenes[].workflow`. The bridge rejects anything else.
//   - The pool dedups by workorder_id. A reused id is silently discarded and
//     looks exactly like "nothing happened", so ids are always fresh.
//
// Reads of the pool are READ-ONLY. We never move or delete anything in those
// folders — the bridge loses track of its own work if we do.

export const JOBS_ROOT = process.env.ROADIE_RENDER_JOBS_DIR ||
  "\\\\DXP4800UARX\\Unreal_Nas\\GenAi\\ComfyUI\\jobs";

export const DROP_DIR = process.env.ROADIE_RENDER_DROP_DIR || path.join(JOBS_ROOT, "pending");
export const DONE_DIR = path.join(JOBS_ROOT, "done");
export const FAILED_DIR = path.join(JOBS_ROOT, "failed");

/** Output roots a finished image may resolve under, NAS first. */
export function outputBases(): string[] {
  const bases = [
    process.env.ROADIE_RENDER_COMFY_OUTPUT ||
      "\\\\DXP4800UARX\\Unreal_Nas\\GenAi\\ComfyUI\\output",
    ...(process.env.ROADIE_RENDER_COMFY_OUTPUT_EXTRA || "")
      .split(path.delimiter).map(s => s.trim()).filter(Boolean),
    // A local puller renders to its own disk, so its PNG never reaches the NAS.
    "C:\\FIOS\\ComfyUI\\output",
    "C:\\ComfyUI\\output",
  ];
  return [...new Set(bases.map(b => b.replace(/[\\/]+$/, "")))];
}

// Checkpoint per look. Photoreal and comic are separate lanes on the fleet and
// must not be crossed — a photoreal prompt on the comic checkpoint comes back
// as a cartoon and wastes the call.
export const LOOKS: Record<string, { ckpt: string; label: string; positive: string; negative: string }> = {
  PHOTOREAL: {
    ckpt: "novaRealityXL_illustriousV70.safetensors",
    label: "Photoreal",
    positive: "photographic, natural light, sharp focus, high detail, 35mm",
    negative: "cartoon, illustration, anime, painting, blurry, watermark, text, logo, deformed, extra limbs",
  },
  COMIC: {
    ckpt: "illustriousXL20_v20.safetensors",
    label: "Comic / illustrated",
    positive: "bold clean linework, flat colour, graphic poster art, strong silhouette",
    negative: "photograph, photorealistic, blurry, watermark, text, logo, deformed, extra limbs",
  },
};

export type LookKey = keyof typeof LOOKS;

// Standing rule: vehicles read mid-to-late 1980s or NEWER.
//
// Ask an SDXL model for a "tour van" and it reliably hands back a 1970s
// hippie bus — that's the picture the training data associates with the
// words. A ROADIE promo showing a 40-year-old van tells a sponsor the outfit
// is a nostalgia act, which is the wrong message and the wrong decade.
//
// This is negative-side only on purpose. Pushing "1980s" into the POSITIVE
// would date the whole frame — the storefront, the clothes, the film stock —
// on shots that have no vehicle in them at all. Excluding the old vehicles
// steers the van newer while leaving everything else in the present.
export const VEHICLE_ERA_NEGATIVE = [
  "1950s car", "1960s car", "1970s van", "vintage car", "classic car",
  "antique automobile", "VW bus", "volkswagen kombi", "hippie van",
  "split-window van", "rounded 1970s bodywork", "chrome bumper cruiser",
].join(", ");

// Aspect presets a sponsor promo actually ships in. SDXL wants multiples of 64.
export const SIZES: Record<string, { w: number; h: number; label: string }> = {
  wide:     { w: 1344, h: 768,  label: "16:9 wide — video / web banner" },
  square:   { w: 1024, h: 1024, label: "1:1 square — social post" },
  vertical: { w: 768,  h: 1344, label: "9:16 vertical — reels / stories" },
  poster:   { w: 896,  h: 1152, label: "3:4 poster — print / flyer" },
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

let ready = false;

/** Create the studio tables. Cheap and idempotent; call at the top of routes. */
export function ensureStudioSchema() {
  if (ready) return;
  getDb().exec(`
    -- One row per image generation request. 'pane' lets two prompts sit side
    -- by side in the same batch so they can be compared honestly.
    CREATE TABLE IF NOT EXISTS studio_gens (
      id INTEGER PRIMARY KEY,
      batch TEXT,                      -- groups the panes of one comparison
      pane INTEGER DEFAULT 0,          -- 0 = left, 1 = right
      prompt TEXT NOT NULL,
      negative TEXT DEFAULT '',
      look TEXT DEFAULT 'PHOTOREAL',
      size TEXT DEFAULT 'wide',
      seed INTEGER,
      steps INTEGER DEFAULT 28,
      cfg REAL DEFAULT 6.5,
      workorder_id TEXT,               -- id dropped into the NAS pool
      status TEXT DEFAULT 'queued',    -- queued | done | failed
      images TEXT DEFAULT '[]',        -- JSON array of {filename,subfolder,type}
      error TEXT,
      sponsor_id INTEGER REFERENCES sponsors(id),
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_studio_gens_batch ON studio_gens(batch);
    CREATE INDEX IF NOT EXISTS idx_studio_gens_status ON studio_gens(status);

    -- A timeline document. The whole edit is one JSON blob: clips, keyframe
    -- splines, audio, markers. Saving is a single overwrite, which is what an
    -- editor autosave wants.
    CREATE TABLE IF NOT EXISTS studio_projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      sponsor_id INTEGER REFERENCES sponsors(id),
      bpm REAL DEFAULT 120,
      duration REAL DEFAULT 15,        -- seconds
      doc TEXT DEFAULT '{}',           -- JSON timeline document
      poster TEXT,                     -- data URL thumbnail of frame 0
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- What you actually put in front of a sponsor. An offer is a priced,
    -- dated package with the promo attached.
    CREATE TABLE IF NOT EXISTS sponsor_offers (
      id INTEGER PRIMARY KEY,
      sponsor_id INTEGER REFERENCES sponsors(id),
      sponsor_name TEXT,               -- kept flat so an offer survives a deleted sponsor
      title TEXT NOT NULL,
      tier TEXT DEFAULT 'local',       -- local | route | ring | title
      pitch TEXT DEFAULT '',           -- the words you say on the phone
      deliverables TEXT DEFAULT '[]',  -- JSON array of strings
      price INTEGER,                   -- CAD, total
      term TEXT DEFAULT '',            -- "3 stops, Aug-Oct 2026"
      in_kind TEXT DEFAULT '',         -- what they give instead of cash
      project_id INTEGER REFERENCES studio_projects(id),
      hero_gen_id INTEGER REFERENCES studio_gens(id),
      status TEXT DEFAULT 'draft',     -- draft | sent | negotiating | signed | passed
      token TEXT,                      -- share link slug
      sent_at TEXT, decided_at TEXT,
      notes TEXT DEFAULT '',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sponsor_offers_status ON sponsor_offers(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_offers_token ON sponsor_offers(token);
  `);

  // An earlier cut of this table pushed jobs straight at a node and stored
  // node/prompt_id. CREATE TABLE IF NOT EXISTS won't add the pull-model column
  // to a table that already exists, so add it here.
  const cols = all<any>("PRAGMA table_info(studio_gens)").map(c => String(c.name));
  if (!cols.includes("workorder_id")) {
    run("ALTER TABLE studio_gens ADD COLUMN workorder_id TEXT");
  }
  if (!cols.includes("reference")) {
    run("ALTER TABLE studio_gens ADD COLUMN reference TEXT");
    run("ALTER TABLE studio_gens ADD COLUMN strength REAL");
  }
  if (!cols.includes("kind")) {
    // A row is now either a still or a clip made from one.
    run("ALTER TABLE studio_gens ADD COLUMN kind TEXT DEFAULT 'image'");
    run("ALTER TABLE studio_gens ADD COLUMN source_gen_id INTEGER");
    run("ALTER TABLE studio_gens ADD COLUMN episode TEXT");
    run("ALTER TABLE studio_gens ADD COLUMN frames INTEGER");
  }
  if (!cols.includes("engine")) {
    // Which model made the clip — fps differs per engine, so a stored frame
    // count is meaningless without it.
    run("ALTER TABLE studio_gens ADD COLUMN engine TEXT");
    run("ALTER TABLE studio_gens ADD COLUMN end_gen_id INTEGER");
  }

  ready = true;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export type GenRequest = {
  prompt: string;
  negative?: string;
  look?: string;
  size?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  /** Basename of a reference already staged into ComfyUI's input folder. */
  reference?: string;
  /** 0..1 — how far the render may travel from the reference. */
  strength?: number;
};

/**
 * Build the SDXL graph. Core nodes only, so any machine on the pool runs it
 * without needing a custom-node set.
 *
 * With no reference it's plain text-to-image. With one it becomes img2img:
 * LoadImage -> ImageScale -> VAEEncode feeds the sampler instead of an empty
 * latent, and `strength` becomes denoise. The ImageScale matters — without it
 * the output comes back at the reference's own dimensions and silently ignores
 * the shape you picked.
 */
export function buildWorkflow(req: GenRequest) {
  const look = LOOKS[String(req.look || "PHOTOREAL").toUpperCase()] || LOOKS.PHOTOREAL;
  const size = SIZES[String(req.size || "wide")] || SIZES.wide;
  const seed = Number.isFinite(req.seed as number) && (req.seed as number) > 0
    ? Math.floor(req.seed as number)
    : Math.floor(Math.random() * 1_000_000_000);

  const positive = [req.prompt.trim(), look.positive].filter(Boolean).join(", ");
  const negative = [req.negative?.trim(), look.negative, VEHICLE_ERA_NEGATIVE]
    .filter(Boolean).join(", ");

  const ref = String(req.reference || "").trim();
  // Clamped away from both ends: 0 returns the reference untouched, 1 ignores
  // it entirely — either way the slider would be lying about what it does.
  const denoise = ref
    ? Math.min(0.95, Math.max(0.15, Number(req.strength ?? 0.6)))
    : 1.0;

  const workflow: Record<string, any> = {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: look.ckpt } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: positive, clip: ["1", 1] } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["1", 1] } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: size.w, height: size.h, batch_size: 1 } },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: Math.min(60, Math.max(8, Math.round(req.steps ?? 28))),
        cfg: Math.min(12, Math.max(1, Number(req.cfg ?? 6.5))),
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise,
        model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
      },
    },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    // Subfolder keeps ROADIE's promo stills out of the shared output root.
    "7": { class_type: "SaveImage", inputs: { filename_prefix: "roadie/promo", images: ["6", 0] } },
  };

  if (ref) {
    // Basename only — the claiming machine resolves it inside its own input dir.
    workflow["8"] = { class_type: "LoadImage", inputs: { image: ref } };
    workflow["9"] = {
      class_type: "ImageScale",
      inputs: { image: ["8", 0], width: size.w, height: size.h, upscale_method: "lanczos", crop: "center" },
    };
    workflow["10"] = { class_type: "VAEEncode", inputs: { pixels: ["9", 0], vae: ["1", 2] } };
    workflow["5"].inputs.latent_image = ["10", 0];
    delete workflow["4"];   // the empty latent is dead weight once a reference drives it
  }

  return {
    workflow, seed, width: size.w, height: size.h, positive, negative,
    ckpt: look.ckpt, reference: ref || null, denoise,
    // Shape the pool expects for staged references.
    inputAssets: ref ? [{ node_id: "8", filename: ref, source: ref }] : [],
  };
}

// ---------------------------------------------------------------------------
// Motion — still to clip
// ---------------------------------------------------------------------------
//
// "Make it move": take a frame we already rendered and hand it to LTX i2v.
//
// The graph is NOT duplicated here. It's read from the template staged on the
// NAS, which ScriptLab and the storyboard lane read too — one file, one set of
// settings, one place to fix them. Copying the JSON into this file is how the
// two lanes quietly drift apart.

export const TEMPLATES_DIR = process.env.ROADIE_TEMPLATES_DIR ||
  "\\\\DXP4800UARX\\Unreal_Nas\\GenAi\\ComfyUI\\Workflows\\_ABAI_TEMPLATES";

/**
 * The engines the motion lane can drive.
 *
 * `step` is the model's latent-length rule: the frame count must satisfy
 * (length - 1) % step == 0 or the render errors outright. `fps` is what the
 * graph muxes at, so playback length is frames/fps.
 */
export const MOTION_ENGINES = {
  wan: {
    label: "WAN 2.2 — 8 seconds",
    template: "ROADIE_WAN_TI2V_v1.api.json",
    maxFrames: 97, fps: 12, step: 4, needsEnd: false,
    note: "One still plus a motion prompt. Longest and steadiest of the three.",
  },
  wan_firstlast: {
    label: "WAN 2.2 first + last",
    template: "ROADIE_WAN_FIRSTLAST_v1.api.json",
    maxFrames: 97, fps: 12, step: 4, needsEnd: true,
    note: "Two stills — WAN moves between them. Most control over where a shot ends up.",
  },
  ltx: {
    label: "LTX — 4.8 seconds",
    template: "ROADIE_LTX_I2V_v1.api.json",
    maxFrames: 121, fps: 25, step: 8, needsEnd: false,
    note: "Faster and smoother, but drifts and rarely finishes a thought.",
  },
} as const;

export type MotionEngine = keyof typeof MOTION_ENGINES;
export const DEFAULT_ENGINE: MotionEngine = "wan";

export function engineOf(name?: string) {
  const k = String(name || DEFAULT_ENGINE) as MotionEngine;
  return MOTION_ENGINES[k] ? { key: k, ...MOTION_ENGINES[k] } : { key: DEFAULT_ENGINE, ...MOTION_ENGINES[DEFAULT_ENGINE] };
}

export const MOTION_TEMPLATE = process.env.ROADIE_MOTION_TEMPLATE ||
  path.join(TEMPLATES_DIR, MOTION_ENGINES.ltx.template);

/** Kept for callers that predate the engine switch. */
export const MOTION_MAX_FRAMES = MOTION_ENGINES.wan.maxFrames;
export const MOTION_FPS = MOTION_ENGINES.wan.fps;

/**
 * Playback length of a rendered clip.
 *
 * Note this is frames/fps, NOT (frames-1)/fps. The minus-one belongs to LTX's
 * latent constraint `(length - 1) % 8 == 0`, not to the runtime — ffprobe
 * reports a 121-frame clip as 4.84s, and using 4.80 leaves the timeline
 * trimming the tail off every clip it places.
 */
export function motionSeconds(frames: number, engine?: string) {
  return frames / engineOf(engine).fps;
}

/** Snap a frame count to the engine's legal latent length. */
export function snapFrames(frames: number, engine?: string) {
  const e = engineOf(engine);
  let n = Math.round(Number(frames) || e.maxFrames);
  n = Math.min(e.maxFrames, Math.max(e.step + 1, n));
  return n - ((n - 1) % e.step);
}

/**
 * Load the staged i2v template and point it at one still.
 *
 * `frames` must satisfy (frames - 1) % 8 == 0, and the caller's motion prompt
 * describes the MOVEMENT — the picture is already decided by the start frame,
 * so re-describing it just fights the conditioning.
 */
export function buildMotionWorkflow(opts: {
  startFrame: string;          // basename staged into each ComfyUI input dir
  endFrame?: string;           // second still, first+last engines only
  engine?: string;
  motionPrompt?: string;
  seed?: number;
  frames?: number;
  episode?: string;
}) {
  const eng = engineOf(opts.engine);
  const templatePath = path.join(TEMPLATES_DIR, eng.template);

  let graph: any;
  try {
    graph = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
  } catch (e: any) {
    throw new Error(`Motion template not readable at ${templatePath} — ${e?.code || e?.message || e}`);
  }

  // Defend against a template that picked up doc keys again; ComfyUI reads
  // every top-level key as a node and rejects the lot if one isn't.
  for (const k of Object.keys(graph)) if (k.startsWith("_")) delete graph[k];

  const all = (ct: string) => Object.entries<any>(graph).filter(([, n]) => n?.class_type === ct);
  const find = (ct: string) => all(ct)[0];

  const loads = all("LoadImage");
  const ks = find("KSampler");
  // Each engine names its latent node differently; take whichever is present.
  const latent = find("LTXVImgToVideo") || find("Wan22ImageToVideoLatent") || find("WanFirstLastFrameToVideo");
  if (!loads.length || !ks || !latent) {
    throw new Error(`Template ${eng.template} is missing LoadImage / KSampler / a video-latent node.`);
  }

  // Basename only — each machine resolves it inside its own input folder.
  loads[0][1].inputs.image = path.basename(opts.startFrame);
  const inputAssets = [{
    node_id: loads[0][0],
    filename: loads[0][1].inputs.image,
    source: loads[0][1].inputs.image,
  }];

  if (eng.needsEnd) {
    if (!opts.endFrame) throw new Error(`${eng.label} needs a second still to move towards.`);
    if (!loads[1]) throw new Error(`Template ${eng.template} has no second LoadImage for the end frame.`);
    loads[1][1].inputs.image = path.basename(opts.endFrame);
    inputAssets.push({
      node_id: loads[1][0],
      filename: loads[1][1].inputs.image,
      source: loads[1][1].inputs.image,
    });
  }

  const frames = snapFrames(opts.frames ?? eng.maxFrames, eng.key);
  latent[1].inputs.length = frames;

  ks[1].inputs.seed = Number.isFinite(opts.seed as number) && (opts.seed as number) > 0
    ? Math.floor(opts.seed as number)
    : Math.floor(Math.random() * 1_000_000_000);

  // Find the real text encoder. On the first+last graph the sampler's positive
  // comes from the WAN node (which re-emits conditioning), so following that
  // link blindly would overwrite the wrong node and leave the prompt ignored.
  const motion = String(opts.motionPrompt || "").trim();
  if (motion) {
    const direct = ks[1].inputs.positive?.[0];
    const target = graph[direct]?.class_type === "CLIPTextEncode"
      ? direct
      : graph[direct]?.inputs?.positive?.[0];
    if (target && graph[target]?.class_type === "CLIPTextEncode") {
      graph[target].inputs.text = motion;
    }
  }

  // Episode folders keep a series' clips together on disk instead of one flat
  // heap — this lane feeds episodic work, not one-off promos.
  const ep = String(opts.episode || "").trim().replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  const prefix = ep ? `roadie/${ep}/motion` : "roadie/motion";
  // LTX muxes with VHS_VideoCombine, WAN with SaveVideo — set whichever exists.
  const sink = find("VHS_VideoCombine") || find("SaveVideo");
  if (sink) sink[1].inputs.filename_prefix = prefix;

  return {
    graph,
    engine: eng.key,
    frames,
    seconds: motionSeconds(frames, eng.key),
    seed: ks[1].inputs.seed,
    startFrame: loads[0][1].inputs.image,
    endFrame: eng.needsEnd ? loads[1][1].inputs.image : null,
    inputAssets,
  };
}

// ---------------------------------------------------------------------------
// Reference images
// ---------------------------------------------------------------------------
//
// A reference is the only way to pin something words can't reach — an exact
// van, a real storefront, a band's actual gear. novaRealityXL will happily
// ignore "1989 Ford Econoline" and hand back a generic modern van; a photo of
// the van settles it.
//
// Staging is the fiddly part, and it is worth understanding before changing:
// `LoadImage` reads from the ComfyUI *input* folder of whichever machine runs
// the job. Playtime's queue poller and its render bridge do NOT handle
// `input_assets` and never upload anything (checked — no upload/image call in
// either), so only VRROOM's puller would stage the file. A reference job
// claimed by Playtime would submit a LoadImage for a file that isn't there.
//
// So we push the file into every machine's input folder ourselves over SMB
// before dropping the workorder, and ALSO ship `input_assets` + a copy under
// _assets/ so the puller that does upload keeps working. Belt and braces, and
// no change required to anyone else's daemon.
export function comfyInputDirs(): string[] {
  const extra = (process.env.ROADIE_COMFY_INPUT_DIRS || "")
    .split(path.delimiter).map(s => s.trim()).filter(Boolean);
  return [...new Set([
    ...extra,
    "\\\\PLAYTIME\\D\\AI\\ComfyUI\\input",   // Playtime's two GPUs render from here
    "C:\\FIOS\\ComfyUI\\input",              // this box
    "C:\\ComfyUI\\input",
    "\\\\DXP4800UARX\\Unreal_Nas\\GenAi\\ComfyUI\\input",
  ])];
}

/** Where ROADIE keeps its own copy of uploaded references. */
export function refStoreDir() {
  const d = process.env.ROADIE_REF_DIR || path.join(process.cwd(), "data", "studio_refs");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Copy a reference into every ComfyUI input folder we can reach, plus the
 * pool's _assets/<workorder_id>/ staging dir.
 *
 * Returns the dirs that took it. An empty list means no machine could see the
 * file, and the caller must refuse the job rather than queue a render that is
 * guaranteed to fail on a missing image.
 */
export function stageReference(localPath: string, basename: string, workorderId?: string) {
  const staged: string[] = [];
  const failed: string[] = [];
  let bytes: Buffer;
  try { bytes = fs.readFileSync(localPath); } catch (e: any) {
    return { staged, failed: [`could not read ${localPath}: ${e?.message || e}`] };
  }

  const targets = [...comfyInputDirs()];
  if (workorderId) targets.push(path.join(JOBS_ROOT, "_assets", workorderId));

  for (const dir of targets) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Write-then-rename so a poller can't read a half-copied image.
      const tmp = path.join(dir, `.${basename}.tmp`);
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, path.join(dir, basename));
      staged.push(dir);
    } catch (e: any) {
      failed.push(`${dir}: ${e?.code || e?.message || e}`);
    }
  }
  return { staged, failed };
}

/** Fresh every time — the pool silently drops a workorder_id it has seen. */
export function newWorkorderId() {
  return `roadie_promo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Write a workorder into jobs/pending. Written to a temp name first and then
 * renamed, so a poller can never claim a half-written file.
 *
 * `target` pins the GPU. SDXL goes to a 4070 — the 3060 is 8GB and chokes on
 * a full-size XL image.
 */
export function dropWorkorder(opts: {
  workorderId: string; graph: any; name: string; target?: "4070" | "3060" | "any";
  inputAssets?: any[];
}) {
  const { workorderId, graph, name } = opts;
  const assets = opts.inputAssets || [];
  const scene = { name, workflow: graph, prompt: graph };
  const record = {
    workorder_id: workorderId,
    job_id: workorderId,          // the puller reads _assets/<job_id>/
    source: "roadie-studio",
    kind: assets.length ? "i2i" : "t2i",
    target: opts.target || "4070",
    name,
    created: Date.now() / 1000,
    // Carried for pullers that stage assets themselves. We also copy the file
    // straight into each machine's input dir, because Playtime's poller and
    // bridge ignore this field entirely.
    input_assets: assets,
    // The bridge looks for the graph in all three places. Publishing it once
    // is the single most common way to get a workorder rejected.
    workflow: graph,
    prompt: graph,
    scenes: [scene],
  };

  fs.mkdirSync(DROP_DIR, { recursive: true });
  const dest = path.join(DROP_DIR, `${workorderId}.json`);
  const tmp = path.join(DROP_DIR, `.${workorderId}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), "utf-8");
  fs.renameSync(tmp, dest);
  return dest;
}

/**
 * Pull the produced file out of a result manifest.
 *
 * Stills land under `images`, but VHS_VideoCombine reports its mp4 under
 * `gifs` — same shape, different key, and a poller that only reads `images`
 * sees a finished video job as "finished with no output" and calls it failed.
 */
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|gif)$/i;

function firstOutput(result: any) {
  const outputs = result?.history?.outputs || {};

  // Scan EVERY key rather than a whitelist. Stills come back under `images`,
  // VHS_VideoCombine uses `gifs`, and core SaveVideo uses something else again.
  // A whitelist here is how a finished render gets reported as failed — which
  // is exactly what happened before `gifs` was added.
  const found: any[] = [];
  for (const nodeOut of Object.values<any>(outputs || {})) {
    for (const arr of Object.values<any>(nodeOut || {})) {
      if (!Array.isArray(arr)) continue;
      for (const f of arr) {
        if (f && typeof f === "object" && f.filename) {
          found.push({
            filename: String(f.filename),
            subfolder: String(f.subfolder || ""),
            type: String(f.type || "output"),
            format: String(f.format || ""),
            kind: (VIDEO_EXT.test(String(f.filename)) || String(f.format || "").startsWith("video/"))
              ? "video" : "image",
          });
        }
      }
    }
  }
  if (!found.length) return null;
  // A video job also emits a poster frame; prefer the moving one.
  return found.find(f => f.kind === "video") || found[0];
}

/**
 * Look for our workorder's outcome. Read-only: the poller renames the file to
 * `<id>.<gpu>.<ts>.json` and writes `<that>.result.json` beside it, so we match
 * on the id prefix rather than an exact name.
 */
export function pollPool(workorderId: string): {
  status: "queued" | "done" | "failed"; images: any[]; error?: string;
} {
  const scan = (dir: string) => {
    try {
      return fs.readdirSync(dir)
        .filter(f => f.startsWith(workorderId) && f.endsWith(".result.json"))
        .map(f => path.join(dir, f));
    } catch { return [] as string[]; }
  };

  for (const file of [...scan(DONE_DIR), ...scan(FAILED_DIR)]) {
    let data: any;
    try { data = JSON.parse(fs.readFileSync(file, "utf-8")); } catch { continue; }
    const out = firstOutput(data);
    if (out) return { status: "done", images: [out] };
    // A manifest with no file is a finished-but-empty render. Calling that
    // "done" would hand the studio a broken picture.
    return {
      status: "failed", images: [],
      error: String(data?.error || "The render finished without producing a file."),
    };
  }

  // Still in pending/running, or the poller hasn't picked it up yet.
  return { status: "queued", images: [] };
}

/** Absolute path of a produced image, first output root where it exists. */
export function resolveOutputImage(subfolder: string, filename: string): string | null {
  if (!filename) return null;
  // Manifests carry Windows separators inside the subfolder value.
  const sub = String(subfolder || "").replace(/[\\/]+/g, path.sep);
  for (const base of outputBases()) {
    const cand = path.join(base, sub, filename);
    try { if (fs.existsSync(cand)) return cand; } catch { /* unreachable root */ }
  }
  return null;
}

/** Is the NAS queue actually mounted from here? */
export function poolReachable(): { ok: boolean; detail: string } {
  try {
    fs.accessSync(JOBS_ROOT);
    return { ok: true, detail: JOBS_ROOT };
  } catch (e: any) {
    return { ok: false, detail: `Render queue not reachable at ${JOBS_ROOT} — ${e?.code || e?.message || e}` };
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function genRow(id: number) {
  return one<any>("SELECT * FROM studio_gens WHERE id=?", id);
}

export function recentGens(limit = 60) {
  return all<any>("SELECT * FROM studio_gens ORDER BY id DESC LIMIT ?", limit);
}

/** Local URL for a finished image — the browser can't reach the fleet directly. */
export function imageUrl(genId: number, index = 0) {
  return `/api/admin/studio/image?gen=${genId}&i=${index}`;
}

export function touchProject(id: number) {
  run("UPDATE studio_projects SET updated_at=datetime('now') WHERE id=?", id);
}

/** URL-safe share slug for an offer. */
export function offerToken() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
