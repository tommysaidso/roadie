import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";

// Gemini TTS -> 24kHz PCM16 -> wrapped as WAV. Best-effort; on any miss returns 204
// so the browser falls back to its built-in speechSynthesis. Activates with GEMINI_API_KEY.
export async function POST(req:NextRequest){
  const _l = rateLimit(req, "voice", 60, 60*60*1000); if (_l) return _l;
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean) as string[];
  if(keys.length===0) return new NextResponse(null,{status:204});
  const { text } = await req.json();
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  for(const key of keys){
   try{
    const voice = process.env.GEMINI_TTS_VOICE || "Charon";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url,{ method:"POST", headers:{"content-type":"application/json"}, signal:AbortSignal.timeout(9000),
      body: JSON.stringify({ contents:[{parts:[{text:String(text||"").slice(0,600)}]}],
        generationConfig:{ responseModalities:["AUDIO"], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:voice } } } } }) });
    if(!r.ok) continue;
    const d = await r.json();
    const b64 = d?.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData)?.inlineData?.data;
    if(!b64) continue;
    const pcm = Buffer.from(b64,"base64");
    const wav = wrapWav(pcm, 24000, 1, 16);
    return new NextResponse(wav,{ status:200, headers:{ "content-type":"audio/wav" } });
   }catch{ /* try next key */ }
  }
  return new NextResponse(null,{status:204});
}

function wrapWav(pcm:Buffer, rate:number, ch:number, bits:number):Buffer{
  const blockAlign = ch*bits/8, byteRate = rate*blockAlign;
  const h = Buffer.alloc(44);
  h.write("RIFF",0); h.writeUInt32LE(36+pcm.length,4); h.write("WAVE",8);
  h.write("fmt ",12); h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(ch,22);
  h.writeUInt32LE(rate,24); h.writeUInt32LE(byteRate,28); h.writeUInt16LE(blockAlign,32); h.writeUInt16LE(bits,34);
  h.write("data",36); h.writeUInt32LE(pcm.length,40);
  return Buffer.concat([h,pcm]);
}
