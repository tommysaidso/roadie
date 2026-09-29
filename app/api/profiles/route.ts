import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { requireUser, forbid, isElevated } from "@/lib/guard";
import {
  ensureProfileSchema, profilesFor, activeProfile, addProfile, setDefault,
  PROFILE_COOKIE, PROFILE_KINDS, ProfileKind,
} from "@/lib/profiles";
import { cookieOpts } from "@/lib/auth";

export const dynamic = "force-dynamic";

// One login, several hats. This lists them and switches between them.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureProfileSchema();

  const mine = profilesFor(g.user.id);
  const active = activeProfile(g.user, req.cookies.get(PROFILE_COOKIE)?.value);
  return NextResponse.json({
    profiles: mine.map(p => ({
      id: p.id, kind: p.kind, ref_id: p.ref_id, label: p.label,
      is_default: !!p.is_default, active: active ? p.id === active.id : false,
    })),
    active: active ? { id: active.id, kind: active.kind, ref_id: active.ref_id, label: active.label } : null,
    role: g.user.role,
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureProfileSchema();

  const b = await req.json().catch(() => ({}));

  // Switch hats.
  if (b?.action === "switch") {
    const id = Number(b?.id);
    const mine = profilesFor(g.user.id);
    const hit = mine.find(p => Number(p.id) === id);
    // Refuse rather than silently fall back: quietly acting as a different
    // profile than the one asked for is worse than an error.
    if (!hit) return forbid("That isn't one of your profiles.");
    if (b?.remember) setDefault(g.user.id, hit.id);

    const res = NextResponse.json({
      active: { id: hit.id, kind: hit.kind, ref_id: hit.ref_id, label: hit.label },
    });
    res.cookies.set(PROFILE_COOKIE, String(hit.id), { ...cookieOpts(req), maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // Attach another record to this login. Only operators may attach one to
  // somebody else — otherwise you could bolt yourself onto another band.
  const kind = String(b?.kind || "") as ProfileKind;
  if (!(PROFILE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: `kind must be one of ${PROFILE_KINDS.join(", ")}` }, { status: 400 });
  }
  const refId = Number(b?.ref_id);
  if (!refId) return NextResponse.json({ error: "Pass ref_id." }, { status: 400 });

  const targetUser = Number(b?.user_id) || g.user.id;
  if (targetUser !== g.user.id && !isElevated(g.user)) {
    return forbid("You can only add profiles to your own login.");
  }

  // AND you must have a right to the record itself.
  //
  // Guarding only the target login left the door wide open: anyone signed in
  // could attach ANY band to their OWN account and become its controller. A
  // profile is control, so attaching one has to be earned — you already hold
  // the record, or an operator is doing it for you.
  if (!isElevated(g.user)) {
    const holds = (() => {
      try {
        if (kind === "band")    return !!one<any>("SELECT 1 x FROM bands   WHERE id=? AND user_id=?", refId, g.user.id);
        if (kind === "venue")   return !!one<any>("SELECT 1 x FROM venues  WHERE id=? AND user_id=?", refId, g.user.id);
        if (kind === "sponsor") return !!one<any>("SELECT 1 x FROM sponsors WHERE id=? AND user_id=?", refId, g.user.id);
      } catch { /* a table without user_id cannot prove ownership — deny */ }
      return false;
    })();
    if (!holds) {
      return forbid("That isn't yours to add. Ask whoever runs it to add you, or claim it first.");
    }
  }

  try {
    const p = addProfile(targetUser, kind, refId, { makeDefault: !!b?.make_default });
    return NextResponse.json({ profile: p });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 404 });
  }
}
