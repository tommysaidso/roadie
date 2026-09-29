import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { verifySsoToken } from "@/lib/auth";
import { readAudio } from "@/lib/sessions";

export const dynamic = "force-dynamic";

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  const allowed = [
    "http://localhost:3000",
    "https://app.mymymy.studio",
    process.env.MYMYMY_PUBLIC_URL || "",
  ].filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : "https://app.mymymy.studio";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  const payload: any = verifySsoToken(req.nextUrl.searchParams.get("token") || "");
  const key = String(payload?.roadie_audio_key || "");
  if (!key) return new NextResponse("Not found", { status: 404, headers });

  const row: any = one("SELECT title,mime FROM sessions WHERE audio_key=?", key);
  const buf = readAudio(key);
  if (!row || !buf) return new NextResponse("Not found", { status: 404, headers });

  const mime = row.mime || (key.endsWith(".mp3") ? "audio/mpeg" : key.endsWith(".webm") ? "audio/webm" : "audio/wav");
  const safeTitle = String(row.title || "roadie_floor_session").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80);
  const ext = key.split(".").pop() || "wav";
  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...headers,
      "content-type": mime,
      "content-length": String(buf.length),
      "content-disposition": `attachment; filename="${safeTitle}.${ext}"`,
      "cache-control": "private, no-store",
      "x-roadie-title": encodeURIComponent(row.title || "Roadie floor session"),
    },
  });
}
