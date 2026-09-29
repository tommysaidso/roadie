import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser, forbid, rateLimit } from "@/lib/guard";
import { sendEmail, mailConfigured } from "@/lib/google";
import { createInvite, inviteLink } from "@/lib/invites";
import {
  ensureBetaSchema, isAdmin, teamsFor, ownsTeam, createTeam, membersFor, addMembers,
  bandsInTeam, levelsFor, saveLevel, deleteLevel, logMessage, logSend, finishMessage, historyFor,
} from "@/lib/betateam";

export const dynamic = "force-dynamic";

// Beta teams — an admin's own cohort: who is in it, what they were promised,
// what they were told, and whether it arrived.
//
// Every route here is owner-scoped. Being an admin gets you YOUR teams, not
// everyone's — two admins running cohorts should never see each other's people.

function gate(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return { deny: g.deny, user: null as any };
  if (!isAdmin(g.user)) return { deny: forbid("Beta teams are admin-only."), user: null as any };
  ensureBetaSchema();
  return { deny: null, user: g.user };
}

export async function GET(req: NextRequest) {
  const g = gate(req); if (g.deny) return g.deny;
  const u = new URL(req.url);
  const teamId = Number(u.searchParams.get("team")) || 0;

  if (!teamId) {
    return NextResponse.json({
      teams: teamsFor(g.user.id),
      // Every band, so a tester can be filed against one when they are added.
      bands: all<any>("SELECT id,name FROM bands ORDER BY name"),
      email_ready: mailConfigured(),
    });
  }
  if (!ownsTeam(g.user.id, teamId)) return forbid("That isn't your team.");

  const bandId = Number(u.searchParams.get("band")) || null;
  return NextResponse.json({
    members: membersFor(teamId, bandId),
    bands: bandsInTeam(teamId),
    levels: levelsFor(teamId),
    history: historyFor(teamId),
    allBands: all<any>("SELECT id,name FROM bands ORDER BY name"),
    email_ready: mailConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const g = gate(req); if (g.deny) return g.deny;
  const b = await req.json().catch(() => ({} as any));
  const action = String(b?.action || "");

  if (action === "create_team") {
    const name = String(b?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name the team." }, { status: 400 });
    return NextResponse.json({ team: createTeam(g.user.id, name, String(b?.note || "")) });
  }

  const teamId = Number(b?.team) || 0;
  if (!teamId || !ownsTeam(g.user.id, teamId)) return forbid("That isn't your team.");

  if (action === "add_members") {
    const rows = Array.isArray(b?.members) ? b.members : [];
    const r = addMembers(teamId, rows);
    return NextResponse.json({ ...r, members: membersFor(teamId) });
  }

  if (action === "save_level") {
    saveLevel(teamId, b?.level || {});
    return NextResponse.json({ levels: levelsFor(teamId) });
  }

  if (action === "delete_level") {
    deleteLevel(teamId, Number(b?.id));
    return NextResponse.json({ levels: levelsFor(teamId), members: membersFor(teamId) });
  }

  // --- the send ------------------------------------------------------------
  //
  // Nothing here is scheduled or triggered. This runs because a person pressed
  // a button having read the words, which is the only way outbound mail should
  // ever leave this platform.
  if (action === "send") {
    const limited = rateLimit(req, "betasend", 10, 60 * 60 * 1000);
    if (limited) return limited;
    if (!mailConfigured()) {
      return NextResponse.json({ error: "Email isn't configured on this server — nothing was sent." }, { status: 503 });
    }

    const subject = String(b?.subject || "").trim();
    const body = String(b?.body || "").trim();
    if (!subject || !body) return NextResponse.json({ error: "Needs a subject and a message." }, { status: 400 });

    const bandId = Number(b?.band) || null;
    const targets = membersFor(teamId, bandId).filter((m: any) => m.status !== "removed");
    if (!targets.length) {
      return NextResponse.json({ error: "Nobody to send to in that selection." }, { status: 400 });
    }
    // A hard ceiling. This is a beta cohort, not a mailing list, and an
    // accidental thousand-recipient send is not recoverable.
    if (targets.length > 200) {
      return NextResponse.json({ error: `${targets.length} recipients is more than this is meant for.` }, { status: 400 });
    }

    const messageId = logMessage({
      teamId, senderId: g.user.id, bandId, subject, body,
    });

    let ok = 0, fail = 0;
    for (const m of targets) {
      // Personalise per recipient: their name, their band, what they were
      // promised, and — when they have not joined yet — their own invite link.
      let link = "";
      try {
        if (m.status !== "joined") link = inviteLink(createInvite(m.email, g.user.id));
      } catch { /* an invite that cannot be minted must not stop the mail */ }

      const html = renderMail({
        body, name: m.name, band: m.band, level: m.level,
        freeMonths: m.free_months, bonus: m.referral_bonus_months, link,
        from: g.user.display_name || "the ROADIE team",
      });

      try {
        await sendEmail({ to: m.email, subject, html });
        logSend(messageId, m.id, m.email, true); ok++;
      } catch (e: any) {
        logSend(messageId, m.id, m.email, false, e?.message || String(e)); fail++;
      }
    }
    finishMessage(messageId);

    return NextResponse.json({
      ok, fail, sent_to: targets.length,
      history: historyFor(teamId),
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

const esc = (s: string) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain, readable mail. No tracking pixel — we log what we SENT, not who peeked. */
function renderMail(o: {
  body: string; name?: string; band?: string; level?: string;
  freeMonths?: number; bonus?: number; link?: string; from: string;
}) {
  const hi = o.name ? `Hi ${esc(o.name)},` : "Hi,";
  const paras = esc(o.body).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");

  const perk = o.level
    ? `<div style="margin:18px 0;padding:12px 14px;border-left:3px solid #ff3d6e;background:#faf7f8">
         <div style="font-weight:700">${esc(o.level)}</div>
         ${o.freeMonths ? `<div>${o.freeMonths} month${o.freeMonths === 1 ? "" : "s"} free while you're testing.</div>` : ""}
         ${o.bonus ? `<div>Bring someone in and you both get ${o.bonus} more month${o.bonus === 1 ? "" : "s"}.</div>` : ""}
       </div>` : "";

  const cta = o.link
    ? `<p style="margin:18px 0"><a href="${esc(o.link)}"
         style="background:#ff3d6e;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:700">
         Set up your account</a></p>
       <p style="font-size:12px;color:#666">Or paste this in: ${esc(o.link)}</p>` : "";

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">
    <p style="margin:0 0 14px">${hi}</p>
    ${paras}
    ${perk}
    ${cta}
    <p style="margin:18px 0 0">— ${esc(o.from)}</p>
    <p style="font-size:12px;color:#888;margin-top:18px">
      ROADIE${o.band ? ` · ${esc(o.band)}` : ""} · roadie.mymymy.studio
    </p>
  </div>`;
}
