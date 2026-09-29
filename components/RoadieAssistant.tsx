"use client";
import { useEffect, useRef, useState } from "react";
import { Guitar, X, Send, Mic, MicOff, Volume2, VolumeX, Minus, GripVertical } from "lucide-react";

const SUGGEST = ["what is ROADIE", "get started as a band", "find open slots", "plan an Okanagan runout", "what perks can we claim"];
const GENERIC = "Welcome to My Music, My Money, My Hustle — I'm ROADIE, your guide to the whole thing.\n\nROADIE gets bands on stages — free profile, venues, AI booking, tour map, posters, Floor Sessions, and fans. mymymy turns your catalog into money (registration & royalties).\n\nAsk me anything, no sign-in needed. New here? Say 'what is ROADIE' — or tell me your name and I'll remember you.";

function getName(){ try{ return localStorage.getItem("roadie_name")||""; }catch{ return ""; } }
function getPass(){ try{ return localStorage.getItem("roadie_pass")||""; }catch{ return ""; } }

export default function RoadieAssistant(){
  const [open,setOpen]=useState(false);
  const [minimized,setMinimized]=useState(false);

  // One helper, one entry point. The shell keeps its own "Ask ROADIE" buttons
  // (sidebar, mobile header, drawer) and they used to sit on screen next to the
  // open panel — two invitations to the same thing, worst of all in the mobile
  // stack. Broadcasting the state lets the shell hide its copies while the
  // assistant is up.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("roadie:assistant",
      { detail: { showing: open && !minimized } }));
  }, [open, minimized]);
  const [log,setLog]=useState<{role:string;text:string}[]>([{role:"bot",text:GENERIC}]);
  const [q,setQ]=useState("");
  const [thinking,setThinking]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const [micOn,setMicOn]=useState(false);
  const [speak,setSpeak]=useState(true);
  const [provider,setProvider]=useState("offline");
  // pos.x < 0 means "use default bottom-right anchor"
  const [pos,setPos]=useState<{x:number;y:number}>({x:-1,y:-1});
  const [size,setSize]=useState<{w:number;h:number}>({w:384,h:600});
  const dragRef=useRef<{ox:number;oy:number;mx:number;my:number}|null>(null);
  const resizeRef=useRef<{ow:number;oh:number;mx:number;my:number}|null>(null);
  const abortRef=useRef<AbortController|null>(null);
  // The reply is spoken through an <audio> element, not speechSynthesis. It has
  // to be reachable or there is no way to shut it up.
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const recRef=useRef<any>(null); const micOnRef=useRef(false); const speakingRef=useRef(false); const awaitPass=useRef(false);
  const endRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ micOnRef.current=micOn; },[micOn]);

  // Restore persisted panel geometry
  useEffect(()=>{
    try {
      const raw=localStorage.getItem("roadie_panel"); if(!raw) return;
      const j=JSON.parse(raw);
      if(j.pos) setPos(j.pos);
      if(j.size) setSize(j.size);
    } catch {}
  },[]);
  // Persist geometry on change
  useEffect(()=>{
    try { localStorage.setItem("roadie_panel", JSON.stringify({pos,size})); } catch {}
  },[pos,size]);

  // Open-event listener + name/pass greeting
  useEffect(()=>{
    const o=(e:any)=>{ setOpen(true); setMinimized(false); const a=e?.detail?.ask; if(a) setTimeout(()=>send(String(a)),250); };
    window.addEventListener("roadie:open",o as any);
    try{
      const sp = new URLSearchParams(window.location.search);
      const ask = sp.get("ask");
      const band = sp.get("band");
      // ?ask=1 opens blank; ?ask=<text> opens AND asks it (hub chips, Garage links).
      if(ask){ setOpen(true); if(ask !== "1") setTimeout(()=>send(ask), 350); }
      else if(band){ setOpen(true); setTimeout(()=>send("find gigs for my band"), 350); }
    }catch{}
    const name=getName(), pass=getPass();
    if(name){
      if(pass){ awaitPass.current=true; setLog([{role:"bot",text:`Hey ${name}, welcome back. Say or type your pass phrase and we're off.`}]); }
      else setLog([{role:"bot",text:`Hey ${name}, welcome back — what's the plan today?`}]);
    }
    return ()=>window.removeEventListener("roadie:open",o as any);
  },[]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[log,open]);

  function bot(text:string){ setLog(l=>[...l,{role:"bot",text}]); speakText(text); }
  function handleIdentity(m:string):boolean{
    const name=getName(), pass=getPass();
    if(awaitPass.current && pass){
      if(m.trim().toLowerCase()===pass.toLowerCase()){ awaitPass.current=false; bot(`Perfect — good to see you, ${name}. What's the plan today?`); return true; }
      if(/forget me|reset me|not me/i.test(m)){ try{localStorage.removeItem("roadie_name");localStorage.removeItem("roadie_pass");}catch{}; awaitPass.current=false; bot("Cleared — who do I have the pleasure of helping?"); return true; }
      bot("Hmm, that's not your pass phrase. Try again, or say 'forget me' to reset."); return true;
    }
    let mt=m.match(/^(?:my name is|call me|i'?m)\s+([a-z][a-z .'-]{1,24})$/i);
    if(mt){ const nm=mt[1].trim(); try{localStorage.setItem("roadie_name",nm);}catch{}; bot(`Hey ${nm}, welcome aboard — I'll remember you on this device. What's the plan? (Set a pass phrase too: "set my pass phrase to ___".)`); return true; }
    mt=m.match(/^set (?:my )?(?:pass ?phrase|password) to\s+(.+)$/i);
    if(mt){ try{localStorage.setItem("roadie_pass",mt[1].trim());}catch{}; bot("Got it — pass phrase set on this device. Heads up: this is a friendly hello, not a secure login."); return true; }
    if(/forget me|reset me|not me|sign me out/i.test(m)){ try{localStorage.removeItem("roadie_name");localStorage.removeItem("roadie_pass");}catch{}; bot("Done — forgotten on this device."); return true; }
    return false;
  }
  function ensureRec(){
    if(recRef.current) return recRef.current;
    const SR=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
    if(!SR) return null;
    const r=new SR(); r.lang="en-CA"; r.continuous=true; r.interimResults=true;
    r.onresult=(e:any)=>{ let fin=""; for(let i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal) fin+=e.results[i][0].transcript; }
      if(fin.trim()){ speakingRef.current=true; try{ r.stop(); }catch{}; send(fin.trim()); } };
    r.onerror=()=>{};
    r.onend=()=>{ if(micOnRef.current && !speakingRef.current){ try{ r.start(); }catch{} } };
    recRef.current=r; return r;
  }
  function toggleMic(){
    const r=ensureRec(); if(!r){ alert("Voice needs Chrome/Edge — you can still text me."); return; }
    if(micOn){ setMicOn(false); micOnRef.current=false; try{ r.stop(); }catch{} }
    else { speakingRef.current=false; setMicOn(true); micOnRef.current=true; setOpen(true); setMinimized(false); try{ r.start(); }catch{} }
  }
  async function speakText(text:string){
    const done=()=>{ try{ window.dispatchEvent(new Event("roadie:quiet")); }catch{}; speakingRef.current=false; if(micOnRef.current){ try{ recRef.current?.start(); }catch{} } };
    if(!speak){ done(); return; }
    try{
      const r=await fetch("/api/voice",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})});
      if(r.status===200){
        const buf=await r.arrayBuffer();
        const url=URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
        const a=new Audio(url);
        audioRef.current=a; setSpeaking(true);
        const finish=()=>{ URL.revokeObjectURL(url); if(audioRef.current===a){audioRef.current=null; setSpeaking(false);} done(); };
        a.onended=finish; a.onerror=finish;
        try{window.dispatchEvent(new Event("roadie:speaking"));}catch{}
        a.play().catch(finish);
        return;
      }
    }catch{}
    if("speechSynthesis" in window){
      const u=new SpeechSynthesisUtterance(text); u.lang="en-CA"; u.rate=1.02;
      setSpeaking(true);
      u.onend=()=>{ setSpeaking(false); done(); };
      try{window.dispatchEvent(new Event("roadie:speaking"));}catch{}
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }
    else done();
  }
  /**
   * Stop everything: the in-flight request AND the speech.
   *
   * There was no way to interrupt a reply — once it was sent you waited, and if
   * it was talking you waited for that too. For an assistant whose whole point
   * is being interruptible, that was the wrong shape.
   */
  function stopAll(){
    try{ abortRef.current?.abort(); }catch{}
    abortRef.current=null;
    setThinking(false);
    speakingRef.current=false;
    // The <audio> element is the one that actually makes noise.
    try{ const a=audioRef.current; if(a){ a.pause(); a.currentTime=0; } }catch{}
    audioRef.current=null; setSpeaking(false);
    try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch{}
    try{ window.dispatchEvent(new Event("roadie:spoke")); }catch{}
  }

  async function send(text?:string){
    const m=(text??q).trim(); if(!m) return; setQ("");
    setLog(l=>[...l,{role:"you",text:m}]);
    if(handleIdentity(m)) return;
    // A new question cancels the previous one rather than racing it.
    stopAll();
    const ac=new AbortController(); abortRef.current=ac; setThinking(true);
    try{
      const r=await fetch("/api/assistant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({q:m}),signal:ac.signal});
      const d=await r.json();
      if(ac.signal.aborted) return;
      setProvider(d.provider||"offline");
      setLog(l=>[...l,{role:"bot",text:d.answer}]); speakText(d.answer);
    }catch(e:any){
      if(e?.name!=="AbortError") setLog(l=>[...l,{role:"bot",text:"That one didn't come back — ask me again."}]);
      speakingRef.current=false; if(micOnRef.current){ try{ recRef.current?.start(); }catch{} }
    } finally {
      if(abortRef.current===ac){ abortRef.current=null; setThinking(false); }
    }
  }

  // Escape stops it from anywhere, which is what a person reaches for first.
  useEffect(()=>{
    const k=(e:KeyboardEvent)=>{ if(e.key==="Escape") stopAll(); };
    window.addEventListener("keydown",k);
    return ()=>window.removeEventListener("keydown",k);
  },[]);

  // ----- drag / resize handlers (desktop only — buttons & inputs are excluded) -----
  function onHeaderPointerDown(e: React.PointerEvent){
    if((e.target as HTMLElement).closest("button")) return;
    const cur = pos.x < 0
      ? { x: Math.max(8, window.innerWidth - size.w - 16), y: Math.max(8, window.innerHeight - size.h - 16) }
      : pos;
    dragRef.current = { ox: cur.x, oy: cur.y, mx: e.clientX, my: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onHeaderPointerMove(e: React.PointerEvent){
    if(!dragRef.current) return;
    const dx=e.clientX-dragRef.current.mx, dy=e.clientY-dragRef.current.my;
    const nx=Math.max(0, Math.min(window.innerWidth-size.w, dragRef.current.ox+dx));
    const ny=Math.max(0, Math.min(window.innerHeight-40,    dragRef.current.oy+dy));
    setPos({x:nx,y:ny});
  }
  function onHeaderPointerUp(e: React.PointerEvent){
    dragRef.current=null;
    try{ (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }catch{}
  }
  function onResizePointerDown(e: React.PointerEvent){
    e.stopPropagation();
    resizeRef.current = { ow: size.w, oh: size.h, mx: e.clientX, my: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizePointerMove(e: React.PointerEvent){
    if(!resizeRef.current) return;
    const dw=e.clientX-resizeRef.current.mx, dh=e.clientY-resizeRef.current.my;
    setSize({
      w: Math.max(280, Math.min(820, resizeRef.current.ow+dw)),
      h: Math.max(280, Math.min(window.innerHeight-40, resizeRef.current.oh+dh)),
    });
  }
  function onResizePointerUp(e: React.PointerEvent){
    resizeRef.current=null;
    try{ (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }catch{}
  }
  function resetPanel(){ setPos({x:-1,y:-1}); setSize({w:384,h:600}); }

  const desktopStyle: React.CSSProperties = (pos.x < 0)
    ? { right: 16, bottom: 16, width: size.w, height: size.h }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  const HeaderBar = (
    <div
      onPointerDown={onHeaderPointerDown}
      onPointerMove={onHeaderPointerMove}
      onPointerUp={onHeaderPointerUp}
      className="flex items-center justify-between px-3 py-2.5 card-h border-b border-edge select-none cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2 min-w-0">
        <GripVertical size={14} className="text-muted shrink-0 hidden lg:inline"/>
        <Guitar size={16} className="text-neon shrink-0"/>
        <span className="font-bold text-sm">Ask ROADIE</span>
        <span className="text-[10px] text-muted truncate">brain: <b className="text-cyan">{provider}</b></span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={()=>setSpeak(s=>{ if(s) stopAll(); return !s; })} aria-label="voice" className="p-1.5 text-muted hover:text-white">{speak?<Volume2 size={16}/>:<VolumeX size={16}/>}</button>
        <button onClick={resetPanel} aria-label="reset position" title="reset position + size" className="hidden lg:inline p-1.5 text-muted hover:text-white text-[10px]">⤢</button>
        <button onClick={()=>setMinimized(true)} aria-label="minimize" title="minimize" className="p-1.5 text-muted hover:text-white"><Minus size={16}/></button>
        <button onClick={()=>setOpen(false)} aria-label="close" className="p-1.5 text-muted hover:text-white"><X size={18}/></button>
      </div>
    </div>
  );

  const BodyEl = (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll">
        {log.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="you"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role==="you"?"bg-neon text-ink":"bg-panel2"}`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="p-3 border-t border-edge">
        {micOn && <div className="text-[11px] text-neon mb-2 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-neon animate-ping"/>listening — just talk; tap the mic to stop</div>}
        <div className="flex gap-1.5 flex-wrap mb-2">{SUGGEST.map(s=><button key={s} onClick={()=>send(s)} className="pill hover:border-neon">{s}</button>)}</div>
        <div className="flex gap-2">
          <button onClick={toggleMic} className={`btn ${micOn?"btn-neon animate-pulse":""}`} aria-label="talk">{micOn?<MicOff size={16}/>:<Mic size={16}/>}</button>
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={micOn?"listening…":thinking?"thinking — Esc to stop":speaking?"talking — Esc to stop":"Ask or type…"} className="flex-1 bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"/>
          {(thinking||speaking)
            ? <button onClick={stopAll} title="Stop (Esc)"
                className="btn flex items-center gap-1" style={{ borderColor:"#ff3d6e", color:"#ff3d6e" }}>
                <span style={{width:10,height:10,background:"#ff3d6e",borderRadius:2,display:"inline-block"}}/>
                Stop
              </button>
            : <button onClick={()=>send()} className="btn btn-neon flex items-center gap-1"><Send size={15}/></button>}
        </div>
      </div>
    </>
  );

  return (
    <>
      {(!open || minimized) && (
        <button onClick={()=>{ setOpen(true); setMinimized(false); }} aria-label="Ask ROADIE"
          className="fixed right-4 bottom-20 lg:bottom-6 z-40 flex items-center gap-2 rounded-full pl-3 pr-4 h-12 shadow-glow"
          style={{ background:"#ff3d6e", color:"#0b0b0f" }}>
          <Guitar size={20}/><span className="text-sm font-bold">Ask ROADIE</span>
        </button>
      )}
      {open && !minimized && (
        <>
          {/* Mobile: anchored bottom sheet (no drag/resize on touch) */}
          <div className="lg:hidden fixed z-50 inset-x-0 bottom-0">
            <div className="card flex flex-col mx-2 mb-2 rounded-2xl overflow-hidden" style={{ height:"72vh", maxHeight:600 }}>
              {HeaderBar}
              {BodyEl}
            </div>
          </div>
          {/* Desktop: floating, draggable header, resizable bottom-right grip */}
          <div className="hidden lg:block fixed z-50" style={desktopStyle}>
            <div className="card flex flex-col rounded-2xl overflow-hidden h-full relative">
              {HeaderBar}
              {BodyEl}
              <div
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize"
                style={{ background:"linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)" }}
                title="drag to resize"
                aria-label="resize"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
