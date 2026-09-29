// Song -> art -> clip. A band picks one of their works and gets a hero image
// (and optionally a short clip) they can drop straight onto a gig poster.
//
// IMPORTANT about lyrics: neither ROADIE nor mymymy stores lyric TEXT — the
// Work model carries only a `lyrics_hash`. So we cannot read "the first line"
// of a song on our own. What we DO have is title, primary genre, the band's
// genres, and their city. The opening line is therefore an OPTIONAL input the
// band types in; when they give it, it drives the image. When they don't, we
// still produce usable prompts from title + genre.
//
// Everything is defensive: any failure returns a reason string, never throws,
// so the poster studio degrades to "write your own prompt".

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-fast-generate-preview";
const HOST = "https://generativelanguage.googleapis.com/v1beta";

function keys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean) as string[];
}
export function songArtAvailable(): boolean { return keys().length > 0; }

// ---- BYOA: bring your own API ----------------------------------------
// Generation is metered by the provider, so the platform key is a sampler, not
// a tap. A band gets out from under that allowance two ways:
//   key      — their own credentials on a provider we already speak
//   endpoint — a box they run themselves (ComfyUI, RunPod, fal)
// Either way it stops counting against the free tier; a self-hosted endpoint
// never touches our billing at all. Credentials are write-only: they go in
// through the API and are never read back out to a client.
export const FREE_MONTHLY = Number(process.env.SONGART_FREE_MONTHLY || 6);

export type BandApi = { provider: string; key: string | null; baseUrl: string | null };

export type KeyPlan = {
  provider: string;     // gemini | fal | comfyui | runpod | openai_compatible
  keys: string[];
  baseUrl: string | null;
  byoa: boolean;        // running on the band's own key or their own endpoint
  selfHosted: boolean;  // their box, their electricity — never metered
  used: number;         // platform-key generations this month
  limit: number;
  blocked: boolean;     // out of free platform quota with nothing of their own
};

/**
 * Decide who pays for this generation. A band can bring a KEY for a provider we
 * speak, or a whole ENDPOINT they run themselves — either way it stops counting
 * against the free platform allowance. The DB lookup lives in lib/songfiles so
 * this module stays dependency-free.
 */
export function planFor(api: BandApi | null, usedThisMonth: number, limit = FREE_MONTHLY): KeyPlan {
  if (api && (api.key || api.baseUrl)) {
    return {
      provider: api.provider || "gemini",
      keys: api.key ? [api.key] : [],
      baseUrl: api.baseUrl,
      byoa: true,
      selfHosted: !!api.baseUrl,
      used: usedThisMonth, limit, blocked: false,
    };
  }
  const platform = keys();
  return {
    provider: "gemini",
    keys: platform,
    baseUrl: null,
    byoa: false,
    selfHosted: false,
    used: usedThisMonth,
    limit,
    blocked: !platform.length || usedThisMonth >= limit,
  };
}

export type SongSeed = {
  title: string;
  genre?: string;
  line?: string;        // opening lines OR the chorus — whichever carries the image
  band?: string;
  city?: string;
  mood?: string;
};

// Poster art is a backdrop — the poster lays its own type over the top, so the
// generated image must not contain words or the two fight each other.
const NO_TEXT = "No text, no lettering, no watermark, no logo anywhere in the image.";

function seedLines(s: SongSeed): string {
  return [
    `Song title: ${s.title}`,
    s.genre ? `Genre: ${s.genre}` : "",
    s.line ? `Lyric hook (opening lines or chorus): "${s.line}"` : "",
    s.band ? `Artist: ${s.band}` : "",
    s.city ? `From: ${s.city}` : "",
    s.mood ? `Mood: ${s.mood}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Ask the text model for a few distinct visual directions for this song.
 * Returns [] on any failure — the caller offers a manual prompt box instead.
 */
export async function suggestPrompts(s: SongSeed, count = 3): Promise<string[]> {
  const ks = keys();
  if (!ks.length || !s.title) return [];
  const system =
    "You are an art director for live-music posters. Given a song, return distinct, " +
    "concrete VISUAL scene descriptions suitable for an image generator. " +
    "Each is one sentence, describes a single scene with a subject, a setting, light and mood, " +
    "and names a photographic or illustration style. Never include song lyrics verbatim, " +
    "never describe text or lettering, never name real living people. " +
    "Return ONLY a JSON array of strings, no prose, no markdown fence.";
  const user = `${seedLines(s)}\n\nGive ${count} different visual directions for a poster backdrop.`;

  for (const key of ks) {
    try {
      const r = await fetch(`${HOST}/models/${TEXT_MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.9,
            // 2.5-flash spends the output budget on thinking tokens first, so a
            // small cap returns truncated JSON. Thinking off + room to finish.
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
      const parsed = JSON.parse(txt.replace(/^```(?:json)?|```$/g, "").trim());
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, count);
      }
    } catch { /* try next key */ }
  }
  return [];
}

