"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { Plane, Receipt, Guitar, Building, ExternalLink, ArrowRight } from "lucide-react";
const f=(u:string)=>fetch(u).then(r=>r.json());
const CT:any={CA:{flag:"🇨🇦",name:"Canada"},US:{flag:"🇺🇸",name:"USA"},MX:{flag:"🇲🇽",name:"Mexico"}};
const ICON:any={visa:Plane,tax:Receipt,gear:Guitar,port_entry:Building,merch:Guitar};

export default function CrossingExplorer({ initialFrom, initialTo }:{ initialFrom?:string; initialTo?:string }={}){
  // Deep-linkable: a US act sent here from a US ring lands already looking at
  // US -> Canada, which is the direction they came to read about. Landing on
  // the default CA -> US would answer the opposite question.
  const ok=(v?:string)=>v && Object.keys(CT).includes(String(v).toUpperCase()) ? String(v).toUpperCase() : null;
  const [from,setFrom]=useState(ok(initialFrom) || "CA");
  const [to,setTo]=useState(ok(initialTo) || (ok(initialFrom)==="CA" ? "US" : "CA"));
  useEffect(()=>{ if(from===to) setTo(from==="CA"?"US":"CA"); },[from]);
  const { data } = useSWR(`/api/crossing?from=${from}&to=${to}`, f);
  const Picker=({val,set,label}:{val:string;set:(v:string)=>void;label:string})=>(
    <div className="flex-1">
      <div className="label mb-1">{label}</div>
      <div className="flex gap-1">
        {Object.keys(CT).map(k=>(
          <button key={k} onClick={()=>set(k)} className={`btn text-sm flex-1 ${val===k?"btn-neon":""}`}>{CT[k].flag} {CT[k].name}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <div className="card p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <Picker val={from} set={setFrom} label="Touring FROM"/>
          <ArrowRight className="mb-2 text-neon"/>
          <Picker val={to} set={setTo} label="INTO"/>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {(data?.crossings||[]).map((c:any)=>{ const I=ICON[c.category]||Plane; return (
          <div key={c.id} className="card p-5">
            <div className="flex items-center gap-2 mb-1"><I size={16} className="text-cyan"/><span className="pill">{c.category.replace("_"," ")}</span></div>
            <div className="font-bold text-lg">{c.title}</div>
            <p className="text-sm text-muted mt-1">{c.summary}</p>
            {c.key_fact && <div className="text-sm mt-2 px-3 py-2 rounded-lg bg-panel2"><b className="text-amber">Key:</b> {c.key_fact}</div>}
            {c.official_url && <a href={c.official_url} target="_blank" rel="noreferrer" className="text-sm text-cyan flex items-center gap-1 mt-3 hover:underline">{c.source} <ExternalLink size={12}/></a>}
          </div>
        );})}
      </div>

      {data?.contact && (
        <div className="card p-5 mt-4" style={{borderColor:"rgba(61,240,255,.3)"}}>
          <div className="label mb-1">📋 Immigration point of contact — application help</div>
          <div className="text-lg font-bold">{data.contact.name} <span className="text-sm text-muted font-normal">· {data.contact.status}</span></div>
          <p className="text-sm text-muted mt-1">{data.contact.notes}</p>
          <div className="text-sm mt-2 flex gap-4 flex-wrap">
            {data.contact.website && <a href={data.contact.website} target="_blank" rel="noreferrer" className="text-cyan flex items-center gap-1 hover:underline">{data.contact.website.replace(/^https?:\/\//,"")} <ExternalLink size={12}/></a>}
            {data.contact.email && <span>{data.contact.email}</span>}
            {data.contact.phone && <span>{data.contact.phone}</span>}
            <span className="text-muted">covers {data.contact.countries}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-4">Reference only — entry, visa and tax rules change and depend on your situation. Confirm with the official source linked and with {data?.contact?.name||"your immigration contact"} before booking international dates.</p>
    </div>
  );
}
