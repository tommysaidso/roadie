import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema, userForToken, SESSION_COOKIE } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  ensureAuthSchema();
  const user = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user: user||null });
}
