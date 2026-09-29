import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { requireUser, forbid, rateLimit } from "@/lib/guard";
import { createInvite, inviteLink } from "@/lib/invites";
import { sendEmail, mailConfigured } from "@/lib/google";
import {
  ensureMemberSchema, membersOf, invite, setStatus, setRole, removeMember,
  canControl, isOperator, memberProgress,
} from "@/lib/bandmembers";

export const dynamic = "force-dynamic";

// Band membership.
//
// One rule governs every write here: you may only touch a band you CONTROL, or
// any band if you are an operator. That is the whole guardrail Ben asked for —
// nobody adds themselves to a band, and nobody edits somebody else's lineup.

function gate(req: NextRequest, bandId: number) {
  const g = requireUser(req);
  if (g.deny) return { deny: g.deny, user: null as any };
  if (!bandId) return { deny: NextResponse.json({ error: "Which band?" }, { status: 400 }), user: null as any };
  if (!canControl(g.user, bandId)) {
    return { deny: forbid("Only whoever runs this band can change its lineup."), user: null as any };
  }
  ensureMemberSchema();
  return { deny: null, user: g.user };
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureMemberSchema();
  const bandId = Number(new URL(req.url).searchParams.get("band")) || 0;
  if (!bandId) return NextResponse.json({ members: [] });

  const members = membersOf(bandId).map(m => ({ ...m, progress: memberProgress(m) }));
  // Anyone in the band may SEE the lineup; only a controller may change it.
  const mine = members.some(m => m.user_id === g.user?.id);
  if (!mine && !canControl(g.user, bandId)) {
    // Not yours — hand back names only, the same as any public page would show.
    return NextResponse.json({
      members: members.map(m => ({ id: m.id, name: m.name || m.user_name, instrument: m.instrument, role: m.role })),
      can_control: false,
    });
  }
  return NextResponse.json({ members, can_control: canControl(g.user, bandId) });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any));
  const bandId = Number(b?.band) || 0;
  const g = gate(req, bandId); if (g.deny) return g.deny;

  const action = String(b?.action || "invite");

  if (action === "invite") {
    const limited = rateLimit(req, "bandinvite", 40, 60 * 60 * 1000); if (limited) return limited;
    const r = invite(bandId, {
      email: String(b?.email || ""), name: String(b?.name || ""),
      instrument: String(b?.instrument || ""), role: String(b?.role || "member"),
      by: g.user.id,
    });
    if ((r as any).error) return NextResponse.json({ error: (r as any).error }, { status: 400 });

    // Tell them, with a link that sets them up. A member who is never told is
    // just a row in a table.
    let mailed = false;
    const m: any = (r as any).member;
    if (m && !m.user_id && mailConfigured()) {
      try {
        const band = one<any>("SELECT name FROM bands WHERE id=?", bandId);
        const link = inviteLink(createInvite(m.email, g.user.id));
        await sendEmail({
          to: m.email,
          subject: `${g.user.display_name || "Someone"} added you to ${band?.name || "a band"} on ROADIE`,
          html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">
            <p>Hi${m.name ? ` ${m.name}` : ""},</p>
            <p><b>${g.user.display_name || "Your bandmate"}</b> put you in
            <b>${band?.name || "the band"}</b> on ROADIE — the free road kit for BC and Alberta bands.</p>
            <p>Setting up takes a minute. You get your own profile and your own songs stay yours;
            being in a band here doesn't hand anything over.</p>
            <p style="margin:18px 0"><a href="${link}"
              style="background:#ff3d6e;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:700">
              Set up your spot</a></p>
            <p style="font-size:12px;color:#666">Or paste this in: ${link}</p>
          </div>`,
        });
        mailed = true;
      } catch { /* the member row stands even if the mail bounces */ }
    }
    return NextResponse.json({ ...(r as any), mailed, members: membersOf(bandId).map(x => ({ ...x, progress: memberProgress(x) })) });
  }

  const memberId = Number(b?.member) || 0;
  if (!memberId) return NextResponse.json({ error: "Which member?" }, { status: 400 });

  if (action === "status") {
    const r = setStatus(bandId, memberId, String(b?.status || ""));
    if ((r as any).error) return NextResponse.json(r, { status: 400 });
    return NextResponse.json({ members: membersOf(bandId).map(x => ({ ...x, progress: memberProgress(x) })) });
  }

  if (action === "role") {
    // Only an operator or the band's registered owner may hand out control.
    const owner = one<any>("SELECT user_id FROM bands WHERE id=?", bandId);
    if (!isOperator(g.user) && Number(owner?.user_id) !== Number(g.user.id)) {
      return forbid("Only the band's owner can make someone else a controller.");
    }
    setRole(bandId, memberId, String(b?.role || "member"));
    return NextResponse.json({ members: membersOf(bandId).map(x => ({ ...x, progress: memberProgress(x) })) });
  }

  if (action === "remove") {
    const r = removeMember(bandId, memberId);
    if ((r as any).error) return NextResponse.json(r, { status: 400 });
    return NextResponse.json({
      ...r,
      note: "They're out of the band. Their account, profile and songs are untouched — they're a solo artist now.",
      members: membersOf(bandId).map(x => ({ ...x, progress: memberProgress(x) })),
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
