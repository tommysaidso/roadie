import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import path from "node:path";
import { listStock, stockPath, stockUrl, stockReachable, STOCK_DIR } from "@/lib/stock";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mov": "video/quicktime", ".m4v": "video/mp4",
};

// The stock shelf: licensed material already paid for, ready to drop into a
// promo. GET with no args lists it; GET ?file= serves one.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The stock shelf is operator-only.");

  const file = new URL(req.url).searchParams.get("file");

  if (!file) {
    const reach = stockReachable();
    const items = listStock();
    return NextResponse.json({
      ok: reach.ok,
      dir: STOCK_DIR,
      error: reach.ok ? null : reach.detail,
      folders: [...new Set(items.map(i => i.folder).filter(Boolean))].sort(),
      items: items.map(i => ({ ...i, url: stockUrl(i.id) })),
    });
  }

  // stockPath refuses anything that resolves outside the shelf.
  const full = stockPath(file);
  if (!full) return NextResponse.json({ error: "No such file on the shelf." }, { status: 404 });

  const ext = (full.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";

  let size = 0;
  try { size = fs.statSync(full).size; } catch {
    return NextResponse.json({ error: "Could not read that file." }, { status: 502 });
  }

  // Video needs ranges or it will not scrub, and some players refuse to start.
  const range = req.headers.get("range");
  if (range && type.startsWith("video/")) {
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
          "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  try {
    const buf = fs.readFileSync(full);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type, "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        // Files on the shelf can be replaced in place, so don't cache for a year.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read that file: ${e?.message || e}` }, { status: 502 });
  }
}


const UPLOAD_OK: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
  "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
};
const MAX_UPLOAD = 512 * 1024 * 1024;   // stock clips are big

// Put a downloaded asset ON the shelf.
//
// Storyblocks and the rest have no key we can hold, so the workflow is: log in,
// grab it, download it — and then this. Without an upload the shelf only works
// for someone sitting at a machine with the NAS mounted, which defeats the
// point of a placement spot you can fill the moment you find the shot.
export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The stock shelf is operator-only.");

  const reach = stockReachable();
  if (!reach.ok) return NextResponse.json({ error: reach.detail }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the file as `file`." }, { status: 400 });
  }
  const ext = UPLOAD_OK[file.type];
  if (!ext) {
    return NextResponse.json({
      error: `${file.type || "That file"} isn't a still or a clip. Use PNG, JPEG, WebP, MP4, WebM or MOV.`,
    }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD) {
    return NextResponse.json({
      error: `That's ${(file.size / 1e6).toFixed(0)} MB — keep shelf files under 512 MB.`,
    }, { status: 413 });
  }

  // Folder is chosen by the operator, but it is still user input: strip any
  // path traversal rather than trusting it.
  const folder = String(form?.get("folder") || "").replace(/[^A-Za-z0-9 _-]+/g, "").trim().slice(0, 60);
  const base = (file.name || "asset").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 90);
  const named = base.toLowerCase().endsWith(ext) ? base : base + ext;

  const dir = folder ? path.join(STOCK_DIR, folder) : STOCK_DIR;
  try {
    fs.mkdirSync(dir, { recursive: true });
    let dest = path.join(dir, named);
    // Never silently overwrite something already licensed and in use.
    let n = 1;
    while (fs.existsSync(dest)) {
      const stem = named.replace(new RegExp(`${ext}$`, "i"), "");
      dest = path.join(dir, `${stem}_${n++}${ext}`);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const tmp = dest + ".part";
    fs.writeFileSync(tmp, new Uint8Array(bytes));
    fs.renameSync(tmp, dest);   // appears complete or not at all
    const id = (folder ? `${folder}/` : "") + path.basename(dest);
    return NextResponse.json({ ok: true, id, url: stockUrl(id), name: path.basename(dest) });
  } catch (e: any) {
    return NextResponse.json({ error: `Couldn't write to the shelf: ${e?.message || e}` }, { status: 502 });
  }
}
