import { NextRequest, NextResponse } from "next/server";
import { requireUser, forbid, rateLimit } from "@/lib/guard";
import { isOperator } from "@/lib/bandmembers";
import { sendEmail, mailConfigured } from "@/lib/google";
import {
  ensureReferralSchema, codeFor, codeRow, recordInvite, statsFor, grantsFor,
  grantMonths, unappliedMonths, BLOCK_MONTHS, BLOCK_PAID_MONTHS, REFERRAL_MONTHS,
} from "@/lib/referrals";

export const dynamic = "force-dynamic";

// Referrals: your code, who you brought, and the months it earned.
//
// Nothing here charges or refunds anything. It records what is OWED — the
// months — and billing moves the date. Keeping the earning and the charging
// apart means a bug in one can never quietly take someone's money.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureReferralSchema();

  // Made on first look, then kept — a code that changes is useless once shared.
  const seed = String(g.user.display_name || g.user.email || "ROAD").split(/[\s@]/)[0];
  const code = codeFor(g.user.id, seed);

  return NextResponse.json({
    ...statsFor(g.user.id),
    grants: grantsFor(g.user.id),
    terms: {
      block_months: BLOCK_MONTHS,
      paid_months: BLOCK_PAID_MONTHS,
      referral_months: REFERRAL_MONTHS,
      plain: `Billing runs in ${BLOCK_MONTHS}-month blocks — you pay for ${BLOCK_PAID_MONTHS}, the ${BLOCK_MONTHS}rd is free. ` +
             `Every person who signs up on your code pushes your next charge date out by ${REFERRAL_MONTHS} month.`,
    },
    link: code ? `${process.env.ROADIE_PUBLIC_URL || "https://roadie.mymymy.studio"}/setup?ref=${code.code}` : null,
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureReferralSchema();
  const b = await req.json().catch(() => ({} as any));
  const action = String(b?.action || "invite");

  // --- share the code with someone ----------------------------------------
  if (action === "invite") {
    const limited = rateLimit(req, "refinvite", 50, 60 * 60 * 1000); if (limited) return limited;
    const seed = String(g.user.display_name || g.user.email || "ROAD").split(/[\s@]/)[0];
    const code = codeFor(g.user.id, seed);
    const emails = (Array.isArray(b?.emails) ? b.emails : String(b?.emails || "").split(/[\s,;\n]+/))
      .map((e: any) => String(e).trim().toLowerCase()).filter(Boolean).slice(0, 50);
    if (!emails.length) return NextResponse.json({ error: "Nobody to send to." }, { status: 400 });

    const link = `${process.env.ROADIE_PUBLIC_URL || "https://roadie.mymymy.studio"}/setup?ref=${code.code}`;
    let sent = 0;
    for (const e of emails) {
      recordInvite(code.code, e);
      if (!mailConfigured()) continue;
      try {
        await sendEmail({
          to: e,
          subject: `${g.user.display_name || "A bandmate"} put you on ROADIE`,
          html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">
            <p>Hi,</p>
            <p><b>${g.user.display_name || "Someone you know"}</b> reckons ROADIE is worth your time —
            the free road kit for BC and Alberta bands.</p>
            <p>Sign up on their code and you start on a full block: <b>three months for the price of two</b>.
            Bring someone in yourself and your next charge date moves out another month.</p>
            <p style="margin:18px 0"><a href="${link}"
              style="background:#ff3d6e;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:700">
              Start with ${code.code}</a></p>
            <p style="font-size:12px;color:#666">Or paste this in: ${link}</p>
          </div>`,
        });
        sent++;
      } catch { /* the invite is recorded either way */ }
    }
    return NextResponse.json({ ok: true, code: code.code, link, invited: emails.length, mailed: sent, ...statsFor(g.user.id) });
  }

  // --- an operator extending someone (Dewey's testers) ---------------------
  if (action === "grant") {
    if (!isOperator(g.user)) return forbid("Only an operator can hand out months.");
    const r = grantMonths(Number(b?.user_id), Number(b?.months), g.user.id, String(b?.note || ""));
    if ((r as any).error) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  }

  // --- what does this code say it gives? (public-ish, for the signup page) --
  if (action === "check") {
    const c = codeRow(String(b?.code || ""));
    if (!c) return NextResponse.json({ valid: false });
    return NextResponse.json({
      valid: true, founding: !!c.founding,
      gives: c.founding ? `${BLOCK_MONTHS} months free` : `${BLOCK_MONTHS} months for the price of ${BLOCK_PAID_MONTHS}`,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
