import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { one } from "@/lib/db";
import { requireUser, ownsBand, forbid } from "@/lib/guard";
import { ensureGigBagSchema, merchPhotoPath, showcasePath } from "@/lib/gigbag";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

// Serve a merch photo (the band's own) or its generated showcase.
//
// Only ever serves a file this DB recorded for the item, so the id can't be
// bent into a path. Unreleased merch is the band's business until they list it,
// so this stays behind the same ownership check as editing.
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGigBagSchema();

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("item"));
  const kind = url.searchParams.get("kind") === "showcase" ? "showcase" : "photo";
  if (!id) return NextResponse.json({ error: "Pass ?item=<id>" }, { status: 400 });

  const item = one<any>("SELECT * FROM merch_items WHERE id=?", id);
  if (!item) return NextResponse.json({ error: "No such item." }, { status: 404 });
  if (!ownsBand(g.user, item.band_id)) return forbid("That isn't your band's merch.");

  const file = kind === "showcase" ? showcasePath(item) : (item.photo ? merchPhotoPath(item.photo) : null);
  if (!file) {
    return NextResponse.json({
      error: kind === "showcase" ? "No showcase has finished for this item yet." : "No photo on this item yet.",
    }, { status: 404 });
  }

  const ext = (file.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
  try {
    const buf = fs.readFileSync(file);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[ext] || "image/png",
        // The band can replace a photo, so don't cache it for a year.
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read the image: ${e?.message || e}` }, { status: 502 });
  }
}
