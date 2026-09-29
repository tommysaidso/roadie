"use client";
import useSWR from "swr";
import { useState } from "react";
import { Tent, MapPin, ChevronDown, ExternalLink, Route } from "lucide-react";
const f=(u:string)=>fetch(u).then(r=>r.json());

function Near({ id }:{ id:number }){
  const { data }=useSWR(`/api/festival-near?id=${id}`, f);
  if(!data) return <div className="text-xs text-muted mt-2">scanning the area…</div>;
  return (
    <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
      <div><div className="label mb-1">Nearby venues</div>{data.venues.length? data.venues.slice(0,6).map((v:any)=><div key={v.id} className="text-muted">{v.name} · {v.city} <span className="text-cyan">{v.km}km</span></div>) : <div className="text-muted">none in range</div>}</div>
      <div><div className="label mb-1">Open slots</div>{data.slots.length? data.slots.slice(0,6).map((s:any)=><div key={s.id} className="text-muted">{s.date} {s.venue}</div>) : <div className="text-muted">none posted</div>}</div>
      <div><div className="label mb-1">Local bands</div>{data.bands.length? data.bands.slice(0,6).map((b:any)=><div key={b.id} className="text-muted">{b.name} · {b.home_city} <span className="text-cyan">{b.km}km</span></div>) : <div className="text-muted">none in range</div>}</div>
    </div>
  );
}

export default function Festivals(){
  const { data }=useSWR("/api/festivals", f);
  const [open,setOpen]=useState<number|null>(null);
  return (
    <div>
      <div className="grid md:grid-cols-2 gap-3">
        {(data?.festivals||[]).map((x:any)=>(
          <div key={x.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-lg flex items-center gap-2"><Tent size={16} className="text-neon"/>{x.name}{x.traveling?<span className="pill" style={{borderColor:"#3df0ff",color:"#3df0ff"}}><Route size={11}/> traveling</span>:null}</div>
                <div className="text-sm text-muted flex items-center gap-2 mt-1"><MapPin size={12}/>{x.city}, {x.region} · {x.month} · {x.genre}</div>
              </div>
              {x.website && <a href={x.website} target="_blank" rel="noreferrer" className="text-cyan"><ExternalLink size={14}/></a>}
            </div>
            {x.notes && <div className="text-xs text-muted mt-1">{x.notes}</div>}
            <button onClick={()=>setOpen(open===x.id?null:x.id)} className="btn text-xs mt-3 flex items-center gap-1"><ChevronDown size={13}/>Find bars, gigs &amp; bands near this</button>
            {open===x.id && <Near id={x.id}/>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-4">Festival info is public data — verify dates on the official site. Traveling festivals carry a route; ROADIE routes runouts around the stops.</p>
    </div>
  );
}
