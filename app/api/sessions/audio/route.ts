import { NextRequest, NextResponse } from "next/server";
import { readAudio } from "@/lib/sessions";
import { getDb, one } from "@/lib/db";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
export const dynamic = "force-dynamic";
function ensureSessionSchema(){
  try{ getDb().exec("ALTER TABLE sessions ADD COLUMN visibility TEXT DEFAULT 'private'"); }catch{}
  try{ getDb().exec("ALTER TABLE sessions ADD COLUMN user_id INTEGER"); }catch{}
}
export async function GET(req:NextRequest){
  ensureSessionSchema();
  const key = req.nextUrl.searchParams.get("key")||"";
  const row:any = one("SELECT user_id,band_id, COALESCE(visibility,'private') visibility FROM sessions WHERE audio_key=?", key);
  const isPublic = row?.visibility === "public";
  if (row && !isPublic) {
    const u:any = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
    const elevated = u && (u.role === "admin" || u.role === "operator");
    const ownsAccountTake = u && row.user_id && Number(u.id) === Number(row.user_id);
    const ownsBandTake = u && row.band_id && Number(u.band_id) === Number(row.band_id);
    if (!u || (!elevated && !ownsAccountTake && !ownsBandTake))
      return new NextResponse("Not found",{status:404});   // do not reveal existence
  }
  const buf = readAudio(key);
  if(!buf) return new NextResponse("Not found",{status:404});
  const mime = key.endsWith(".mp3")?"audio/mpeg":key.endsWith(".webm")?"audio/webm":"audio/wav";
  return new NextResponse(buf,{ status:200, headers:{
    "content-type":mime, "accept-ranges":"bytes",
    "cache-control": isPublic ? "public, max-age=31536000" : "private, no-store",
  }});
}
