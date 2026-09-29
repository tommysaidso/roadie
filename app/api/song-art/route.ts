import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { requireUser, ownsBand, forbid, rateLimit } from "@/lib/guard";
import {
  songArtAvailable, suggestPrompts, fallbackPrompts,
  generateArt, startClip, pollClip, type SongSeed,
} from "@/lib/songart";
import { saveImage, saveClip } from "@/lib/songfiles";
export const dynamic = "force-dynamic";

// GET  ?title=&genre=&line=&band_id=   -> prompt ideas (cheap, no image)
// POST { action: "image" | "clip" | "poll" }
//
// Image and clip generation cost money per call, so both require a signed-in
// user who owns the band, and both are rate limited.

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const title = (q.get("title") || "").trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const bandId = q.get("band_id");
  const band: any = bandId ? one("SELECT name,home_city,genre FROM bands WHERE id=?", Number(bandId)) : null;

  const seed: SongSeed = {
    title,
    genre: (q.get("genre") || band?.genre || "").trim() || undefined,
    line: (q.get("line") || "").trim() || undefined,
    band: band?.name,
    city: band?.home_city,
  };

  const ai = await suggestPrompts(seed);
  return NextResponse.json({
    available: songArtAvailable(),
    prompts: ai.length ? ai : fallbackPrompts(seed),
    source: ai.length ? "ai" : "fallback",
    // Be explicit that we never had the lyrics — the band supplies the line.
    lyrics_known: false,
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  const b = await req.json().catch(() => ({}));
  const action = b.action || "image";

  if (action === "poll") {
    if (!b.operation) return NextResponse.json({ error: "operation is required" }, { status: 400 });
    const res = await pollClip(String(b.operation));
    // Once it lands, pull it off Google (the URI needs our key), brand it and
    // file it — that's what makes it shareable and traceable.
    if (res.ok && "done" in res && res.done) {
      const saved = await saveClip(res.uri, {
        bandId: b.band_id ? Number(b.band_id) : undefined,
        title: b.title, hook: b.hook, prompt: b.prompt, operation: String(b.operation),
      });
      if (saved) {
        return NextResponse.json({
          ok: true, done: true, share_id: saved.shareId, watermarked: saved.watermarked,
          url: `/api/song-art/${saved.shareId}`,
          download: `/api/song-art/${saved.shareId}?dl=1`,
        });
      }
    }
    return NextResponse.json(res);
  }

  if (b.band_id && !ownsBand(g.user, b.band_id)) {
    return forbid("You can only make art for your own band.");
  }
  if (!b.prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  if (action === "clip") {
    const limited = rateLimit(req, "song-clip", 4); if (limited) return limited;
    return NextResponse.json(await startClip(String(b.prompt), b.image));
  }

  const limited = rateLimit(req, "song-art", 20); if (limited) return limited;
  const art = await generateArt(String(b.prompt), b.aspect || "1:1");
  if (!art.ok) return NextResponse.json(art, { status: 502 });

  // The poster embeds the raw data URL (clean, no mark, so type sits on top).
  // The saved copy is the branded one people share.
  const saved = saveImage(art.dataUrl, {
    bandId: b.band_id ? Number(b.band_id) : undefined,
    title: b.title, hook: b.hook, prompt: String(b.prompt),
  });
  return NextResponse.json({
    ...art,
    share_id: saved?.shareId,
    watermarked: saved?.watermarked ?? false,
    url: saved ? `/api/song-art/${saved.shareId}` : undefined,
    download: saved ? `/api/song-art/${saved.shareId}?dl=1` : undefined,
  });
}
