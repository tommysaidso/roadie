import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive } from "@/lib/google";
import { requireUser } from "@/lib/guard";
export const dynamic = "force-dynamic";
// Save a poster / pitch / contract to the band or venue's Google Drive.
// Requires a signed-in user — this touches the connected Google account.
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  try{
    const { name, mimeType, dataBase64, folderId } = await req.json();
    if(!name || !dataBase64) return NextResponse.json({ error:"name + dataBase64 required" },{status:400});
    const r = await uploadToDrive({ name, mimeType: mimeType||"image/png", dataBase64, folderId });
    return NextResponse.json({ ok:true, ...r });
  }catch(e:any){ return NextResponse.json({ error:e.message },{status:500}); }
}
