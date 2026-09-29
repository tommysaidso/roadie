"use client";
import { useEffect, useState } from "react";
import { Guitar, Sparkles, ArrowRight, Wrench } from "lucide-react";

const COLS = 14, ROWS = 6;
function ask(text:string){ window.dispatchEvent(new CustomEvent("roadie:open",{ detail:{ ask:text } })); }
function openRoadie(){ window.dispatchEvent(new Event("roadie:open")); }
function entry(mode:string){ window.dispatchEvent(new CustomEvent("roadie:entry",{ detail:{ mode } })); }

export default function RoadieHero({ user }:{ user?:{ display_name?:string }|null }){
  const [name,setName]=useState<string|null>(null);   // null = unknown yet
  const [talking,setTalking]=useState(false);

  useEffect(()=>{
    let n=user?.display_name||""; if(!n){ try{ n=localStorage.getItem("roadie_name")||""; }catch{} }
    setName(n);
    const on=()=>setTalking(true), off=()=>setTalking(false);
    window.addEventListener("roadie:speaking",on); window.addEventListener("roadie:quiet",off);
    // open with it — greet on first arrival, once
    try{ if(!localStorage.getItem("roadie_seen")){ localStorage.setItem("roadie_seen","1"); if(!n) setTimeout(()=>entry("choose"),900); } }catch{}
    return ()=>{ window.removeEventListener("roadie:speaking",on); window.removeEventListener("roadie:quiet",off); };
  },[]);

  const known = !!name;
  const tiles = Array.from({length: COLS*ROWS});
  const tint = (i:number)=>{ const m=(i*7+Math.floor(i/COLS))%11; return m===0?"#ff3d6e":m===3?"#3df0ff":m===6?"#ffb33d":m===9?"#3ddc84":"#23232f"; };

  const guestChips = [
    ["What is ROADIE?","what is ROADIE"],
    ["How do I get gigs?","how do bands get gigs on ROADIE"],
    ["What does it cost?","what does it cost to join"],
    ["Tour the USA?","visa rules for touring the USA"],
  ];
  const userChips = [
    ["Find me a gig","find open slots that fit my band"],
    ["Plot a runout","plan an Okanagan runout"],
    ["New floor session","how do I record a floor session"],
    ["Make a poster","how do I make a gig poster"],
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-edge mb-2 md:mb-4" style={{ background:"#0b0b10", minHeight:260 }}>
      <div className={`absolute inset-0 grid gap-1 p-2 ${talking?"tiles-talking":""}`} style={{ gridTemplateColumns:`repeat(${COLS},1fr)`, opacity:.6 }} aria-hidden>
        {tiles.map((_,i)=>(
          <span key={i} className="r-tile" style={{ background:tint(i), aspectRatio:"1/1", animationDelay:`${(i%COLS)*0.07 + Math.floor(i/COLS)*0.06}s` }}/>
        ))}
      </div>
      <div className="absolute inset-0 r-hero-glow" style={{ background:"radial-gradient(120% 90% at 15% 10%, rgba(255,61,110,0.18), transparent 55%)" }} aria-hidden/>
      <div className="absolute inset-0" style={{ background:"linear-gradient(180deg, rgba(11,11,16,.30) 0%, rgba(11,11,16,.86) 78%)" }} aria-hidden/>

      <div className="relative p-4 sm:p-6 md:p-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative inline-flex h-6 w-6 items-center justify-center">
            <span className={`absolute inline-flex h-4 w-4 rounded-full ${talking?"animate-ping":""}`} style={{ background:"rgba(255,61,110,0.5)" }}/>
            <Guitar size={18} style={{ color:"#ff3d6e" }}/>
          </span>
          <span className="label" style={{ color:"#ff3d6e" }}>{talking?"ROADIE is talking…":"ROADIE is listening"}</span>
        </div>

        {known ? (
          <>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight">Welcome back, {name}.</h1>
            <p className="text-muted mt-2 max-w-xl">Front&rsquo;s all sorted — what&rsquo;s the plan today? Tell me and I&rsquo;ll take you straight there, or finish anything you&rsquo;ve got open.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {userChips.map(([l,a])=><button key={l} onClick={()=>ask(a)} className="pill hover:border-neon">{l}</button>)}
            </div>
            <div className="grid gap-2 mt-4 sm:flex sm:flex-wrap">
              <button onClick={openRoadie} className="btn btn-neon flex items-center justify-center gap-2"><Guitar size={18}/>Talk to ROADIE</button>
              <button onClick={()=>ask("something on my account isn't working, can you help me fix it")} className="btn flex items-center justify-center gap-2"><Wrench size={16}/>Something off? I&rsquo;ll fix it</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight">Welcome to My Music,<br/>My Money, My Hustle.</h1>
            <p className="text-muted mt-2 max-w-xl">I&rsquo;m <span className="text-neon font-semibold">ROADIE</span> — I get bands on stages. <span className="text-cyan">mymymy</span> turns your catalog into money. Ask me anything; no sign-in to look around.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {guestChips.map(([l,a])=><button key={l} onClick={()=>ask(a)} className="pill hover:border-neon">{l}</button>)}
            </div>
            <div className="grid gap-2 mt-4 sm:flex sm:flex-wrap">
              <button onClick={()=>entry("signup")} className="btn btn-neon flex items-center justify-center gap-2"><Sparkles size={18}/>I&rsquo;m new — sign up</button>
              <button onClick={()=>entry("signin")} className="btn flex items-center justify-center gap-2">I&rsquo;ve been here — sign in <ArrowRight size={16}/></button>
            </div>
            <button onClick={openRoadie} className="text-[12px] text-muted mt-3 hover:text-white">or just look around &amp; ask me anything →</button>
            <p className="text-[11px] text-muted mt-4">Free to join — it registers your content to you and protects your IP. Sign in only to use the tools.</p>
          </>
        )}
      </div>
    </div>
  );
}
