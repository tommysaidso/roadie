"use client";
import { useEffect, useState } from "react";
import { Sparkles, FileText, Check, Wand2, LogIn } from "lucide-react";

// Role-aware smart placement:
//  - a BAND sees the AI ranking but can only place ITSELF ("Book us" on its own row)
//  - the VENUE that owns the night gets one button: AI auto-fill (top pick books
//    itself — venues never hand-place someone else's band)
//  - everyone else: the ranking is read-only
export default function SlotMatch({ slot, hideVenue=false }:{ slot:any; hideVenue?:boolean }){
  const [me,setMe]=useState<any>(null);
  const [results,setResults]=useState<any[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [booked,setBooked]=useState<any>(null);
  const [contract,setContract]=useState<string>("");
  const [err,setErr]=useState<string>("");

  useEffect(()=>{ fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user)).catch(()=>{}); },[]);
  const myBandId = me?.band_id ? Number(me.band_id) : null;
  const ownsThisVenue = !!me && (Number(me.venue_id)===Number(slot.venue_id) || me.role==="admin" || me.role==="operator");

  async function run(){
    setLoading(true); setErr("");
    const r=await fetch(`/api/match?slotId=${slot.id}`); const d=await r.json();
    setResults(d.results); setLoading(false);
  }
  async function book(body:any, label:number|"auto"){
    setErr("");
    const r=await fetch("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({slotId:slot.id,...body})});
    const d=await r.json();
    if(!r.ok){ setErr(d.error||"Booking failed."); return; }
    setBooked(label); setContract(d.contract);
  }

  return (
    <div className={hideVenue ? "bg-ink/40 border border-edge rounded-xl p-3" : "card p-4"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {/* Grouped under a venue heading the name is already on screen —
              repeating it per night read as duplicate venues in the list. */}
          {!hideVenue && <><span className="font-bold">{slot.venue}</span> <span className="text-muted">• {slot.city}</span></>}
          <span className={hideVenue ? "pill" : "ml-3 pill"}>{slot.date}</span>
          <span className="ml-2 pill">{slot.genre_wanted||"any"}</span>
          <span className="ml-2 pill">${slot.guarantee||0}</span>
          <span className="ml-2 text-xs text-muted">via {slot.source}</span>
        </div>
        {!booked && (
          <div className="flex gap-2">
            <button onClick={run} className="btn text-sm flex items-center gap-1"><Sparkles size={15}/>{loading?"matching…":"See the AI ranking"}</button>
            {ownsThisVenue && (
              <button onClick={()=>book({auto:true},"auto")} className="btn btn-neon text-sm flex items-center gap-1"
                title="The AI books the best-fit band automatically"><Wand2 size={15}/>AI auto-fill</button>
            )}
          </div>
        )}
      </div>

      {results && !booked && (
        <div className="mt-3 space-y-2">
          {results.map((m:any)=>{
            const mine = myBandId && Number(m.band.id)===myBandId;
            return (
              <div key={m.band.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${mine?"bg-panel2 border border-neon/40":"bg-panel2"}`}>
                <div>
                  <span className="font-medium">{m.band.name}</span>
                  {mine && <span className="pill ml-2" style={{borderColor:"#ff3d6e",color:"#ff3d6e"}}>your band</span>}
                  <span className="text-xs text-muted ml-2">{m.reasons.join(" • ")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{color:m.score>0.6?"#3ddc84":"#ffb33d"}}>{Math.round(m.score*100)}% fit</span>
                  {mine && <button onClick={()=>book({bandId:m.band.id,score:m.score},m.band.id)} className="btn btn-neon text-xs">Book us + contract</button>}
                </div>
              </div>
            );
          })}
          {!me && <div className="text-xs text-muted flex items-center gap-1 mt-1"><LogIn size={12}/>Sign in as a band to place yourselves, or as this venue to AI auto-fill the night.</div>}
          {me && !myBandId && !ownsThisVenue && <div className="text-xs text-muted mt-1">Ranking is read-only — bands place themselves; this venue can AI auto-fill.</div>}
          {myBandId && !results.some((m:any)=>Number(m.band.id)===myBandId) && (
            <div className="flex items-center justify-between bg-panel2 rounded-xl px-3 py-2 border border-dashed border-edge">
              <span className="text-xs text-muted">Your band isn't in the AI's top picks for this night — you can still throw your hat in.</span>
              <button onClick={()=>book({bandId:myBandId},myBandId)} className="btn text-xs">Book us anyway</button>
            </div>
          )}
        </div>
      )}

      {err && <div className="text-xs mt-2" style={{color:"#ffb33d"}}>{err}</div>}

      {booked && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-moss"><Check size={16}/> Booked{booked==="auto"?" by AI auto-fill":""}. Auto-contract generated (BC).</div>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm flex items-center gap-1 text-muted"><FileText size={13}/> View contract</summary>
            <pre className="text-xs whitespace-pre-wrap bg-ink p-3 rounded-xl mt-2 border border-edge scroll" style={{maxHeight:280,overflow:"auto"}}>{contract}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
