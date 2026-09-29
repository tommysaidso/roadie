import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE, cookieOpts } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req:NextRequest){
  destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok:true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOpts(), maxAge:0 });
  return res;
}
