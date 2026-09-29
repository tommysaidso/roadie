import { NextRequest, NextResponse } from "next/server";
import { userForToken, ssoToken, SESSION_COOKIE } from "@/lib/auth";
export const dynamic = "force-dynamic";
// One login, both worlds: hand mymymy a short-lived signed token for the same user.
// No ROADIE session yet? They asked for mymymy — send them straight there (they
// sign in on mymymy with their real identity and hop back via mymymy's
// "ROADIE →", which auto-provisions their ROADIE account). Never dump them at a
// ROADIE password wall they have no account for.
export async function GET(req:NextRequest){
  const base = process.env.MYMYMY_PUBLIC_URL || "https://app.mymymy.studio";
  const u = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if(!u) return NextResponse.redirect(base);
  const token = ssoToken({ email:u.email, name:u.display_name, role:u.role });
  return NextResponse.redirect(token ? `${base}/sso?token=${encodeURIComponent(token)}` : base);
}
