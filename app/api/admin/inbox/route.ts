import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser, forbid, rateLimit } from "@/lib/guard";
import { sendEmail, mailConfigured } from "@/lib/google";
import {
  ensureInboxSchema, canUseInbox, imapStatus, syncInbox, threads, threadWith,
  markRead, assign, setThreadStatus, logOutgoing,
} from "@/lib/inbox";

export const dynamic = "force-dynamic";

// Every reply is CC'd to the house address.
//
// Working inside the platform is what makes a conversation trackable, but it
// must not make it INVISIBLE anywhere else — if the only copy of a thread lives
// here, then a laptop dying or a login going wrong takes the chain with it.
// The CC means the same conversation is always sitting in a normal mailbox too.
const ADMIN_CC = process.env.ADMIN_CC_EMAIL || process.env.ROADIE_VIDEO_INBOX || "development@evprod.com";

// The shared inbox.
//
// One mailbox, several people. The default view is YOURS — whoever did the
// outreach owns the reply — but nothing is hidden, because a shared inbox where
// you cannot see the other person's thread is just two inboxes with extra steps.

function gate(req: NextRequest) {
  const g = requireUser(req);
  if (g.deny) return { deny: g.deny, user: null as any };
  if (!canUseInbox(g.user)) return { deny: forbid("The inbox is for production staff."), user: null as any };
  ensureInboxSchema();
  return { deny: null, user: g.user };
}

export async function GET(req: NextRequest) {
  const g = gate(req); if (g.deny) return g.deny;
  const u = new URL(req.url);
  const id = Number(u.searchParams.get("thread")) || 0;

  if (id) {
    const t = threadWith(id);
    if (!t) return NextResponse.json({ error: "No such thread." }, { status: 404 });
    markRead(id);   // opening it IS reading it
    return NextResponse.json({ thread: t });
  }

  const mine = u.searchParams.get("mine") !== "0";   // your own list by default
  return NextResponse.json({
    threads: threads({ mine, assignedTo: g.user.id, status: u.searchParams.get("status") || undefined }),
    me: { id: g.user.id, name: g.user.display_name || g.user.email },
    // Who a thread can be handed to.
    staff: all<any>("SELECT id, display_name, email FROM users WHERE role IN ('super_admin','manager','admin','operator') ORDER BY display_name"),
    imap: imapStatus(),
    can_send: mailConfigured(),
    admin_cc: ADMIN_CC,
  });
}

export async function POST(req: NextRequest) {
  const g = gate(req); if (g.deny) return g.deny;
  const b = await req.json().catch(() => ({} as any));
  const action = String(b?.action || "");

  // Pull new mail. Rate-limited because IMAP is slow and hammering it helps
  // nobody — the UI can poll politely.
  if (action === "sync") {
    const limited = rateLimit(req, "inboxsync", 60, 10 * 60 * 1000); if (limited) return limited;
    const r = await syncInbox();
    return NextResponse.json({ ...r, threads: threads({ mine: false, assignedTo: g.user.id }) });
  }

  const id = Number(b?.thread) || 0;
  if (!id) return NextResponse.json({ error: "Which thread?" }, { status: 400 });

  if (action === "assign") {
    assign(id, b?.user_id ? Number(b.user_id) : null);
    return NextResponse.json({ thread: threadWith(id) });
  }

  if (action === "status") {
    setThreadStatus(id, String(b?.status || "open"));
    return NextResponse.json({ thread: threadWith(id) });
  }

  if (action === "reply") {
    const limited = rateLimit(req, "inboxreply", 60, 60 * 60 * 1000); if (limited) return limited;
    if (!mailConfigured()) {
      return NextResponse.json({ error: "Mail isn't configured — nothing was sent." }, { status: 503 });
    }
    const t = threadWith(id);
    if (!t) return NextResponse.json({ error: "No such thread." }, { status: 404 });

    const body = String(b?.body || "").trim();
    if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });

    const subject = String(b?.subject || "").trim()
      || (/^re:/i.test(t.subject) ? t.subject : `Re: ${t.subject}`);

    // Quote what they said underneath, the way a mail client would, so the
    // person on the other end can follow the thread in their own inbox.
    const last = [...(t.messages || [])].reverse().find((m: any) => m.direction === "in");
    const quoted = last
      ? `<blockquote style="margin:18px 0 0;padding-left:12px;border-left:3px solid #ddd;color:#666">
           <div style="font-size:12px;margin-bottom:6px">On ${new Date(last.at).toLocaleString()}, ${last.from_name || last.from_email} wrote:</div>
           ${last.body_html || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(last.body_text || "")}</pre>`}
         </blockquote>` : "";

    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:600px">
      ${escapeHtml(body).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("")}
      <p style="margin:18px 0 0">— ${escapeHtml(g.user.display_name || "ROADIE")}</p>
      ${quoted}
    </div>`;

    try {
      // Don't CC the house address onto its own mail.
      const cc = ADMIN_CC && ADMIN_CC.toLowerCase() !== String(t.with_email).toLowerCase()
        ? ADMIN_CC : undefined;
      await sendEmail({ to: t.with_email, subject, html, cc, replyTo: process.env.SMTP_FROM });
      logOutgoing(id, { to: t.with_email, subject, html, text: body, sentBy: g.user.id });
      return NextResponse.json({ ok: true, thread: threadWith(id) });
    } catch (e: any) {
      return NextResponse.json({ error: `Couldn't send: ${e?.message || e}` }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

function escapeHtml(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
