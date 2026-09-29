import { NextRequest, NextResponse } from "next/server";
import { getDb, one } from "@/lib/db";
import { SESSION_COOKIE, ssoToken, userForToken } from "@/lib/auth";
import { isElevated, ownsBand } from "@/lib/guard";

export const dynamic = "force-dynamic";

function ensureSessionSchema(){
  try{ getDb().exec("ALTER TABLE sessions ADD COLUMN visibility TEXT DEFAULT 'private'"); }catch{}
  try{ getDb().exec("ALTER TABLE sessions ADD COLUMN user_id INTEGER"); }catch{}
}

export async function GET(req: NextRequest) {
  ensureSessionSchema();
  const user = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.redirect(new URL("/signin", process.env.ROADIE_PUBLIC_URL || "https://roadie.mymymy.studio"));

  const key = req.nextUrl.searchParams.get("key") || "";
  const row: any = one(
    "SELECT s.audio_key,s.user_id,s.band_id,s.title,s.kind,s.mime,s.duration_ms,b.name band FROM sessions s LEFT JOIN bands b ON b.id=s.band_id WHERE s.audio_key=?",
    key,
  );
  const ownsAccountTake = row?.user_id && Number(user.id) === Number(row.user_id);
  const ownsBandTake = row?.band_id && ownsBand(user, row.band_id);
  if (!row || (!ownsAccountTake && !ownsBandTake && !isElevated(user))) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const roadieBase = process.env.ROADIE_PUBLIC_URL || req.nextUrl.origin;
  const mymymyBase = process.env.MYMYMY_PUBLIC_URL || "https://app.mymymy.studio";
  const exportToken = ssoToken({
    email: user.email,
    name: user.display_name,
    role: user.role,
    roadie_audio_key: row.audio_key,
    title: row.title,
    mime: row.mime,
  });
  const importUrl = `${roadieBase}/api/sessions/export?token=${encodeURIComponent(exportToken)}`;
  const next = `/deck?roadieImport=${encodeURIComponent(importUrl)}&roadieTitle=${encodeURIComponent(row.title || "Roadie floor session")}`;
  const loginToken = ssoToken({ email: user.email, name: user.display_name, role: user.role });

  if (!exportToken || !loginToken) {
    return NextResponse.redirect(`${mymymyBase}/deck`);
  }
  return NextResponse.redirect(`${mymymyBase}/sso?token=${encodeURIComponent(loginToken)}&next=${encodeURIComponent(next)}`);
}
