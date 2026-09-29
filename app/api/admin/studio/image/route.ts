import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureStudioSchema, genRow, resolveOutputImage } from "@/lib/studio";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm",
};

// Serve a finished render — still or clip — off the shared output root.
//
// The pool is a pull model, so there is no node to proxy: the file is on the
// NAS (or a local puller's disk). We only ever serve a subfolder+filename this
// DB recorded from a manifest for a job we dropped, so the caller can't steer
// this at an arbitrary path.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const url = new URL(req.url);
  const genId = Number(url.searchParams.get("gen"));
  const index = Number(url.searchParams.get("i") || 0);
  if (!genId) return NextResponse.json({ error: "Pass ?gen=<id>" }, { status: 400 });

  const row = genRow(genId);
  if (!row) return NextResponse.json({ error: "No such generation." }, { status: 404 });

  let files: any[] = [];
  try { files = JSON.parse(row.images || "[]"); } catch { files = []; }
  const f = files[index];
  if (!f?.filename) return NextResponse.json({ error: "That render isn't ready yet." }, { status: 404 });

  const file = resolveOutputImage(f.subfolder || "", f.filename);
  if (!file) {
    return NextResponse.json({
      error: `Render finished but ${f.subfolder ? f.subfolder + "\\" : ""}${f.filename} ` +
             `wasn't found under any known output root. If it rendered on a machine that ` +
             `writes locally, add that path to ROADIE_RENDER_COMFY_OUTPUT_EXTRA.`,
    }, { status: 404 });
  }

  const ext = (file.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  // Outputs never change once written, so cache hard.
  const cache = "private, max-age=31536000, immutable";

  let size: number;
  try { size = fs.statSync(file).size; } catch (e: any) {
    return NextResponse.json({ error: `Could not stat ${file}: ${e?.message || e}` }, { status: 502 });
  }

  // Video needs byte ranges: without a 206 the browser can't seek, and some
  // players refuse to start at all. Images are small enough to send whole.
  const range = req.headers.get("range");
  if (range && type.startsWith("video/")) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      if (Number.isNaN(start) || start > end || start >= size) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      try {
        const fd = fs.openSync(file, "r");
        const len = end - start + 1;
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, start);
        fs.closeSync(fd);
        return new NextResponse(new Uint8Array(buf), {
          status: 206,
          headers: {
            "Content-Type": type,
            "Content-Length": String(len),
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": cache,
          },
        });
      } catch (e: any) {
        return NextResponse.json({ error: `Could not read ${file}: ${e?.message || e}` }, { status: 502 });
      }
    }
  }

  try {
    const buf = fs.readFileSync(file);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": cache,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read ${file}: ${e?.message || e}` }, { status: 502 });
  }
}
