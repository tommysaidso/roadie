import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema, findUserByEmail, verifyPassword, newSession, SESSION_COOKIE, cookieOpts } from "@/lib/auth";
import { linkUserByEmail } from "@/lib/bandmembers";
import { rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function POST(req:NextRequest){
  ensureAuthSchema();
  // Public endpoint with no throttle was unlimited password guessing.
  const limited = rateLimit(req, "login", 15);
  if (limited) return limited;
  const { email, password } = await req.json();
  const u = findUserByEmail(email||"");
  if(!u || !u.pass_hash || !verifyPassword(password||"", u.pass_salt, u.pass_hash))
    return NextResponse.json({ error:"Email or password is wrong." },{status:401});
  const token = newSession(u.id);
  // An invited bandmate joins for real the moment they sign in.
  try { linkUserByEmail(Number(u.id), String(u.email || "")); } catch {}
  const res = NextResponse.json({ user:{ id:u.id, email:u.email, display_name:u.display_name, role:u.role, band_id:u.band_id, venue_id:u.venue_id, sponsor_id:u.sponsor_id } });
  res.cookies.set(SESSION_COOKIE, token, cookieOpts(req));
  return res;
}
