// RUNPOD — the away-from-the-desk lane.
//
// The whole pool model assumes Ben's cards are switched on and on the LAN.
// When he is on the road that assumption dies, and this is the answer: the
// same "generate a picture / clip here" buttons, run on someone else's GPU.
//
// Like Grok, it is metered, so it lives under the same rule — picked by name,
// never a silent fallback when the pool is asleep. The difference is that Grok
// writes from a prompt only, while VIDU takes one of your own stills and moves
// it, which is what the storyboard lane actually needs.
//
// Serverless contract (RunPod's standard shape, same for every endpoint):
//
//   POST /v2/{endpoint}/run          {input:{…}} -> {id, status:"IN_QUEUE"}
//   GET  /v2/{endpoint}/status/{id}              -> {status, output}
//
// status walks IN_QUEUE -> IN_PROGRESS -> COMPLETED | FAILED | CANCELLED.
//
// Two things learned by running real jobs against these, both of which cost an
// hour if you assume otherwise:
//
//   1. /health answers 401 on public endpoints even with a good key. It is NOT
//      a usable liveness check here — only /run and /status are. Do not "fix"
//      a working lane because health says unauthorized.
//   2. Each public endpoint has its OWN scoped key. One account key does not
//      open both, which is why the keys are per-lane below.
//
// Observed output, confirmed on completed jobs:
//   VIDU 5s 720p -> {"output":{"cost":0.75,"result":"https://….mp4"}}
//   WAN 2.6 t2i  -> {"output":{"cost":0.03,"result":"https://….png"}}
// `cost` is plain dollars, and `result` is the media URL.

const BASE = "https://api.runpod.ai/v2";

export const RUNPOD_ENDPOINTS = {
  vidu: {
    slug: process.env.RUNPOD_VIDU_ENDPOINT || "vidu-q3-i2v",
    keyEnv: "RUNPOD_VIDU_KEY",
    label: "VIDU Q3 — image to video",
    kind: "video" as const,
    seconds: 5,
    usd: 0.75,                       // measured on a 5s 720p job
    note: "Moves one of your stills. Runs in the cloud, so it works with every machine at home switched off.",
  },
  wan25: {
    slug: process.env.RUNPOD_WAN25_ENDPOINT || "wan-2-5",
    keyEnv: "RUNPOD_WAN25_KEY",
    label: "WAN 2.5 — image to video",
    kind: "video" as const,
    seconds: 5,
    usd: 0.25,                       // 480p 5s; see WAN25_PRICE for the rest
    note: "Moves one of your stills, and it can lip-sync to an audio file. Sizes from 480p to 1080p, 5 or 10 seconds.",
  },
  wan26: {
    slug: process.env.RUNPOD_WAN26_ENDPOINT || "wan-2-6-t2i",
    keyEnv: "RUNPOD_WAN26_KEY",
    label: "WAN 2.6 — picture from a prompt",
    kind: "image" as const,
    seconds: 0,
    usd: 0.03,                       // measured on a 1024 job
    note: "A still from a prompt. This endpoint is text-to-IMAGE, not video.",
  },
} as const;

export type RunpodLane = keyof typeof RUNPOD_ENDPOINTS;

/**
 * WAN 2.5 bills per request by size AND length, so the price has to be shown
 * before the button is pressed rather than discovered afterwards. Straight from
 * the endpoint's own pricing table.
 */
export const WAN25_PRICE: Record<string, Record<number, number>> = {
  "480p":  { 5: 0.25, 10: 0.50 },
  "720p":  { 5: 0.50, 10: 1.00 },
  "1080p": { 5: 0.75, 10: 1.50 },
};
export const wan25Price = (size: string, secs: number) =>
  WAN25_PRICE[size]?.[secs] ?? null;

/** Each public endpoint carries its own key; the account key opens neither. */
export function runpodKey(lane?: RunpodLane) {
  if (lane) {
    const scoped = process.env[RUNPOD_ENDPOINTS[lane].keyEnv];
    if (scoped) return scoped;
  }
  return process.env.RUNPOD_API_KEY || "";
}

