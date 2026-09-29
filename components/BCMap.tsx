"use client";
import { useState, useEffect } from "react";
// Lightweight interactive map of interior/southern BC. Coordinates are projected
// from lat/lng to an SVG viewport (no tiles required — runs fully offline).
const VB = { w: 760, h: 520 };
type Box = { minLng:number; maxLng:number; minLat:number; maxLat:number };
const DEFAULT_BOX: Box = { minLng:-123.2, maxLng:-116.5, minLat:49.2, maxLat:54.3 };  // interior BC
function makeProject(BOX: Box){
  return (lat:number,lng:number)=>{
    const x = ( (lng-BOX.minLng)/(BOX.maxLng-BOX.minLng) ) * VB.w;
    const y = ( 1-(lat-BOX.minLat)/(BOX.maxLat-BOX.minLat) ) * VB.h;
    return [x,y];
  };
}
export default function BCMap({ venues, bands, stops, box }:{ venues:any[]; bands:any[]; stops:any[]; box?:Box }){
  const project = makeProject(box ?? DEFAULT_BOX);
  const [sel,setSel]=useState<any>(null);
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    const mq=window.matchMedia("(max-width: 640px)");
    const on=()=>setCompact(mq.matches); on();
    mq.addEventListener("change",on); return ()=>mq.removeEventListener("change",on);
  },[]);
  const route = stops?.length? stops.map((s:any)=>project(s.lat,s.lng)) : [];
  const vR = compact ? 9 : 6;
  const bR = compact ? 6 : 4;
  const hit = compact ? 26 : 16;
  const isSel=(t:string,id:number)=>sel&&sel.type===t&&sel.d.id===id;
  return (
    <div className="card p-3">
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full rounded-xl" style={{background:"#0e0e16",touchAction:"manipulation"}}>
        {Array.from({length:16}).map((_,i)=>(<line key={"v"+i} x1={i*VB.w/16} y1={0} x2={i*VB.w/16} y2={VB.h} stroke="#15151f"/>))}
        {Array.from({length:11}).map((_,i)=>(<line key={"h"+i} x1={0} y1={i*VB.h/11} x2={VB.w} y2={i*VB.h/11} stroke="#15151f"/>))}
        {route.length>1 && <polyline points={route.map(p=>p.join(",")).join(" ")} fill="none" stroke="#ff3d6e" strokeWidth={compact?3.5:2.5} strokeDasharray="6 5"/>}
        {venues.map((v:any)=>{ const [x,y]=project(v.lat,v.lng); return (
          <g key={"v"+v.id} onClick={()=>setSel({type:"venue",d:v})} style={{cursor:"pointer"}}>
            <circle cx={x} cy={y} r={hit} fill="transparent"/>
            {isSel("venue",v.id) && <circle cx={x} cy={y} r={vR+5} fill="none" stroke="#3df0ff" strokeWidth={2} opacity={0.7}/>}
            <circle cx={x} cy={y} r={vR} fill="#3df0ff"/>
            {!compact && <text x={x+9} y={y+4} fill="#9fb6bd" fontSize={12}>{v.name}</text>}
          </g>);})}
        {bands.map((b:any)=>{ if(!b.lat) return null; const [x,y]=project(b.lat,b.lng); return (
          <g key={"b"+b.id} onClick={()=>setSel({type:"band",d:b})} style={{cursor:"pointer"}}>
            <circle cx={x} cy={y} r={hit} fill="transparent"/>
            {isSel("band",b.id) && <circle cx={x} cy={y} r={bR+6} fill="none" stroke="#ffb33d" strokeWidth={2} opacity={0.7}/>}
            <rect x={x-bR} y={y-bR} width={bR*2} height={bR*2} fill="#ffb33d" transform={`rotate(45 ${x} ${y})`}/>
          </g>);})}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted px-1 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:"#3df0ff"}}/> venue</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5" style={{background:"#ffb33d",transform:"rotate(45deg)"}}/> band home</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5" style={{background:"#ff3d6e"}}/> runout route</span>
        {compact && <span>tap a pin for detail</span>}
      </div>
      {sel
        ? <div className="card-h rounded-xl p-3 mt-2 text-sm flex items-start justify-between gap-3">
            <div><b>{sel.d.name}</b> — {sel.type==="venue"? `${sel.d.city}, cap ${sel.d.capacity}, ${sel.d.genres}` : `${sel.d.home_city} • ${sel.d.genre}`}</div>
            <button onClick={()=>setSel(null)} aria-label="clear" className="text-muted shrink-0">✕</button>
          </div>
        : compact && <div className="card-h rounded-xl p-3 mt-2 text-sm text-muted">Tap any pin to see the venue or band.</div>}
    </div>
  );
}
