"use client";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { BadgePercent, Plus, Ticket, TrendingUp } from "lucide-react";
const f=(u:string)=>fetch(u).then(r=>r.json());
const SURFACES=["public_feed","band_profile","venue_page","tour_map","notice_board"];
export default function AdvConsole({ sponsors, venues=[], bands=[] }:{ sponsors:any[]; venues?:any[]; bands?:any[] }){
  const [sid,setSid]=useState(sponsors[0]?.id);
  const [ownerKind,setOwnerKind]=useState<"sponsor"|"venue"|"band">("sponsor");
  const [ownerId,setOwnerId]=useState(String(sponsors[0]?.id||""));
  const [form,setForm]=useState({surface:"public_feed",label:"",cost:600,start_date:"2026-07-01",end_date:"2026-07-31"});
  const [camp,setCamp]=useState<any>({template_id:"",title:"",audience:"fans",status:"draft",coupon_code:"",offer:"",budget:300});
  const { data } = useSWR(`/api/placements?sponsorId=${sid}`, f);
  const { data:roi } = useSWR("/api/roi", f);
  const { data:campaigns } = useSWR(`/api/campaigns?ownerKind=${ownerKind}&ownerId=${ownerId}`, f);
  const mine = (roi?.placements||[]).filter((p:any)=>p.sponsor_id===Number(sid));
  const spend = mine.reduce((t:number,p:any)=>t+p.cost,0);
  const conv = mine.reduce((t:number,p:any)=>t+p.conversions,0);
  // recommend the surface with best historical CPA across all sponsors
  const best = (roi?.placements||[]).slice().sort((a:any,b:any)=>(a.cpa||1e9)-(b.cpa||1e9))[0];
  async function add(){
    await fetch("/api/placements",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,sponsor_id:Number(sid)})});
    mutate(`/api/placements?sponsorId=${sid}`); mutate("/api/roi");
  }
  function owners(){
    if(ownerKind==="venue") return venues.map(v=>({id:v.id,label:`${v.name} — ${v.city}`}));
    if(ownerKind==="band") return bands.map(b=>({id:b.id,label:`${b.name} — ${b.home_city}`}));
    return sponsors.map(s=>({id:s.id,label:s.name}));
  }
  function changeKind(k:"sponsor"|"venue"|"band"){
    setOwnerKind(k);
    const first = k==="venue" ? venues[0]?.id : k==="band" ? bands[0]?.id : sponsors[0]?.id;
    setOwnerId(String(first||""));
  }
  async function launchCampaign(){
    await fetch("/api/campaigns",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...camp,owner_kind:ownerKind,owner_id:Number(ownerId)})});
    mutate(`/api/campaigns?ownerKind=${ownerKind}&ownerId=${ownerId}`);
  }
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="label">Advertiser</div>
          <select value={sid} onChange={e=>setSid(Number(e.target.value))} className="bg-ink border border-edge rounded-lg px-2 py-1 text-sm">
            {sponsors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="card-h rounded-lg p-2"><div className="label">Spend</div><div className="font-bold">${spend.toLocaleString()}</div></div>
          <div className="card-h rounded-lg p-2"><div className="label">Conv.</div><div className="font-bold">{conv}</div></div>
          <div className="card-h rounded-lg p-2"><div className="label">CPA</div><div className="font-bold">{conv?`$${Math.round(spend/conv)}`:"—"}</div></div>
        </div>
        {best && <div className="text-xs text-muted mb-3 flex items-center gap-1"><TrendingUp size={13} className="text-moss"/> Best-performing surface network-wide: <b className="text-moss">{best.surface}</b> (CPA ${Math.round(best.cpa)})</div>}
        <div className="label mb-2 flex items-center gap-2"><Plus size={13}/> New placement</div>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.surface} onChange={e=>setForm(s=>({...s,surface:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm">{SURFACES.map(s=><option key={s}>{s}</option>)}</select>
          <input type="number" value={form.cost} onChange={e=>setForm(s=>({...s,cost:Number(e.target.value)}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm" placeholder="budget $"/>
          <input value={form.label} onChange={e=>setForm(s=>({...s,label:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm col-span-2" placeholder="creative label"/>
        </div>
        <button onClick={add} className="btn btn-neon text-sm mt-3 w-full">Launch placement</button>
      </div>

      <div className="card p-5">
        <div className="label mb-3">Your placements & ROI</div>
        {mine.length? mine.map((p:any)=>(
          <div key={p.id} className="py-2 border-b border-edge last:border-0">
            <div className="flex items-center justify-between"><span className="font-medium">{p.label||p.surface}</span><span className="text-sm" style={{color:p.cpa&&p.cpa<10?"#3ddc84":"#ffb33d"}}>{p.cpa?`$${Math.round(p.cpa)} CPA`:"—"}</span></div>
            <div className="text-xs text-muted">{p.surface} • ${p.cost} • {p.impressions.toLocaleString()} impr • {(p.ctr*100).toFixed(2)}% CTR • {p.conversions} conv</div>
          </div>
        )) : <div className="text-sm text-muted">No placements yet — launch one.</div>}
      </div>

      <div className="card p-5 lg:col-span-2">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="label flex items-center gap-2"><Ticket size={13}/> Campaigns + coupons</div>
            <div className="text-lg font-black">Stock funnels for tickets, merch, vendor spots and gate coupons.</div>
            <p className="text-sm text-muted">Templates are block-based so we can make them drag/drop customizable without changing the campaign engine.</p>
          </div>
          <div className="flex gap-2">
            {(["sponsor","venue","band"] as const).map(k=><button key={k} onClick={()=>changeKind(k)} className={`pill ${ownerKind===k?"border-neon text-white":""}`}>{k}</button>)}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={ownerId} onChange={e=>setOwnerId(e.target.value)} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm">
            {owners().map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={camp.template_id} onChange={e=>setCamp((c:any)=>({...c,template_id:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm">
            <option value="">choose template</option>
            {(campaigns?.templates||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={camp.title} onChange={e=>setCamp((c:any)=>({...c,title:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm" placeholder="Campaign title"/>
          <input type="number" value={camp.budget} onChange={e=>setCamp((c:any)=>({...c,budget:Number(e.target.value)}))} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm" placeholder="budget"/>
          <input value={camp.coupon_code} onChange={e=>setCamp((c:any)=>({...c,coupon_code:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm" placeholder="coupon code"/>
          <input value={camp.offer} onChange={e=>setCamp((c:any)=>({...c,offer:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm md:col-span-2" placeholder="offer, e.g. $5 off gate / kids free / shirt bundle"/>
          <select value={camp.status} onChange={e=>setCamp((c:any)=>({...c,status:e.target.value}))} className="bg-ink border border-edge rounded-lg px-2 py-2 text-sm">
            <option value="draft">draft</option><option value="live">live</option><option value="paused">paused</option>
          </select>
        </div>
        <button onClick={launchCampaign} className="btn btn-neon mt-3 flex items-center justify-center gap-2 w-full"><BadgePercent size={16}/>Launch campaign / coupon</button>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {(campaigns?.templates||[]).map((t:any)=>(
            <div key={t.id} className="card-h rounded-xl p-3">
              <div className="font-bold">{t.name}</div>
              <div className="text-xs text-muted">{t.owner_kind} • {t.goal} • {t.notes}</div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="label mb-2">Current campaigns</div>
          {(campaigns?.campaigns||[]).length ? campaigns.campaigns.map((c:any)=>(
            <div key={c.id} className="py-2 border-b border-edge last:border-0 text-sm">
              <b>{c.title}</b> <span className="text-muted">• {c.template||"custom"} • {c.status} • ${c.budget||0}</span>
            </div>
          )) : <div className="text-sm text-muted">No campaigns yet.</div>}
        </div>
      </div>
    </div>
  );
}
