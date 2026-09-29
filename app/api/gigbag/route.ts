import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { requireUser, ownsBand, forbid } from "@/lib/guard";
import { ensureGigBagSchema, kitFor, merchFor, bandsFor, shopLink, refreshShowcases } from "@/lib/gigbag";

export const dynamic = "force-dynamic";

// The kit half of the Gig Bag: who's in the band and what they carry.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGigBagSchema();

  const bands = bandsFor(g.user);
  if (!bands.length) {
    return NextResponse.json({ bands: [], kit: [], merch: [], shop: "" });
  }

  const asked = Number(new URL(req.url).searchParams.get("band")) || bands[0].id;
  if (!ownsBand(g.user, asked)) return forbid("You can only open your own band's gig bag.");

  // Cheap and read-only: nudges any queued showcase along so the page shows
  // finished art without the operator studio being involved.
  refreshShowcases(asked);

  const band = bands.find(b => Number(b.id) === Number(asked)) || bands[0];
  return NextResponse.json({
    bands: bands.map(b => ({ id: b.id, name: b.name })),
    band: { id: band.id, name: band.name },
    shop: shopLink(band),
    kit: kitFor(asked),
    merch: merchFor(asked).map(m => ({
      ...m,
      photo_url: m.photo ? `/api/merch/photo?item=${m.id}&kind=photo` : null,
      showcase_url: m.showcase_status === "done" ? `/api/merch/photo?item=${m.id}&kind=showcase` : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGigBagSchema();

  const b = await req.json().catch(() => ({}));
  const bandId = Number(b?.band_id);
  if (!bandId) return NextResponse.json({ error: "Pass band_id." }, { status: 400 });
  if (!ownsBand(g.user, bandId)) return forbid("You can only edit your own band's gig bag.");

  const name = String(b?.member_name || "").trim();
  if (!name) return NextResponse.json({ error: "Give the member a name." }, { status: 400 });

  const instruments = JSON.stringify(
    Array.isArray(b?.instruments)
      ? b.instruments.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 40)
      : []);

  if (b?.id) {
    const prev = one<any>("SELECT * FROM gig_bag WHERE id=?", Number(b.id));
    if (!prev || Number(prev.band_id) !== bandId) return NextResponse.json({ error: "No such member." }, { status: 404 });
    run(`UPDATE gig_bag SET member_name=?, role=?, instruments=?, needs=?, position=? WHERE id=?`,
      name, String(b?.role || ""), instruments, String(b?.needs || ""),
      Number(b?.position) || prev.position || 0, Number(b.id));
    return NextResponse.json({ id: Number(b.id), saved: true });
  }

  const r = run(`INSERT INTO gig_bag(band_id,member_name,role,instruments,needs,position)
                 VALUES(?,?,?,?,?,?)`,
    bandId, name, String(b?.role || ""), instruments, String(b?.needs || ""),
    Number(b?.position) || 0);
  return NextResponse.json({ id: Number(r.lastInsertRowid), saved: true });
}

export async function DELETE(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureGigBagSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Pass ?id=" }, { status: 400 });
  const row = one<any>("SELECT * FROM gig_bag WHERE id=?", id);
  if (!row) return NextResponse.json({ deleted: true });
  if (!ownsBand(g.user, row.band_id)) return forbid("You can only edit your own band's gig bag.");
  run("DELETE FROM gig_bag WHERE id=?", id);
  return NextResponse.json({ deleted: true });
}
