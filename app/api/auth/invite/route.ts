import { NextRequest, NextResponse } from "next/server";
import {
  ensureAuthSchema, findUserByEmail, createUser, setPassword,
  newSession, SESSION_COOKIE, cookieOpts,
} from "@/lib/auth";
import { requireUser } from "@/lib/guard";
import { linkUserByEmail } from "@/lib/bandmembers";
import { convert } from "@/lib/referrals";
import { canAssign, resolveRole } from "@/lib/roles";
import { createInvite, inviteFor, consumeInvite, inviteLink } from "@/lib/invites";
export const dynamic = "force-dynamic";

// POST { email }                 -> manager mints an invite link (no password sent)
// PUT  { token, password, name } -> invitee sets their OWN password and is signed in
// GET  ?t=token                  -> what this link is for, before they commit

export async function GET(req: NextRequest) {
  ensureAuthSchema();
  const t = req.nextUrl.searchParams.get("t") || "";
  const inv = inviteFor(t);
  if (!inv) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({
    valid: true, email: inv.email, role: inv.role,
    existing: !!findUserByEmail(inv.email),
  });
}

export async function POST(req: NextRequest) {
  ensureAuthSchema();
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!canAssign(g.user)) {
    return NextResponse.json({ error: "Only managers can invite people." }, { status: 403 });
  }
  const { email } = await req.json();
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const token = createInvite(email, g.user.id);
  // The link is returned to the manager to pass on — we never email a password.
  return NextResponse.json({ ok: true, email: String(email).toLowerCase(),
    role: resolveRole(email), link: inviteLink(token) });
}

export async function PUT(req: NextRequest) {
  ensureAuthSchema();
  const { token, password, name } = await req.json();
  const inv = inviteFor(String(token || ""));
  if (!inv) return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
  if (!password || String(password).length < 8) {
    return NextResponse.json({ error: "Choose a password of at least 8 characters." }, { status: 400 });
  }

  // Role comes from the email, but setting a password must never cost someone
  // the access they already had — pass the current role so it can only go up.
  const existing: any = findUserByEmail(inv.email);
  const role = resolveRole(inv.email, undefined, existing?.role);
  const id = existing
    ? (setPassword(existing.id, String(password)), existing.id)
    : createUser({ email: inv.email, password: String(password), name: name || "", role });
  if (existing && existing.role !== role) {
    const { run } = await import("@/lib/db");
    run("UPDATE users SET role=? WHERE id=?", role, id);
  }

  consumeInvite(String(token));
  const session = newSession(id);
  // An invited bandmate joins for real the moment they sign in.
  try { linkUserByEmail(Number(id), String(inv.email || "")); } catch {}
  // An invite redemption is a signup too — if that address was referred, the
  // referrer's charge date moves.
  try { convert(Number(id), String(inv.email || "")); } catch {}
  const res = NextResponse.json({ user: { id, email: inv.email, display_name: name || existing?.display_name || "", role } });
  res.cookies.set(SESSION_COOKIE, session, cookieOpts(req));
  return res;
}
