"use client";
import useSWR from "swr";
import { AlertTriangle, Flame, Clock, CircleDot } from "lucide-react";
const f=(u:string)=>fetch(u).then(r=>r.json());
const U:Record<string,any>={hot:{i:Flame,c:"#ff3d6e",t:"HOT"},warm:{i:Clock,c:"#ffb33d",t:"warm"},cold:{i:CircleDot,c:"#8a8aa0",t:"cold"}};
export default function OpportunityTracker({ alertsOnly=false }:{ alertsOnly?:boolean }){
  const { data } = useSWR(alertsOnly? "/api/opportunities?alerts=1":"/api/opportunities", f, { refreshInterval: 15000 });
  if(!data) return <div className="text-muted">Scanning the grid…</div>;
  const rows = alertsOnly? data.alerts : data.gaps;
  const s = data.summary;
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="card p-3"><div className="label">Open</div><div className="text-xl font-bold">{s.openSlots}</div></div>
        <div className="card p-3"><div className="label">Fillable</div><div className="text-xl font-bold text-moss">{s.fillable}</div></div>
        <div className="card p-3"><div className="label">Hot (≤7d)</div><div className="text-xl font-bold text-neon">{s.hot}</div></div>
        <div className="card p-3"><div className="label">No match</div><div className="text-xl font-bold text-amber">{s.unmatched}</div></div>
      </div>
      <div className="space-y-2">
        {rows.map((g:any)=>{ const u=U[g.urgency]; const I=u.i; return (
          <div key={g.slot.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <I size={18} style={{color:u.c}}/>
              <div>
                <div className="font-medium">{g.slot.venue} <span className="text-muted">• {g.slot.city}</span></div>
                <div className="text-xs text-muted">{g.slot.date} • wants {g.slot.genre_wanted||"any"} • ${g.slot.guarantee||0} • {g.daysOut}d out</div>
              </div>
            </div>
            <div className="text-right">
              {g.fillable
                ? <div className="text-sm">Fill with <b>{g.topBand?.name}</b> <span className="text-moss">{Math.round(g.topScore*100)}%</span><div className="text-xs text-muted">+{g.candidates-1>0?g.candidates-1:0} more candidates</div></div>
                : <div className="text-sm text-amber flex items-center gap-1"><AlertTriangle size={14}/> No strong match — post to board</div>}
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}
