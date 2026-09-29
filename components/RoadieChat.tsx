"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
const SUGGEST=["find open slots","plan an Okanagan runout","site permits & all-ages rules","noise curfew in Kelowna","what perks can we claim"];

export default function RoadieChat(){
  const [log,setLog]=useState<{role:string;text:string}[]>([{role:"bot",text:"I'm your ROADIE — your AI tour manager. Tap the mic and talk, or type. I'll answer out loud."}]);
  const [q,setQ]=useState(""); const [listening,setListening]=useState(false);
  const [speak,setSpeak]=useState(true); const [provider,setProvider]=useState("offline");
  const recRef=useRef<any>(null); const endRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[log]);

  useEffect(()=>{
    const SR=(globalThis as any).webkitSpeechRecognition||(globalThis as any).SpeechRecognition;
    if(SR){ const r=new SR(); r.lang="en-CA"; r.interimResults=false; r.maxAlternatives=1;
      r.onresult=(e:any)=>{ const t=e.results[0][0].transcript; setListening(false); send(t); };
      r.onend=()=>setListening(false); r.onerror=()=>setListening(false); recRef.current=r; }
  },[]);

  function toggleMic(){ const r=recRef.current; if(!r){ alert("Voice input needs Chrome/Edge. You can still type."); return; }
    if(listening){ r.stop(); setListening(false); } else { try{ r.start(); setListening(true);}catch{} } }

  async function say(text:string){
    if(!speak) return;
    try{
      const r=await fetch("/api/voice",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})});
      if(r.status===200){ const buf=await r.arrayBuffer(); const a=new Audio(URL.createObjectURL(new Blob([buf],{type:"audio/wav"}))); a.play(); return; }
    }catch{}
    // browser fallback
    if("speechSynthesis" in window){ const u=new SpeechSynthesisUtterance(text); u.lang="en-CA"; u.rate=1.02; speechSynthesis.speak(u); }
  }

  async function send(text?:string){
    const m=(text??q).trim(); if(!m)return;
    setLog(l=>[...l,{role:"you",text:m}]); setQ("");
    const r=await fetch("/api/assistant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({q:m})});
    const d=await r.json(); setProvider(d.provider||"offline");
    setLog(l=>[...l,{role:"bot",text:d.answer}]); say(d.answer);
  }

  return (
    <div className="card flex flex-col" style={{height:"70vh"}}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge text-xs text-muted">
        <span className="flex items-center gap-1"><Bot size={13}/> ROADIE · brain: <b className="text-cyan">{provider}</b></span>
        <button onClick={()=>setSpeak(s=>!s)} className="flex items-center gap-1 hover:text-white">{speak?<Volume2 size={14}/>:<VolumeX size={14}/>}{speak?"voice on":"voice off"}</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll">
        {log.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="you"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${m.role==="you"?"bg-neon text-ink":"bg-panel2"}`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="p-3 border-t border-edge">
        <div className="flex gap-2 flex-wrap mb-2">{SUGGEST.map(s=><button key={s} onClick={()=>send(s)} className="pill hover:border-neon">{s}</button>)}</div>
        <div className="flex gap-2">
          <button onClick={toggleMic} className={`btn ${listening?"btn-neon animate-pulse":""}`} title="talk">{listening?<MicOff size={16}/>:<Mic size={16}/>}</button>
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={listening?"listening…":"Ask ROADIE…"} className="flex-1 bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"/>
          <button onClick={()=>send()} className="btn btn-neon flex items-center gap-1"><Send size={15}/></button>
        </div>
        <div className="text-[11px] text-muted mt-2">Mic uses your browser's speech (Chrome/Edge). Talk-back uses Gemini voice when a key is set, else your browser voice. Brain upgrades to Gemini/Claude automatically when a key is in <code>.env</code>.</div>
      </div>
    </div>
  );
}
