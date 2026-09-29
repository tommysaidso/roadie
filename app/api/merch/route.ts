import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { requireUser, ownsBand, forbid } from "@/lib/guard";
import {
  ensureGigBagSchema, saveMerchPhoto, queueShowcase, MERCH_STYLES, MAX_UPLOAD,
} from "@/lib/gigbag";

export const dynamic = "force-dynamic";

// Merch items. ROADIE never takes the money — every item points at the band's
// own shop or drop-shipper link.

const KINDS = ["shirt", "hoodie", "hat", "vinyl", "cd", "cassette", "sticker", "poster", "patch", "other"];

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGigBagSchema();

  const ct = req.headers.get("content-type") || "";

  // multipart = a photo coming in (phone camera or file picker)
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const itemId = Number(form?.get("item_id"));
    const file = form?.get("file");
    if (!itemId || !(file instanceof File)) {
      return NextResponse.json({ error: "Pass item_id and an image as `file`." }, { status: 400 });
    }
    const item = one<any>("SELECT * FROM merch_items WHERE id=?", itemId);
    if (!item) return NextResponse.json({ error: "No such item." }, { status: 404 });
    if (!ownsBand(g.user, item.band_id)) return forbid("You can only edit your own band's merch.");
    if (file.size > MAX_UPLOAD) {
      return NextResponse.json({ error: `That's ${(file.size / 1e6).toFixed(1)} MB — keep photos under 24 MB.` }, { status: 413 });
    }
    let photo: string;
    try {
      photo = saveMerchPhoto(Buffer.from(await file.arrayBuffer()), file.type, item.band_id);
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message || e) }, { status: 415 });
    }
    run("UPDATE merch_items SET photo=? WHERE id=?", photo, itemId);
    return NextResponse.json({ id: itemId, photo, saved: true });
  }

  const b = await req.json().catch(() => ({}));

  // Ask for a showcase render of an item we already have a photo for.
  if (b?.action === "showcase") {
    const item = one<any>("SELECT * FROM merch_items WHERE id=?", Number(b?.id));
    if (!item) return NextResponse.json({ error: "No such item." }, { status: 404 });
    if (!ownsBand(g.user, item.band_id)) return forbid("You can only edit your own band's merch.");
    try {
      const q = queueShowcase(item, String(b?.style || "photoreal"));
      return NextResponse.json({ id: item.id, queued: true, ...q });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message || e) }, { status: 409 });
    }
  }

  const bandId = Number(b?.band_id);
  if (!bandId) return NextResponse.json({ error: "Pass band_id." }, { status: 400 });
  if (!ownsBand(g.user, bandId)) return forbid("You can only edit your own band's merch.");

  const title = String(b?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Give the item a name." }, { status: 400 });
  const kind = KINDS.includes(String(b?.kind)) ? String(b.kind) : "other";
  const price = Number.isFinite(Number(b?.price_cad)) && Number(b.price_cad) > 0
    ? Math.round(Number(b.price_cad)) : null;

  if (b?.id) {
    const prev = one<any>("SELECT * FROM merch_items WHERE id=?", Number(b.id));
    if (!prev || Number(prev.band_id) !== bandId) return NextResponse.json({ error: "No such item." }, { status: 404 });
    run(`UPDATE merch_items SET title=?, kind=?, price_cad=?, url=?, position=? WHERE id=?`,
      title, kind, price, String(b?.url || "").trim(), Number(b?.position) || prev.position || 0, Number(b.id));
    return NextResponse.json({ id: Number(b.id), saved: true });
  }

  const r = run(`INSERT INTO merch_items(band_id,title,kind,price_cad,url,position)
                 VALUES(?,?,?,?,?,?)`,
    bandId, title, kind, price, String(b?.url || "").trim(), Number(b?.position) || 0);
  return NextResponse.json({ id: Number(r.lastInsertRowid), saved: true, styles: Object.keys(MERCH_STYLES) });
}

export async function DELETE(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGigBagSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Pass ?id=" }, { status: 400 });
  const row = one<any>("SELECT * FROM merch_items WHERE id=?", id);
  if (!row) return NextResponse.json({ deleted: true });
  if (!ownsBand(g.user, row.band_id)) return forbid("You can only edit your own band's merch.");
  run("DELETE FROM merch_items WHERE id=?", id);
  return NextResponse.json({ deleted: true });
}
