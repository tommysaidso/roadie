"use client";
import { useEffect, useState } from "react";
import { Heart, Ticket, HandCoins, ShoppingBag, MessageCircle, Check, Globe, Music } from "lucide-react";

export default function FanBar({ bandId, bandName, links }:{ bandId:number; bandName:string; links:Record<string,string> }){
  const [following,setFollowing]=useState(false);
  const [ask,setAsk]=useState(false);
  const [sent,setSent]=useState(false);
  const [form,setForm]=useState({name:"",email:"",body:""});

  useEffect(()=>{ try{ setFollowing(localStorage.getItem("roadie_follow_"+bandId)==="1"); }catch{} },[bandId]);

  // The band's OWN link belongs in this row. A fan who just hit Follow is at
  // the exact moment they want to go and look at the band — and until now the
  // only way out of here was tickets, donate or merch, none of which is "show
  // me more". Custom keys count: a band that adds its own site under any name
  // still means "this is us".
  const first = (...keys:string[]) => {
    for(const k of keys){ const v=links?.[k]; if(typeof v==="string" && v.trim()) return v.trim(); }
    return "";
  };
  const customSite = Object.keys(links||{})
    .filter(k=>/^custom/.test(k) || /site|web|home/i.test(k))
    .map(k=>links[k]).find(v=>typeof v==="string" && v.trim()) || "";
  const site   = first("website","homepage") || customSite;
  const listen = first("spotify","bandcamp","apple","soundcloud","youtube","reverbnation");

  async function follow(){
    const next=!following; setFollowing(next);
    try{ localStorage.setItem("roadie_follow_"+bandId, next?"1":"0"); }catch{}
    if(next) fetch("/api/fan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"follow",band_id:bandId})}).catch(()=>{});
  }
  async function send(){
    if(!form.body.trim()) return;
    await fetch("/api/fan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"question",band_id:bandId,...form})});
    setSent(true); setAsk(false); setForm({name:"",email:"",body:""});
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={follow} className={`btn text-sm flex items-center gap-1 ${following?"btn-neon":""}`}>
          <Heart size={14}/>{following?"Following":"Follow"}
        </button>
        {links.tickets && <a href={links.tickets} target="_blank" rel="noreferrer" className="btn text-sm flex items-center gap-1"><Ticket size={14}/>Tickets</a>}
        {links.donate && <a href={links.donate} target="_blank" rel="noreferrer" className="btn text-sm flex items-center gap-1"><HandCoins size={14}/>Donate</a>}
        {(links.store||links.merch) && <a href={links.store||links.merch} target="_blank" rel="noreferrer" className="btn text-sm flex items-center gap-1"><ShoppingBag size={14}/>Merch</a>}
        {site && <a href={site} target="_blank" rel="noreferrer" className="btn text-sm flex items-center gap-1"><Globe size={14}/>Band site</a>}
        {listen && <a href={listen} target="_blank" rel="noreferrer" className="btn text-sm flex items-center gap-1"><Music size={14}/>Listen</a>}
        <button onClick={()=>setAsk(a=>!a)} className="btn text-sm flex items-center gap-1"><MessageCircle size={14}/>Ask</button>
      </div>
      {sent && <div className="text-xs text-moss mt-2 flex items-center gap-1"><Check size={12}/>Sent to {bandName}.</div>}
      {ask && (
        <div className="card-h rounded-xl p-3 mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} placeholder="Your name" className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm"/>
            <input value={form.email} onChange={e=>setForm(s=>({...s,email:e.target.value}))} placeholder="Email (optional)" className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm"/>
          </div>
          <textarea value={form.body} onChange={e=>setForm(s=>({...s,body:e.target.value}))} placeholder={`Ask ${bandName} a question…`} rows={2} className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm"/>
          <button onClick={send} className="btn btn-neon text-sm w-full">Send</button>
        </div>
      )}
      <div className="text-[11px] text-muted mt-2">Tickets &amp; donations open the band’s own page — ROADIE doesn’t handle payments.</div>
    </div>
  );
}