/** Deterministic fallback so the band always gets something to start from. */
export function fallbackPrompts(s: SongSeed): string[] {
  const g = (s.genre || "indie").toLowerCase();
  const where = s.city ? `near ${s.city}` : "on a back road";
  const base = s.line ? `A scene evoking "${s.line}"` : `A scene evoking the song "${s.title}"`;
  return [
    `${base}, ${where} at golden hour, wide cinematic shot, warm film grain, ${g} album-art mood.`,
    `${base}, shot at night under a single practical light, deep shadows, moody ${g} atmosphere.`,
    `${base}, bold graphic illustration, limited three-colour palette, screen-print texture, ${g} gig-poster style.`,
  ];
}

export type ArtResult =
  | { ok: true; dataUrl: string; mime: string; bytes: number; prompt: string }
  | { ok: false; error: string };

/** Generate the hero image. Returns a data URL the poster can embed directly. */
export async function generateArt(prompt: string, aspect = "1:1"): Promise<ArtResult> {
  const ks = keys();
  if (!ks.length) return { ok: false, error: "No image key configured on this server." };
  if (!prompt?.trim()) return { ok: false, error: "Need a prompt." };

  const full = `${prompt.trim()}\n\n${NO_TEXT}`;
  let lastErr = "Image generation failed.";
  for (const key of ks) {
    try {
      const r = await fetch(`${HOST}/models/${IMAGE_MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: full }] }],
          generationConfig: { imageConfig: { aspectRatio: aspect } },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = d?.error?.message || `Image API returned ${r.status}.`; continue; }
      const parts = d?.candidates?.[0]?.content?.parts || [];
      const hit = parts.find((p: any) => p.inlineData || p.inline_data);
      const inline = hit && (hit.inlineData || hit.inline_data);
      if (!inline?.data) {
        lastErr = parts.find((p: any) => p.text)?.text?.slice(0, 200)
          || "The model returned no image (the prompt may have been refused).";
        continue;
      }
      const mime = inline.mimeType || inline.mime_type || "image/png";
      return {
        ok: true, mime, prompt: prompt.trim(),
        bytes: Math.round((inline.data.length * 3) / 4),
        dataUrl: `data:${mime};base64,${inline.data}`,
      };
    } catch (e: any) {
      lastErr = e?.name === "TimeoutError" ? "Image generation timed out." : (e?.message || lastErr);
    }
  }
  return { ok: false, error: lastErr };
}

export type ClipResult =
  | { ok: true; operation: string }
  | { ok: false; error: string };

/**
 * Kick off a short video. Veo is long-running and metered per second of output,
 * so this only STARTS the job and hands back an operation name to poll — it is
 * never fired automatically, only from an explicit button.
 */
export async function startClip(prompt: string, imageDataUrl?: string): Promise<ClipResult> {
  const ks = keys();
  if (!ks.length) return { ok: false, error: "No video key configured on this server." };

  const body: any = { instances: [{ prompt: `${prompt.trim()}\n\n${NO_TEXT}` }] };
  const m = imageDataUrl?.match(/^data:([^;]+);base64,(.+)$/);
  if (m) body.instances[0].image = { bytesBase64Encoded: m[2], mimeType: m[1] };

  for (const key of ks) {
    try {
      const r = await fetch(`${HOST}/models/${VIDEO_MODEL}:predictLongRunning?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 429) continue; return { ok: false, error: d?.error?.message || `Video API returned ${r.status}.` }; }
      if (d?.name) return { ok: true, operation: d.name };
      return { ok: false, error: "Video job did not start." };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Video request failed." };
    }
  }
  return { ok: false, error: "Video quota exhausted on all keys." };
}

/** Poll a Veo job. Returns done=false until the clip is ready. */
export async function pollClip(operation: string): Promise<
  { ok: true; done: false } | { ok: true; done: true; uri: string } | { ok: false; error: string }
> {
  const ks = keys();
  if (!ks.length) return { ok: false, error: "No video key configured." };
  for (const key of ks) {
    try {
      const r = await fetch(`${HOST}/${operation}?key=${key}`, { signal: AbortSignal.timeout(20000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 429) continue; return { ok: false, error: d?.error?.message || `Poll returned ${r.status}.` }; }
      if (!d.done) return { ok: true, done: false };
      if (d.error) return { ok: false, error: d.error.message || "Video job failed." };
      const v = d?.response?.generateVideoResponse?.generatedSamples?.[0]?.video
        || d?.response?.generatedSamples?.[0]?.video;
      if (v?.uri) return { ok: true, done: true, uri: v.uri };
      return { ok: false, error: "Job finished but returned no video." };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Poll failed." };
    }
  }
  return { ok: false, error: "Poll quota exhausted." };
}
