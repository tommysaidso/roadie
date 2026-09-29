import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/guard";
import { llmAnswer } from "@/lib/llm";
export const dynamic = "force-dynamic";
// Drafts profile copy as the user signs up. Free + protects their IP (registered to them via mymymy).
export async function POST(req:NextRequest){
  const _l = rateLimit(req, "autofill", 30, 60*60*1000); if (_l) return _l;
  const { role, name, city, genre } = await req.json();
  let bio_short = "", bio = "";
  if(role==="band"){
    bio_short = `${genre||"Live"} band from ${city||"BC"}.`;
    bio = `${name} is a ${genre||"live"} act from ${city||"BC"}, Canada. Profile auto-started on ROADIE — your content stays registered to you. Edit the bio, draw, rate and dates anytime.`;
    try{
      const t = await llmAnswer(`Write a punchy one-line bio_short and a 2-sentence bio for a ${genre} band called "${name}" from ${city}, BC. Keep it factual and original. Format exactly:\nSHORT: <one line>\nBIO: <two sentences>`, "");
      if(t){ const sm=t.match(/SHORT:\s*(.+)/i); const bm=t.match(/BIO:\s*([\s\S]+)/i);
        if(sm) bio_short=sm[1].trim(); if(bm) bio=bm[1].trim(); }
    }catch{}
  } else if(role==="venue"){
    bio = `${name} — live-music venue in ${city||"BC"}. Listed on ROADIE; post your open nights and let AI place bands.`;
  }
  return NextResponse.json({ bio_short, bio });
}
