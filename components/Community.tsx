"use client";
import useSWR from "swr";
import { useState } from "react";
import { LifeBuoy, Send, MapPin, Globe, Users, Star, ExternalLink } from "lucide-react";

function proContactHref(links:string):string|null{
  try{
    const l=JSON.parse(links||"{}");
    if(l.web) return l.web;
    if(l.email) return `mailto:${l.email}`;
    return l.facebook||l.instagram||null;
  }catch{return null;}
}
function proContactLabel(links:string):string{
  try{
    const l=JSON.parse(links||"{}");
    if(l.web) return l.web.replace(/^https?:\/\//,"");
    if(l.email) return l.email;
    if(l.facebook) return "Facebook";
    if(l.instagram) return "Instagram";
  }catch{}
  return "";
}
const f=(u:string)=>fetch(u).then(r=>r.json());
const NEEDS=[["needproducer","#needproducer"],["needgig","#needgig"],["needvideo","#needvideo"],["needmix","#needmix"],["needmaster","#needmaster"],["needdistribution","#needdistribution"]];

function Matches({ need }:{ need:any }){
  const { data }=useSWR(`/api/lifeline?needId=${need.id}`, f);
  if(!data) return <div className="text-xs text-muted mt-1">matching…</div>;
  const m=data.match;
  if(m.kind==="gig"){
    return (
      <div className="mt-2 text-sm">
        {m.slots.length? <div className="mb-1"><span className="text-moss">{m.slots.length} open slot(s):</span> {m.slots.slice(0,4).map((s:any)=>`${s.date} ${s.venue} (${s.city})`).join(" · ")}</div> : <div className="text-amber">No open slots posted nearby.</div>}
        <div className="text-xs text-muted">Or reach venues directly: {m.venues.slice(0,4).map((v:any)=>`${v.name}${v.contact?` (${v.contact})`:""}`).join(" · ")}</div>
      </div>
    );
  }
  return (
    <div className="mt-2 text-sm">
      {m.pros.length? m.pros.slice(0,4).map((p:any)=>(
        <div key={p.name} className="flex items-center gap-2 py-0.5"><Star size={12} className={p.member_status==="lifetime_free"?"text-amber":"text-muted"}/>
          <b>{p.name}</b> <span className="text-xs text-muted">{p.headline} · {p.country}{p.remote?" · remote":""}</span></div>
      )) : <div className="text-muted">No match yet — invite one.</div>}
    </div>
  );
}

export default function Community(){
  const { data:needs }=useSWR("/api/needs", f);
  const { data:pros }=useSWR("/api/pros", f);
  const { data:conn }=useSWR("/api/connections", f);
  const [tag,setTag]=useState("needproducer"); const [country,setCountry]=useState("US"); const [city,setCity]=useState("Kelowna"); const [note,setNote]=useState("");
  async function flag(){
    await fetch("/api/needs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tag,country,city,region:"BC",author_kind:"band",author_name:"You",note})});
    setNote(""); location.reload();
  }
  return (
    <div>
      <div className="card p-5 mb-6">
        <div className="label mb-2 flex items-center gap-2"><LifeBuoy size={14} className="text-neon"/>Flag a need — the lifeline</div>
        <div className="flex flex-wrap gap-2 mb-2">{NEEDS.map(([k,l])=><button key={k} onClick={()=>setTag(k)} className={`pill ${tag===k?"":""}`} style={tag===k?{borderColor:"#ff3d6e",color:"#ff3d6e"}:{}}>{l}</button>)}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={city} onChange={e=>setCity(e.target.value)} placeholder="area / city" className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm"/>
          <select value={country} onChange={e=>setCountry(e.target.value)} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm"><option value="">anywhere</option><option value="CA">Canada</option><option value="US">USA</option><option value="MX">Mexico</option></select>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="note (optional)" className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm col-span-2"/>
        </div>
        <button onClick={flag} className="btn btn-neon text-sm mt-3 flex items-center gap-1"><Send size={14}/>Post {`#${tag}`}</button>
        <div className="text-[11px] text-muted mt-2">#needgig auto-loads open slots in the area (or the venue's contact). #needproducer/#needvideo match pros by skill + country.</div>
      </div>

      <h2 className="text-xl font-black mb-3">Open needs</h2>
      <div className="grid md:grid-cols-2 gap-3 mb-8">
        {(needs?.needs||[]).map((n:any)=>(
          <div key={n.id} className="card p-4">
            <div className="flex items-center gap-2"><span className="pill" style={{borderColor:"#ff3d6e",color:"#ff3d6e"}}>#{n.tag}</span><span className="text-sm font-medium">{n.author_name}</span><span className="text-xs text-muted flex items-center gap-1"><MapPin size={11}/>{n.city}{n.country?` → ${n.country}`:""}</span></div>
            {n.note && <div className="text-sm text-muted mt-1">{n.note}</div>}
            <Matches need={n}/>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-black mb-3">Producers &amp; pros</h2>
      <div className="grid md:grid-cols-2 gap-3 mb-8">
        {(pros?.pros||[]).map((p:any)=>(
          <div key={p.id} className="card p-4">
            <div className="flex items-center justify-between"><div className="font-bold">{p.name}</div>{p.member_status==="sample"&&<span className="pill">sample</span>}</div>
            <div className="text-sm text-muted">{p.headline}</div>
            <div className="text-xs text-muted flex items-center gap-2 mt-1"><Globe size={11}/>{p.country}{p.city?` · ${p.city}`:""}{p.remote?" · remote":""}</div>
            <div className="mt-2">{(p.tags||"").split(",").filter(Boolean).map((t:string)=><span key={t}><span className="pill mr-1 mb-1 inline-block">{t.trim().replace(/_/g," ")}</span>{" "}</span>)}</div>
            {proContactHref(p.links)&&<a href={proContactHref(p.links)!} target="_blank" rel="noopener" className="mt-2 flex items-center gap-1 text-xs text-cyan hover:underline"><ExternalLink size={11}/>{proContactLabel(p.links)}</a>}
          </div>
        ))}
      </div>

      <h2 className="text-xl font-black mb-3 flex items-center gap-2"><Users size={18}/>AI connections — shared interests</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {(conn?.groups||[]).map((g:any)=>(
          <div key={g.tag} className="card p-4">
            <div className="text-sm"><b className="text-cyan">{g.who.length} members</b> {g.label}: {g.who.join(", ")}</div>
            <div className="text-xs text-muted mt-1">ROADIE suggests connecting them — shared #{g.tag}.</div>
          </div>
        ))}
      </div>
    </div>
  );
}
