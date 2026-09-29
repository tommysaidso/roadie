// GROK IMAGINE — the cloud video lane.
//
// Every other lane in this studio runs on hardware Ben already owns: a
// workorder goes into the NAS pool, a card on the LAN picks it up, and it
// costs nothing but electricity. This one is different — it is xAI's, it is
// metered, and every clip is real money.
//
// So it is never a fallback. Nothing degrades into Grok when WAN is busy or
// LTX fails; it only ever runs because someone picked it by name, and the
// price is on the button before they do. That is a standing rule here, and
// this file is the most tempting place to break it.
//
// Contract, confirmed against the live API rather than the docs:
//
//   POST /v1/videos/generations  {prompt, model}  -> {request_id}
//   GET  /v1/videos/{request_id}                  -> {status, progress,
//                                                     video:{url, duration}}
//
// Note the asymmetry: you submit to /videos/generations but poll /videos/{id}.
// Polling /videos/generations/{id} is a 404 — an easy hour to lose.

const BASE = "https://api.x.ai/v1";

export const GROK_VIDEO_MODELS = {
  "grok-imagine-video": { label: "Grok Imagine", seconds: 8 },
  "grok-imagine-video-1.5": { label: "Grok Imagine 1.5", seconds: 8 },
} as const;

export const GROK_DEFAULT_MODEL = "grok-imagine-video";

/**
 * What one clip costs.
 *
 * The API reports `cost_in_usd_ticks`; an 8-second clip came back at
 * 4,000,000,000. Read as 1e-10 USD per tick that is $0.40, which is the right
 * order for an 8-second generation. The scale is inferred from one observation,
 * not documented, so the raw tick count is kept and shown alongside — better a
 * number he can check than a confident wrong dollar figure.
 */
export const USD_PER_TICK = 1e-10;
export const usdFromTicks = (ticks: number) =>
  Number.isFinite(ticks) ? ticks * USD_PER_TICK : null;

export function grokKey() {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
}

export function grokReachable(): { ok: boolean; detail: string } {
  return grokKey()
    ? { ok: true, detail: "xAI key present" }
    : { ok: false, detail: "No XAI_API_KEY set — Grok is the only lane that needs one." };
}

export type GrokJob = {
  status: "pending" | "done" | "failed";
  progress: number;
  url?: string;
  seconds?: number;
  ticks?: number;
  error?: string;
};

/** Queue a clip. Returns the request id to poll. */
export async function grokQueue(prompt: string, model = GROK_DEFAULT_MODEL): Promise<{ id?: string; error?: string }> {
  const key = grokKey();
  if (!key) return { error: grokReachable().detail };
  if (!prompt.trim()) return { error: "Grok needs a prompt." };

  try {
    const r = await fetch(`${BASE}/videos/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim(), model }),
      signal: AbortSignal.timeout(60000),
    });
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: data?.error || `xAI said ${r.status}` };
    if (!data?.request_id) return { error: "xAI accepted it but returned no request id." };
    return { id: String(data.request_id) };
  } catch (e: any) {
    return { error: `Couldn't reach xAI: ${e?.message || e}` };
  }
}

/** Where a queued clip has got to. */
export async function grokPoll(id: string): Promise<GrokJob> {
  const key = grokKey();
  if (!key) return { status: "failed", progress: 0, error: grokReachable().detail };
  try {
    const r = await fetch(`${BASE}/videos/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30000),
    });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) return { status: "failed", progress: 0, error: d?.error || `xAI said ${r.status}` };

    const status = String(d?.status || "pending");
    if (status === "done") {
      const url = d?.video?.url;
      if (!url) return { status: "failed", progress: 100, error: "xAI reported done with no video." };
      return {
        status: "done", progress: 100, url,
        seconds: Number(d?.video?.duration) || 8,
        ticks: Number(d?.usage?.cost_in_usd_ticks) || undefined,
      };
    }
    // Anything that is not pending and not done is a dead job, not a slow one.
    if (status !== "pending" && status !== "processing") {
      return { status: "failed", progress: Number(d?.progress) || 0, error: d?.error || `xAI status: ${status}` };
    }
    return { status: "pending", progress: Number(d?.progress) || 0 };
  } catch (e: any) {
    return { status: "failed", progress: 0, error: `Couldn't reach xAI: ${e?.message || e}` };
  }
}
