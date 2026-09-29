"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Tv, Trash2 } from "lucide-react";

// Send an existing video to RTV. Bands already have these — the whole point is
// that nothing new has to be made to get on the air.

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

const KINDS = [
  { k:"music_video", label:"Music video" },
  { k:"live",        label:"Live" },
  { k:"session",     label:"Session" },
  { k:"doc",         label:"Doc / behind the scenes" },
  { k:"other",       label:"Other" },
];

const STATUS_LABEL: Record<string,string> = {
  pending:"waiting on review", approved:"on the air", rejected:"not taken",
};

export default function RtvSubmit({ bandId }:{ bandId:number|null }) {
  const [clips,setClips] = useState<any[]>([]);
  const [url,setUrl] = useState("");
  const [title,setTitle] = useState("");
  const [kind,setKind] = useState("music_video");
  const [year,setYear] = useState<string>("");
  const [tags,setTags] = useState("");
  const [msg,setMsg] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async ()=>{
    if (!bandId) return;
    const r = await fetch(`/api/rtv?mine=1&band=${bandId}`).then(r=>r.json()).catch(()=>null);
    setClips(r?.clips || []);
  },[bandId]);
  useEffect(()=>{ load(); },[load]);

  async function submit() {
    setMsg(null); setBusy(true);
    const r = await fetch("/api/rtv",{
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({
        band_id: bandId, title, url, kind,
        year: year ? Number(year) : undefined,
        tags: tags.split(",").map(t=>t.trim()).filter(Boolean),
      }),
    }).then(r=>r.json()).catch(e=>({error:String(e)}));
    setBusy(false);
    if (r?.error) { setMsg(r.error); return; }
    setMsg(r.duplicate ? "You'd already sent that one." : "Sent — it'll show on RTV once it's been looked at.");
    setUrl(""); setTitle(""); setTags(""); setYear("");
    load();
  }

  if (!bandId) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black flex items-center gap-2"><Tv size={18}/> RTV</h2>
        <Link href="/rtv" className="btn">Watch RTV</Link>
      </div>
      <p className="text-sm text-muted -mt-1">
        Got a music video, a live clip, anything already shot? Send it. It plays in the
        rotation with your name, your town and a link back to you — you keep the video
        where it lives, we just play it.
      </p>

      <div className="card p-4 flex flex-col gap-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="label">Video link</span>
            <input className={inp} value={url} onChange={e=>setUrl(e.target.value)}
              placeholder="YouTube, Vimeo, or a direct .mp4"/></label>
          <label className="block"><span className="label">Title</span>
            <input className={inp} value={title} onChange={e=>setTitle(e.target.value)}
              placeholder="the song or the clip"/></label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block"><span className="label">What is it</span>
            <select className={inp} value={kind} onChange={e=>setKind(e.target.value)}>
              {KINDS.map(k=><option key={k.k} value={k.k}>{k.label}</option>)}
            </select></label>
          <label className="block"><span className="label">Year</span>
            <input type="number" className={inp} value={year} onChange={e=>setYear(e.target.value)}
              placeholder="2024"/></label>
          <label className="block"><span className="label">Tags</span>
            <input className={inp} value={tags} onChange={e=>setTags(e.target.value)}
              placeholder="punk, kelowna, live"/></label>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-neon" onClick={submit} disabled={busy || !url.trim() || !title.trim()}>
            {busy ? "Sending…" : "Send it to RTV"}
          </button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </div>

      {clips.length > 0 && (
        <div className="flex flex-col gap-2">
          {clips.map(c=>(
            <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-[#2a2a3a]">
              {c.thumb
                ? <img src={c.thumb} alt="" className="w-20 h-12 object-cover rounded shrink-0"/>
                : <div className="w-20 h-12 rounded bg-[#0b0b0f] shrink-0"/>}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{c.title}</div>
                <div className="text-xs text-muted truncate">
                  {STATUS_LABEL[c.status] || c.status}
                  {c.status === "approved" && c.plays ? ` · ${c.plays} play${c.plays>1?"s":""}` : ""}
                  {c.review_note ? ` — ${c.review_note}` : ""}
                </div>
              </div>
              <button className="btn shrink-0"
                onClick={async()=>{ await fetch(`/api/rtv?id=${c.id}`,{method:"DELETE"}); load(); }}>
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
