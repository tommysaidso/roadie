"use client";
import React, { useCallback, useEffect, useState } from "react";

// Operator review for RTV. Bands send videos; somebody has to look before they
// go on the air, or the first bad clip is on the public wall.

export default function RtvQueue() {
  const [clips,setClips] = useState<any[]>([]);
  const [note,setNote] = useState<Record<number,string>>({});
  const [msg,setMsg] = useState<string|null>(null);

  const load = useCallback(async ()=>{
    const r = await fetch("/api/rtv?queue=1").then(r=>r.json()).catch(()=>null);
    if (r?.error) { setMsg(r.error); return; }
    setClips(r?.clips || []);
  },[]);
  useEffect(()=>{ load(); },[load]);

  async function review(id:number, status:string) {
    await fetch("/api/rtv",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"review",id,status,review_note:note[id]||""})});
    load();
  }

  if (msg) return <div className="card p-4 text-sm text-muted">{msg}</div>;
  if (!clips.length) return <div className="card p-4 text-sm text-muted">Nothing waiting on RTV review.</div>;

  return (
    <div className="flex flex-col gap-2">
      {clips.map(c=>(
        <div key={c.id} className="card p-3 flex flex-wrap gap-3 items-start">
          {c.thumb && <img src={c.thumb} alt="" className="w-32 h-20 object-cover rounded shrink-0"/>}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">{c.title}</div>
            <div className="text-xs text-muted">
              {c.band_name}{c.home_city?` · ${c.home_city}`:""}{c.genre?` · ${c.genre}`:""} · {c.kind}
            </div>
            <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-cyan break-all">{c.url}</a>
            <input className="w-full mt-2 bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-2 py-1 text-xs"
              placeholder="note back to the band (optional)"
              value={note[c.id]||""} onChange={e=>setNote({...note,[c.id]:e.target.value})}/>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-neon" onClick={()=>review(c.id,"approved")}>Put it on</button>
            <button className="btn" onClick={()=>review(c.id,"rejected")}>Pass</button>
          </div>
        </div>
      ))}
    </div>
  );
}
