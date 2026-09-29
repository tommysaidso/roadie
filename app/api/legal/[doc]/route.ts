import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Download the ring paperwork.
 *
 * A band being asked onto a ring should be able to hand the agreement to their
 * own lawyer before they say yes — without asking us for it, and without us
 * knowing they did. Open on purpose: gating the terms behind a login would
 * defeat the transparency they exist to demonstrate.
 */
/**
 * NOTE ON LOCATION: the source doc lives in `public/legal/`, not `content/`.
 * On the NAS deployment this app bind-mounts app/, lib/, components/ and
 * public/ — but NOT content/ — so a document under content/ is simply absent
 * inside the container and every download 500s. public/ is mounted, so the file
 * is live there the moment it changes on the share.
 */
const DOCS: Record<string, { file: string; filename: string; title: string }> = {
  "ring-contract": {
    file: "ring-contractor-terms.md",
    filename: "ROADIE-Ring-Contractor-Agreement.md",
    title: "Ring Contractor Agreement",
  },
};

const DOC_DIRS = ["public/legal", "content"];   // first hit wins

export async function GET(
  _req: NextRequest,
  { params }: { params: { doc: string } },
) {
  const spec = DOCS[params.doc];
  if (!spec) {
    return NextResponse.json(
      { error: "Unknown document", available: Object.keys(DOCS) },
      { status: 404 },
    );
  }
  let body: string | null = null;
  for (const dir of DOC_DIRS) {
    try {
      body = readFileSync(path.join(process.cwd(), dir, spec.file), "utf8");
      break;
    } catch { /* try the next location */ }
  }
  if (body === null) {
    return NextResponse.json(
      { error: `${spec.title} is not available for download right now.` },
      { status: 500 },
    );
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${spec.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
