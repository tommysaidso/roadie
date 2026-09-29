import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireUser, forbid } from "@/lib/guard";
import { canControl } from "@/lib/bandmembers";
import {
  ensureGearSchema, gearFor, saveGear, deleteGear, serialSeenElsewhere,
  GEAR_KINDS, normSerial,
} from "@/lib/gear";

export const dynamic = "force-dynamic";

// The gig bag's gear list.
//
// Writes need control of the band — same rule as the lineup. Gear is what a
// band owns; a stranger should not be editing the serial numbers on it.

const PHOTO_DIR = path.join(process.cwd(), "public", "gear");
const MAX_PHOTO = 12 * 1024 * 1024;
const PHOTO_OK: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
};

function gate(req: NextRequest, bandId: number) {
  const g = requireUser(req);
  if (g.deny) return { deny: g.deny, user: null as any };
  if (!bandId) return { deny: NextResponse.json({ error: "Which band?" }, { status: 400 }), user: null as any };
  if (!canControl(g.user, bandId)) return { deny: forbid("Only the band can change its gear list."), user: null as any };
  ensureGearSchema();
  return { deny: null, user: g.user };
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGearSchema();
  const bandId = Number(new URL(req.url).searchParams.get("band")) || 0;
  return NextResponse.json({
    kinds: GEAR_KINDS,
    gear: bandId ? gearFor(bandId) : [],
    can_edit: bandId ? canControl(g.user, bandId) : false,
  });
}

export async function POST(req: NextRequest) {
  const type = req.headers.get("content-type") || "";

  // --- photo upload (multipart) -------------------------------------------
  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const bandId = Number(form?.get("band")) || 0;
    const g = gate(req, bandId); if (g.deny) return g.deny;

    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach the photo as `file`." }, { status: 400 });
    const ext = PHOTO_OK[file.type];
    if (!ext) return NextResponse.json({ error: "Photos only — PNG, JPEG or WebP." }, { status: 415 });
    if (file.size > MAX_PHOTO) {
      return NextResponse.json({ error: `${(file.size / 1e6).toFixed(0)} MB is too big — keep it under 12 MB.` }, { status: 413 });
    }
    try {
      fs.mkdirSync(PHOTO_DIR, { recursive: true });
      const name = `g${bandId}_${Date.now().toString(36)}${ext}`;
      const tmp = path.join(PHOTO_DIR, name + ".part");
      fs.writeFileSync(tmp, new Uint8Array(Buffer.from(await file.arrayBuffer())));
      fs.renameSync(tmp, path.join(PHOTO_DIR, name));   // whole file or none
      return NextResponse.json({ ok: true, photo: name, url: `/gear/${name}` });
    } catch (e: any) {
      return NextResponse.json({ error: `Couldn't save that photo: ${e?.message || e}` }, { status: 502 });
    }
  }

  // --- normal writes -------------------------------------------------------
  const b = await req.json().catch(() => ({} as any));
  const bandId = Number(b?.band) || 0;
  const g = gate(req, bandId); if (g.deny) return g.deny;

  if (b?.action === "delete") {
    deleteGear(bandId, Number(b?.id));
    return NextResponse.json({ gear: gearFor(bandId) });
  }

  const item = saveGear({ ...(b?.item || {}), band_id: bandId, owner_user_id: g.user.id });

  // Quiet heads-up, never an accusation: the same serial on two lists is
  // usually one person listing their own gear twice — but if something walked,
  // this is exactly what you want to know.
  const clash = b?.item?.serial ? serialSeenElsewhere(String(b.item.serial), bandId) : [];

  return NextResponse.json({
    item, gear: gearFor(bandId),
    serial_seen_elsewhere: clash.length ? clash : undefined,
    normalised_serial: b?.item?.serial ? normSerial(String(b.item.serial)) : undefined,
  });
}
