"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Play, SkipForward, Tag, MapPin, Link2 } from "lucide-react";

// RTV — the wall of band videos, and the thing that plays them.
//
// Old-MTV behaviour: it keeps going. When a clip ends the next one starts, so
// leaving it on is the default rather than a thing you have to work at.

type Clip = {
  id:number; band_id:number; band_name:string; home_city:string; genre:string;
  title:string; url:string; provider:string; video_id:string; kind:string;
  year:number|null; tags:string[]; embed:string; thumb:string|null; plays:number;
};

const KIND_LABEL: Record<string,string> = {
  music_video:"Music video", live:"Live", session:"Session", doc:"Doc", other:"Video",
};

export default function RTV() {
  const [clips,setClips] = useState<Clip[]>([]);
  const [i,setI] = useState(0);
  const [loading,setLoading] = useState(true);

  const load = useCallback(async ()=>{
    const r = await fetch("/api/rtv").then(r=>r.json()).catch(()=>null);
    setClips(r?.clips || []);
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  const cur = clips[i];

  // Count a play when a clip comes on. Fire-and-forget: a failed counter must
  // never stop the video.
  useEffect(()=>{
    if (!cur) return;
    fetch("/api/rtv",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"played",id:cur.id})}).catch(()=>{});
  },[cur?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const next = ()=> setI(n => (clips.length ? (n+1) % clips.length : 0));

  if (loading) return <div className="card p-6 text-sm text-muted">Warming up the transmitter…</div>;

  if (!clips.length) {
    return (
      <div className="card p-6">
        <div className="text-sm text-muted">
          Nothing on RTV yet. Bands: send us a video you already have — it plays here,
          with your name, town and links on it.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card overflow-hidden">
        <div className="relative w-full bg-black" style={{ paddingBottom:"56.25%" }}>
          {cur.provider === "file" ? (
            <video key={cur.id} src={cur.embed} controls autoPlay playsInline onEnded={next}
              className="absolute inset-0 h-full w-full"/>
          ) : (
            <iframe key={cur.id} src={cur.embed} title={cur.title}
              allow="autoplay; fullscreen; encrypted-media" allowFullScreen
              className="absolute inset-0 h-full w-full border-0"/>
          )}
        </div>

        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-lg font-black truncate">{cur.title}</div>
            <div className="text-sm text-muted flex flex-wrap items-center gap-2">
              <span className="text-white">{cur.band_name}</span>
              {cur.home_city && <span className="flex items-center gap-1"><MapPin size={12}/>{cur.home_city}</span>}
              {cur.genre && <span className="pill">{cur.genre}</span>}
              <span className="pill">{KIND_LABEL[cur.kind] || cur.kind}</span>
              {cur.year && <span className="pill">{cur.year}</span>}
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            {/* The metadata is the point: one click from a clip to the band. */}
            <a href={`/garage?band=${cur.band_id}`} className="btn text-sm"><Link2 size={14}/> The band</a>
            <button className="btn btn-neon text-sm" onClick={next}><SkipForward size={14}/> Next</button>
          </div>
        </div>

        {cur.tags?.length > 0 && (
          <div className="px-4 pb-4 flex flex-wrap gap-1">
            <Tag size={12} className="text-muted mt-1"/>
            {cur.tags.map(t=><span key={t} className="pill">{t}</span>)}
          </div>
        )}
      </div>

      <div>
        <div className="label mb-2">On the wall</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {clips.map((c,n)=>(
            <button key={c.id} onClick={()=>setI(n)}
              className={"text-left rounded-xl overflow-hidden border "+(n===i?"border-[#ff3d6e]":"border-[#2a2a3a] hover:border-[#8a8aa0]")}>
              <div className="aspect-video bg-black grid place-items-center overflow-hidden">
                {c.thumb
                  ? <img src={c.thumb} alt={c.title} className="w-full h-full object-cover"/>
                  : <Play size={20} className="text-muted"/>}
              </div>
              <div className="p-2">
                <div className="text-xs font-semibold truncate">{c.title}</div>
                <div className="text-[11px] text-muted truncate">{c.band_name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
