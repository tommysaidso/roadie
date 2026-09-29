import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { ensureStudioSchema, refStoreDir, comfyInputDirs, stageReference } from "@/lib/studio";

export const dynamic = "force-dynamic";

const MAX_BYTES = 24 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
};

// Accept a reference photo, keep our own copy, and push it into every ComfyUI
// input folder we can reach so LoadImage resolves wherever the job lands.
export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");
  ensureStudioSchema();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach an image as `file`." }, { status: 400 });
  }
  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: `${file.type || "That file"} isn't an image. Use PNG, JPEG or WebP.` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `That's ${(file.size / 1e6).toFixed(1)} MB — keep references under 24 MB.` }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Content hash: re-uploading the same photo reuses one staged copy instead of
  // littering every machine's input folder with duplicates.
  const hash = crypto.createHash("sha1").update(new Uint8Array(bytes)).digest("hex").slice(0, 12);
  const basename = `roadie_ref_${hash}${ext}`;

  const localPath = path.join(refStoreDir(), basename);
  fs.writeFileSync(localPath, new Uint8Array(bytes));

  const { staged, failed } = stageReference(localPath, basename);
  if (!staged.length) {
    // Queuing now would guarantee a render that dies on a missing image.
    return NextResponse.json({
      error: "Couldn't put the reference on any render machine, so a render would fail. " +
             failed.join(" | "),
    }, { status: 502 });
  }

  return NextResponse.json({
    reference: basename,
    staged: staged.length,
    of: comfyInputDirs().length,
    // Surfaced, not swallowed: a machine that missed the file can still claim
    // the job, and knowing which one failed is the whole diagnosis.
    warnings: failed,
  });
}
