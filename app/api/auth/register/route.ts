import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema, findUserByEmail, createUser, newSession, SESSION_COOKIE, cookieOpts } from "@/lib/auth";
import { linkUserByEmail } from "@/lib/bandmembers";
import { convert } from "@/lib/referrals";
import { resolveRole } from "@/lib/roles";
import { rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function POST(req:NextRequest){
  ensureAuthSchema();
  const limited = rateLimit(req, "register", 10);   // stops drive-by account farming
  if (limited) return limited;
  const { email, password, name, role, ref } = await req.json();
  if(!email || !/.+@.+\..+/.test(email)) return NextResponse.json({ error:"A valid email is required." },{status:400});
  // 8 to match the invite flow, which already required 8 — the two disagreed.
  if(!password || password.length<8) return NextResponse.json({ error:"Password must be at least 8 characters." },{status:400});
  if(findUserByEmail(email)) return NextResponse.json({ error:"That email already has an account — sign in instead." },{status:409});
  // The SERVER decides the role. Taking it off the request body let anyone
  // sign up as an admin; privileged roles now come from the email alone.
  const finalRole = resolveRole(email, role);
  const id = createUser({ email, password, name, role: finalRole });
  const token = newSession(id);
  // An invited bandmate joins for real the moment they sign in.
  try { linkUserByEmail(Number(id), String(email || "")); } catch {}
  // A referral becomes real HERE — a signup, never a click. `ref` comes off the
  // body we already parsed; re-reading the request would fail, it is consumed.
  try { convert(Number(id), String(email || ""), String(ref || "")); } catch {}
  const res = NextResponse.json({ user:{ id, email:String(email).toLowerCase(), display_name:name||"", role:finalRole } });
  res.cookies.set(SESSION_COOKIE, token, cookieOpts(req));
  return res;
}
