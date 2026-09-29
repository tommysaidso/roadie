import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { listSfx, sfxPath, sfxUrl, sfxReachable, suggestSfx, SFX_DIR } from "@/lib/sfx";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".aif": "audio/aiff",
  ".aiff": "audio/aiff", ".m4a": "audio/mp4", ".flac": "audio/flac",
  ".ogg": "audio/ogg",
};

// The sound bank. GET lists it, GET ?file= serves one clip.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The sound bank is operator-only.");

  const file = new URL(req.url).searchParams.get("file");

  if (!file) {
    const reach = sfxReachable();
    const items = listSfx();
    return NextResponse.json({
      ok: reach.ok,
      dir: SFX_DIR,
      error: reach.ok ? null : reach.detail,
      folders: [...new Set(items.map(i => i.folder).filter(Boolean))].sort(),
      items: items.map(i => ({ ...i, url: sfxUrl(i.id) })),
    });
  }

  const full = sfxPath(file);
  if (!full) return NextResponse.json({ error: "No such sound in the bank." }, { status: 404 });

  const ext = (full.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";

  let size = 0;
  try { size = fs.statSync(full).size; } catch {
    return NextResponse.json({ error: "Could not read that sound." }, { status: 502 });
  }

  // Ranges, same as video: without them scrubbing an effect is a re-download,
  // and some browsers will not start a wav at all.
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      if (Number.isNaN(start) || start > end || start >= size) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const fd = fs.openSync(full, "r");
      const len = end - start + 1;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      fs.closeSync(fd);
      return new NextResponse(new Uint8Array(buf), {
        status: 206,
        headers: {
          "Content-Type": type, "Content-Length": String(len),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          // The library is read-only and never changes under us.
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  }

  try {
    const buf = fs.readFileSync(full);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type, "Content-Length": String(size),
        "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read that sound: ${e?.message || e}` }, { status: 502 });
  }
}

// Ask the AI to pick and place. The answer is a suggestion list, not an edit —
// nothing is committed until the operator takes it.
export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The sound bank is operator-only.");

  const b = await req.json().catch(() => ({} as any));
  const brief = String(b?.brief || "").trim();
  if (!brief) return NextResponse.json({ error: "Say what the promo is first." }, { status: 400 });

  const seconds = Math.max(1, Math.min(600, Number(b?.seconds) || 15));
  const beats = Array.isArray(b?.beats)
    ? b.beats.slice(0, 40).map((x: any) => ({ t: Number(x?.t) || 0, what: String(x?.what || "").slice(0, 160) }))
    : [];

  const catalogue = listSfx();
  if (!catalogue.length) {
    return NextResponse.json({ error: sfxReachable().detail }, { status: 503 });
  }

  const picks = await suggestSfx({ brief, seconds, beats, catalogue });
  if (!picks.length) {
    return NextResponse.json({
      error: "No pick came back — the bank is all there, choose by hand and it works the same.",
      picks: [],
    }, { status: 502 });
  }
  return NextResponse.json({ picks: picks.map(p => ({ ...p, url: sfxUrl(p.id) })) });
}