export function runpodReachable(lane?: RunpodLane): { ok: boolean; detail: string } {
  const k = runpodKey(lane);
  if (k) return { ok: true, detail: "RunPod key present" };
  return {
    ok: false,
    detail: lane
      ? `No ${RUNPOD_ENDPOINTS[lane].keyEnv} set — each RunPod endpoint needs its own key.`
      : "No RunPod key set.",
  };
}

export type RunpodJob = {
  status: "pending" | "done" | "failed";
  url?: string;
  seconds?: number;
  usd?: number;                      // what the job actually cost, per RunPod
  error?: string;
  raw?: any;
};

/**
 * Dig a media URL out of whatever the endpoint returned.
 *
 * Every RunPod model author picks their own output field — `video_url`, `url`,
 * `output.video`, a bare string, a list of them. Rather than guess one and ship
 * a lane that silently reports success with nothing to show, this walks the
 * payload for the first thing that looks like a media URL or a data URI.
 */
export function videoUrlFrom(out: any): string | undefined {
  const seen = new Set<any>();
  const looksLikeMedia = (s: string) =>
    /^data:(video|image)\//i.test(s) ||
    (/^https?:\/\//i.test(s) && /\.(mp4|webm|mov|png|jpe?g|webp)(\?|$)/i.test(s));

  const walk = (v: any, depth = 0): string | undefined => {
    if (v == null || depth > 6) return;
    if (typeof v === "string") return looksLikeMedia(v) ? v : undefined;
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    // Prefer the obvious names before falling back to a blind sweep.
    // `result` first: that is the field both live endpoints actually use.
    for (const k of ["result", "video_url", "videoUrl", "video", "url", "image_url", "image", "output"]) {
      const hit = walk((v as any)[k], depth + 1);
      if (hit) return hit;
    }
    for (const val of Array.isArray(v) ? v : Object.values(v)) {
      const hit = walk(val, depth + 1);
      if (hit) return hit;
    }
  };
  return walk(out);
}

/** Queue a job on one of the lanes. */
export async function runpodQueue(lane: RunpodLane, input: Record<string, any>):
  Promise<{ id?: string; error?: string }> {
  const key = runpodKey(lane);
  if (!key) return { error: runpodReachable(lane).detail };
  const ep = RUNPOD_ENDPOINTS[lane];
  if (!ep) return { error: `Unknown RunPod lane ${lane}.` };

  try {
    const r = await fetch(`${BASE}/${ep.slug}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(60000),
    });
    const d: any = await r.json().catch(() => ({}));
    if (r.status === 401) {
      return { error: `RunPod refused ${ep.slug} — check ${ep.keyEnv} is the key for THAT endpoint.` };
    }
    if (!r.ok) return { error: d?.error || d?.detail || `RunPod said ${r.status}` };
    if (!d?.id) return { error: "RunPod accepted it but returned no job id." };
    return { id: String(d.id) };
  } catch (e: any) {
    return { error: `Couldn't reach RunPod: ${e?.message || e}` };
  }
}

/** Where a queued job has got to. */
export async function runpodPoll(lane: RunpodLane, id: string): Promise<RunpodJob> {
  const key = runpodKey(lane);
  if (!key) return { status: "failed", error: runpodReachable(lane).detail };
  const ep = RUNPOD_ENDPOINTS[lane];
  if (!ep) return { status: "failed", error: `Unknown RunPod lane ${lane}.` };

  try {
    const r = await fetch(`${BASE}/${ep.slug}/status/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30000),
    });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) return { status: "failed", error: d?.error || `RunPod said ${r.status}` };

    const st = String(d?.status || "").toUpperCase();
    if (st === "COMPLETED") {
      const url = videoUrlFrom(d?.output);
      if (!url) {
        // Hand the payload back rather than pretending it worked — this is the
        // one shape that has not been seen on a live job.
        return { status: "failed", error: "RunPod finished but no media URL was found in the output.", raw: d?.output };
      }
      return {
        status: "done", url,
        seconds: ep.seconds || undefined,
        usd: Number(d?.output?.cost) || undefined,
      };
    }
    if (st === "FAILED" || st === "CANCELLED" || st === "TIMED_OUT") {
      return { status: "failed", error: d?.error || `RunPod job ${st.toLowerCase()}` };
    }
    return { status: "pending" };
  } catch (e: any) {
    return { status: "failed", error: `Couldn't reach RunPod: ${e?.message || e}` };
  }
}
