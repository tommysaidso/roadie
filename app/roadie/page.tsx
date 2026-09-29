"use client";
import { useEffect } from "react";
import { Guitar } from "lucide-react";
export default function RoadiePage(){
  useEffect(()=>{ window.dispatchEvent(new Event("roadie:open")); },[]);
  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-black tracking-tight">Ask ROADIE</h1>
      <p className="text-muted mt-2">Your booking &amp; help line — the conversation that runs the whole thing. Find gigs, route a tour, draft a contract, check BC/border rules, look things up across ROADIE and mymymy. Talk to it or type; mute it any time.</p>
      <button onClick={()=>window.dispatchEvent(new Event("roadie:open"))} className="btn btn-neon mt-4 flex items-center gap-2"><Guitar size={18}/>Open ROADIE</button>
      <p className="text-xs text-muted mt-4">It's also one tap away on every page — the Ask ROADIE button, bottom-right.</p>
    </div>
  );
}
