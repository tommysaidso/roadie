import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/google";
import { requireUser, rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";
// Email a pitch sheet / contract / poster link. ASK-BEFORE-SEND lives in the UI.
// Requires a signed-in user + a light per-IP cap so the mailbox can't be abused.
export async function POST(req:NextRequest){
  const g = requireUser(req); if (g.deny) return g.deny;
  const limited = rateLimit(req, "gsend", 30, 60*60*1000); if (limited) return limited;
  try{
    const { to, subject, html } = await req.json();
    if(!to || !subject) return NextResponse.json({ error:"to + subject required" },{status:400});
    const r = await sendEmail({ to, subject, html: html||"" });
    return NextResponse.json({ ok:true, ...r });
  }catch(e:any){ return NextResponse.json({ error:e.message },{status:500}); }
}
