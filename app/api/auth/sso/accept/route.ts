import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ensureAuthSchema, verifySsoToken, findUserByEmail, createUser, newSession, SESSION_COOKIE, cookieOpts } from "@/lib/auth";
import { resolveRole } from "@/lib/roles";
export const dynamic = "force-dynamic";

// Inbound half of "one login, both worlds". mymymy verified this user's email
// (Google / Apple / magic-link) and handed us a short-lived signed token. We
// trust it — mymymy owns identity — find or AUTO-CREATE the matching ROADIE
// user (no ROADIE password), start a session, and drop them in. This is what
// lets a mymymy-only user (e.g. Google sign-in) into ROADIE at all.
export async function GET(req:NextRequest){
  ensureAuthSchema();
  const url = new URL(req.url);
  // Behind the tunnel req.url is http://localhost:3001 — that's the address the
  // container sees itself on. Building the redirect off it sent people to
  // localhost at the last hop of the handoff, so every "go to ROADIE" click
  // from mymymy died on ERR_CONNECTION_REFUSED. Redirect against the PUBLIC
  // origin instead, falling back to the forwarded host the proxy gives us.
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  const publicBase = (process.env.ROADIE_PUBLIC_URL
    || (fwdHost ? `${fwdProto}://${fwdHost}` : url.origin)).replace(/\/$/, "");

  const token = url.searchParams.get("token") || "";
  const next = url.searchParams.get("next") || "/";
  const p:any = verifySsoToken(token);
  if(!p || !p.email) return NextResponse.redirect(new URL("/?signin=1", publicBase));
  const email = String(p.email).toLowerCase();
  let u:any = findUserByEmail(email);
  if(!u){
    // Defaulting to "fan" here is what made every Google sign-in land with no
    // access — owners included. The email decides, same as everywhere else.
    createUser({ email, password: crypto.randomBytes(24).toString("hex"),
      name: p.name||"", role: resolveRole(email, p.role) });
    u = findUserByEmail(email);
  }
  if(!u) return NextResponse.redirect(new URL("/?signin=1", publicBase));
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, publicBase));
  // cookieOpts() with no request falls back to NODE_ENV for the Secure flag
  // instead of reading x-forwarded-proto — the exact case cookieOpts was given
  // a `req` parameter to handle. Behind the tunnel that mis-set the flag on the
  // one cookie the whole cross-app handoff depends on.
  res.cookies.set(SESSION_COOKIE, newSession(u.id), cookieOpts(req));
  return res;
}
