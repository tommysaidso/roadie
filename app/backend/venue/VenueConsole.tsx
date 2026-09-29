"use client";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Mic, ScanLine, Keyboard, Plus } from "lucide-react";
const f=(u:string)=>fetch(u).then(r=>r.json());
export default function VenueConsole({ venues }:{ venues:any[] }){
  const [venueId,setVenueId]=useState(venues[0]?.id);
  const [form,setForm]=useState({date:"2026-07-20",genre_wanted:"Indie Rock",guarantee:700,notes:"",source:"manual"});
  const { data:slotData } = useSWR(`/api/venue-slots?venueId=${venueId}`, f);
  const { data:cal } = useSWR("/api/calendar", f);
  const bookings = (cal?.bookings||[]).filter((b:any)=>b.venue_id===Number(venueId));
  async function add(){
    await fetch("/api/venue-slots",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,venue_id:Number(venueId)})});
    mutate(`/api/venue-slots?venueId=${venueId}`); mutate("/api/opportunities?alerts=1");
  }
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="label">Your venue</div>
          <select value={venueId} onChange={e=>setVenueId(Number(e.target.value))} className="bg-ink border border-edge rounded-lg px-2 py-1 text-sm">
            {venues.map(v=><option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
          </select>
        </div>
        <div className="label mb-2 flex items-center gap-2"><Plus size={13}/> Post an availability</div>
        <div className="flex gap-2 mb-3">
          {[["manual",Keyboard,"Type"],["ocr",ScanLine,"From paper (OCR)"],["voice",Mic,"Speak it"]].map(([k,Ic,lbl]:any)=>(
            <button key={k} onClick={()=>setForm(s=>({...s,source:k}))} className={`btn text-xs flex items-center gap-1 ${form.source===k?"btn-neon":""}`}><Ic size={13}/>{lbl}</button>
          ))}
        </div>
        {form.source!=="manual" && <div className="text-xs text-muted mb-2">{form.source==="ocr"?"Snap the chalkboard/paper calendar — ROADIE OCRs the dates into slots.":"Tell ROADIE the open nights — it transcribes into slots."} (demo: fill below)</div>}
        <div className="grid grid-cols-2 gap-2">
          <input value={form.date} onChange={e=>setForm(s=>({...s,date:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm" placeholder="YYYY-MM-DD"/>
          <input value={form.genre_wanted} onChange={e=>setForm(s=>({...s,genre_wanted:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm" placeholder="genre wanted"/>
          <input type="number" value={form.guarantee} onChange={e=>setForm(s=>({...s,guarantee:Number(e.target.value)}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm" placeholder="guarantee $"/>
          <input value={form.notes} onChange={e=>setForm(s=>({...s,notes:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm" placeholder="notes"/>
        </div>
        <button onClick={add} className="btn btn-neon text-sm mt-3 w-full">Add open slot</button>
      </div>

      <div className="card p-5">
        <div className="label mb-3">Your slots</div>
        <div className="space-y-1 mb-5">
          {(slotData?.slots||[]).map((s:any)=>(
            <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-edge last:border-0">
              <span>{s.date} • {s.genre_wanted||"any"} • ${s.guarantee||0}</span>
              <span className="pill">{s.status==="booked"?"✅ booked":`🟢 open (${s.source})`}</span>
            </div>
          ))}
        </div>
        <div className="label mb-3">Incoming bookings</div>
        {bookings.length? bookings.map((b:any)=>(
          <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-edge last:border-0">
            <span><b>{b.band}</b> • {b.date}</span>
            <span className="pill">{b.status} {b.contract_id?"• 📄":""}</span>
          </div>
        )) : <div className="text-sm text-muted">No bookings yet.</div>}
      </div>
    </div>
  );
}
