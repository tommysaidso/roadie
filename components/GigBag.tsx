"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import GearList from "./GearList";
import Link from "next/link";
import { ChevronRight, Trash2, Camera, Sparkles, ShoppingBag, ExternalLink } from "lucide-react";
import RtvSubmit from "./RtvSubmit";

// GIG BAG — the kit each member carries, and the merch the band sells.
//
// Members collapse. A five-piece with a full backline is a wall of text if you
// open it all at once, and a host reading it only cares about one member at a
// time.

type Member = { id:number; member_name:string; role:string; instruments:string[]; needs:string };
type Merch = {
  id:number; title:string; kind:string; price_cad:number|null; url:string;
  photo:string|null; photo_url:string|null; showcase_url:string|null;
  showcase_status:string|null; showcase_style:string|null; showcase_error:string|null;
};

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

const KINDS = ["shirt","hoodie","hat","vinyl","cd","cassette","sticker","poster","patch","other"];

function MemberRow({ m, onSave, onDelete }:{
  m: Member; onSave:(x:Member)=>void; onDelete:(id:number)=>void;
}) {
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState(m);
  // The instrument box keeps its own RAW text while you type.
  //
  // It used to be a controlled input whose value was the parsed array joined
  // back together, re-parsed on every keystroke — so the moment you typed a
  // comma, filter(Boolean) dropped the empty tail and the comma disappeared,
  // and trim() ate any space after it. You could type letters and nothing else.
  // Parse on the way OUT, never on the way in.
  const [raw,setRaw] = useState(m.instruments.join(", "));
  useEffect(()=>{ setDraft(m); setRaw(m.instruments.join(", ")); },[m]);
  const parsed = () => raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean);

  return (
    <div className="border border-[#2a2a3a] rounded-xl overflow-hidden">
      <button onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#14141c]">
        <ChevronRight size={14} className="shrink-0 transition-transform"
          style={{transform: open?"rotate(90deg)":"none"}}/>
        <span className="font-semibold text-sm">{m.member_name}</span>
        {m.role && <span className="pill shrink-0">{m.role}</span>}
        <span className="text-xs text-[#8a8aa0] truncate ml-auto">
          {m.instruments.length ? `${m.instruments.length} item${m.instruments.length>1?"s":""}` : "nothing listed"}
        </span>
      </button>

      {open && (
        <div className="p-3 border-t border-[#2a2a3a] flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className="label">Name</span>
              <input className={inp} value={draft.member_name}
                onChange={e=>setDraft({...draft,member_name:e.target.value})}/></label>
            <label className="block"><span className="label">Plays</span>
              <input className={inp} value={draft.role} placeholder="drums, lead vocals"
                onChange={e=>setDraft({...draft,role:e.target.value})}/></label>
          </div>
          <label className="block"><span className="label">What&apos;s in the bag</span>
            <textarea className={inp+" h-20 resize-y"} value={raw}
              placeholder="Yamaha Recording Custom kit, 22in kick, Zildjian A ride, hardware, throne"
              onChange={e=>setRaw(e.target.value)}/>
            <span className="text-[11px] text-[#8a8aa0]">
              One per line, or separate with commas — type it however it comes out.
              {parsed().length>0 && <> · {parsed().length} item{parsed().length>1?"s":""}</>}
            </span>
          </label>
          <label className="block"><span className="label">Needs from the room</span>
            <input className={inp} value={draft.needs} placeholder="bass amp, 2 vocal mics, DI"
              onChange={e=>setDraft({...draft,needs:e.target.value})}/></label>
          <div className="flex gap-2">
            <button className="btn btn-neon" onClick={()=>onSave({...draft, instruments:parsed()})}>Save</button>
            <button className="btn" onClick={()=>onDelete(m.id)}><Trash2 size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
}

function MerchCard({ item, onSave, onDelete, onPhoto, onShowcase, shop }:{
  item: Merch; onSave:(x:Merch)=>void; onDelete:(id:number)=>void;
  onPhoto:(id:number,f:File)=>void; onShowcase:(id:number,style:string)=>void; shop:string;
}) {
  const [draft,setDraft] = useState(item);
  const [edit,setEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{ setDraft(item); },[item]);

  const buyUrl = item.url || shop;
  const art = item.showcase_url || item.photo_url;

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="aspect-square bg-[#0b0b0f] relative grid place-items-center">
        {art
          ? <img src={art} alt={item.title} className="w-full h-full object-cover"/>
          : <span className="text-xs text-[#8a8aa0] px-3 text-center">No picture yet</span>}
        {item.showcase_status==="queued" && (
          <span className="absolute bottom-2 left-2 pill bg-black/70">making the showcase…</span>
        )}
        {item.showcase_status==="done" && item.showcase_url && (
          <span className="absolute bottom-2 left-2 pill bg-black/70">{item.showcase_style}</span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        {edit ? (
          <>
            <input className={inp} value={draft.title}
              onChange={e=>setDraft({...draft,title:e.target.value})}/>
            <div className="grid grid-cols-2 gap-2">
              <select className={inp} value={draft.kind}
                onChange={e=>setDraft({...draft,kind:e.target.value})}>
                {KINDS.map(k=><option key={k} value={k}>{k}</option>)}
              </select>
              <input type="number" className={inp} placeholder="CAD" value={draft.price_cad ?? ""}
                onChange={e=>setDraft({...draft,price_cad:e.target.value===""?null:Number(e.target.value)})}/>
            </div>
            <input className={inp} placeholder={shop ? "leave blank to use your shop link" : "order link for this item"}
              value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})}/>
            <div className="flex gap-2">
              <button className="btn btn-neon flex-1" onClick={()=>{ onSave(draft); setEdit(false); }}>Save</button>
              <button className="btn" onClick={()=>{ setDraft(item); setEdit(false); }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-sm">{item.title}</div>
            <div className="text-xs text-[#8a8aa0]">
              {item.kind}{item.price_cad ? ` · $${item.price_cad} CAD` : ""}
            </div>

            <div className="flex flex-wrap gap-1 mt-1">
              <button className="btn px-2 py-1 text-xs" onClick={()=>fileRef.current?.click()}>
                <Camera size={13}/> {item.photo ? "Retake" : "Photo"}
              </button>
              {item.photo && (["photoreal","toon"] as const).map(s=>(
                <button key={s} className="btn px-2 py-1 text-xs"
                  disabled={item.showcase_status==="queued"}
                  onClick={()=>onShowcase(item.id,s)}>
                  <Sparkles size={13}/> {s==="photoreal"?"Photo art":"Toon art"}
                </button>
              ))}
            </div>
            {item.showcase_error && <div className="text-[11px] text-[#ff3d6e]">{item.showcase_error}</div>}

            <div className="flex gap-2 mt-auto pt-2">
              {buyUrl
                ? <a href={buyUrl} target="_blank" rel="noreferrer" className="btn btn-neon flex-1 text-xs text-center">
                    <ExternalLink size={13}/> Buy
                  </a>
                : <span className="text-[11px] text-[#8a8aa0] flex-1">Add a shop link so fans can buy it.</span>}
              <button className="btn px-2 text-xs" onClick={()=>setEdit(true)}>Edit</button>
              <button className="btn px-2 text-xs" onClick={()=>onDelete(item.id)}><Trash2 size={13}/></button>
            </div>
          </>
        )}
      </div>

      {/* capture= opens the phone camera straight away instead of a file picker */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e=>{ const f=e.target.files?.[0]; if(f) onPhoto(item.id,f); e.currentTarget.value=""; }}/>
    </div>
  );
}

export default function GigBag() {
  const [data,setData] = useState<any>(null);
  const [bandId,setBandId] = useState<number|null>(null);
  const [msg,setMsg] = useState<string|null>(null);
  const poll = useRef<any>(null);

  const load = useCallback(async (id?:number)=>{
    const q = id ? `?band=${id}` : "";
    const r = await fetch(`/api/gigbag${q}`).then(r=>r.json()).catch(()=>null);
    if (!r) return;
    setData(r);
    if (r.band?.id) setBandId(r.band.id);
    return r;
  },[]);
  useEffect(()=>{ load(); },[load]);

  // Only poll while a showcase is actually cooking.
  useEffect(()=>{
    const waiting = (data?.merch||[]).some((m:Merch)=>m.showcase_status==="queued");
    clearInterval(poll.current);
    if (!waiting) return;
    poll.current = setInterval(()=>load(bandId||undefined), 8000);
    return ()=>clearInterval(poll.current);
  },[data,bandId,load]);

  async function post(url:string, body:any) {
    const r = await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(r=>r.json()).catch(e=>({error:String(e)}));
    if (r?.error) { setMsg(r.error); return null; }
    setMsg(null); await load(bandId||undefined); return r;
  }

  async function del(url:string) {
    await fetch(url,{method:"DELETE"});
    load(bandId||undefined);
  }

  async function uploadPhoto(id:number, file:File) {
    setMsg(null);
    const fd = new FormData(); fd.append("item_id", String(id)); fd.append("file", file);
    const r = await fetch("/api/merch",{method:"POST",body:fd}).then(r=>r.json()).catch(e=>({error:String(e)}));
    if (r?.error) { setMsg(r.error); return; }
    load(bandId||undefined);
  }

  if (!data) return <div className="card p-6 text-sm text-muted">Opening the bag…</div>;

  if (!data.bands?.length) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted mb-4">
          The gig bag belongs to a band. Link your account to yours and it&apos;ll show up here.
        </p>
        <Link href="/garage" className="btn btn-neon inline-block">Go to the Garage</Link>
      </div>
    );
  }

  const kit:Member[] = data.kit || [];
  const merch:Merch[] = data.merch || [];

  return (
    <div className="flex flex-col gap-6">
      {data.bands.length > 1 && (
        <select className={inp+" max-w-xs"} value={bandId ?? ""}
          onChange={e=>{ const v=Number(e.target.value); setBandId(v); load(v); }}>
          {data.bands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      {msg && <div className="text-sm text-[#ff3d6e]">{msg}</div>}

      {/* ---- KIT ---- */}
      <section data-tour="kit" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">The kit</h2>
          <button className="btn" onClick={()=>post("/api/gigbag",{band_id:bandId,member_name:"New member",instruments:[]})}>
            + Add a member
          </button>
        </div>
        <p className="text-sm text-muted -mt-1">
          What each of you carries. Hosts and backline sponsors read this to know what the room has to hold.
        </p>
        {!kit.length && <div className="card p-4 text-sm text-muted">Nothing in the bag yet.</div>}
        {kit.map(m=>(
          <MemberRow key={m.id} m={m}
            onSave={x=>post("/api/gigbag",{...x, band_id:bandId, id:x.id})}
            onDelete={id=>del(`/api/gigbag?id=${id}`)}/>
        ))}
        {/* The named pieces, with serials. The free-text list above stays as
            it is — "hardware, throne" is a fine line and shouldn't need a form. */}
        {bandId ? <GearList bandId={bandId} /> : null}
      </section>

      {/* ---- MERCH ---- */}
      <section data-tour="merch" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Merch</h2>
          <button className="btn" onClick={()=>post("/api/merch",{band_id:bandId,title:"New item",kind:"shirt"})}>
            + Add an item
          </button>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <ShoppingBag size={16} className="text-muted"/>
          {data.shop ? (
            <>
              <span className="text-sm">Your shop: <a className="text-cyan" href={data.shop} target="_blank" rel="noreferrer">{data.shop}</a></span>
              <Link href="/garage" className="btn ml-auto">Change</Link>
            </>
          ) : (
            <>
              <span className="text-sm text-muted">
                No shop link yet. Paste your store or drop-shipper order link in Connect and every item here gets a Buy button.
              </span>
              <Link href="/garage" className="btn btn-neon ml-auto">Add it</Link>
            </>
          )}
        </div>
        <p className="text-sm text-muted -mt-1">
          ROADIE never handles the money — Buy opens your own shop. Take a photo of an item and
          it can build you a clean showcase picture for it.
        </p>

        {!merch.length && <div className="card p-4 text-sm text-muted">Nothing listed yet.</div>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {merch.map(m=>(
            <MerchCard key={m.id} item={m} shop={data.shop||""}
              onSave={x=>post("/api/merch",{...x, band_id:bandId, id:x.id})}
              onDelete={id=>del(`/api/merch?id=${id}`)}
              onPhoto={uploadPhoto}
              onShowcase={(id,style)=>post("/api/merch",{action:"showcase",id,style})}/>
          ))}
        </div>
      </section>

      <div data-tour="rtv"><RtvSubmit bandId={bandId}/></div>
    </div>
  );
}
