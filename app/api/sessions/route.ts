import { NextRequest, NextResponse } from "next/server";
import { all, run, getDb } from "@/lib/db";
import { saveAudio } from "@/lib/sessions";
import { isElevated, requireUser, ownsBand, forbid } from "@/lib/guard";
export const dynamic = "force-dynamic";

// ~25 MB of audio; base64 inflates ~4/3, so cap the string a bit above that.
const MAX_B64_CHARS = 35000000;

function ensureSessionSchema(){
  const db = getDb();
  try{ db.exec("ALTER TABLE sessions ADD COLUMN visibility TEXT DEFAULT 'private'"); }catch{}
  try{ db.exec("ALTER TABLE sessions ADD COLUMN user_id INTEGER"); }catch{}
}

export async function GET(req:NextRequest){
  ensureSessionSchema();
  const mine = req.nextUrl.searchParams.get("mine");
  if (mine) {
    const g = requireUser(req); if (g.deny) return g.deny;
    const rows = all(`SELECT s.*, b.name band FROM sessions s LEFT JOIN bands b ON b.id=s.band_id
           WHERE s.user_id=? AND s.status='published'
           ORDER BY s.created_at DESC`, g.user.id);
    return NextResponse.json({ sessions: rows });
  }
  const bandId = req.nextUrl.searchParams.get("bandId");
  // Public listing only ever shows takes explicitly made public.
  const rows = bandId
    ? all(`SELECT s.*, b.name band FROM sessions s JOIN bands b ON b.id=s.band_id
           WHERE s.band_id=? AND s.status='published' AND COALESCE(s.visibility,'private')='public'
           ORDER BY s.created_at DESC`, Number(bandId))
    : all(`SELECT s.*, b.name band FROM sessions s JOIN bands b ON b.id=s.band_id
           WHERE s.status='published' AND COALESCE(s.visibility,'private')='public'
           ORDER BY s.created_at DESC`);
  return NextResponse.json({ sessions: rows });
}

export async function POST(req:NextRequest){
  ensureSessionSchema();
  const g = requireUser(req); if (g.deny) return g.deny;
  const b = await req.json();
  if(!b.audioBase64) return NextResponse.json({ error:"audioBase64 required" },{status:400});
  const bandId = b.band_id ? Number(b.band_id) : (g.user.band_id || null);
  if (b.band_id && !ownsBand(g.user, bandId)) return forbid("You can only attach takes to your own band.");
  if (String(b.audioBase64).length > MAX_B64_CHARS)
    return NextResponse.json({ error:"Audio too large - keep takes under ~25 MB." },{status:413});
  const ext = (b.mime||"audio/wav").includes("wav") ? "wav" : (b.mime||"").includes("mpeg") ? "mp3" : "webm";
  const key = saveAudio(b.audioBase64, ext);
  // Private by default - honours the "nothing leaves until you publish" promise.
  const visibility = b.visibility === "public" && bandId && (ownsBand(g.user, bandId) || isElevated(g.user)) ? "public" : "private";
  const r = run(`INSERT INTO sessions(user_id,band_id,title,kind,audio_key,mime,duration_ms,enhanced,ai_upscaled,status,visibility)
    VALUES(?,?,?,?,?,?,?,?,?, 'published', ?)`,
    g.user.id, bandId, (b.title||"Floor session").slice(0,120), b.kind||"idea", key, b.mime||"audio/wav",
    b.duration_ms||0, b.enhanced?1:0, b.ai_upscaled?1:0, visibility);
  return NextResponse.json({ id:r.lastInsertRowid, key, visibility, url:`/api/sessions/audio?key=${key}` });
}
