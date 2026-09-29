"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Radio, Loader2 } from "lucide-react";
import { usesMymymy } from "@/lib/roles";

// Your station's on-air switch.
//
// The switch lives here but the decision is mymymy's: ROADIE asks on your
// behalf and mymymy checks you actually own the station. One source of truth,
// two places you can reach it from.

type Station = {
  slug:string; name:string; scope:string; genre:string|null;
  is_public:boolean; tracks:number; has_tracks:boolean;
};

export default function WireStations() {
  const [stations,setStations] = useState<Station[]|null>(null);
  const [msg,setMsg] = useState<string|null>(null);
  const [noAccount,setNoAccount] = useState(false);
  const [busy,setBusy] = useState<string|null>(null);
  const [me,setMe] = useState<any>(null);
  const [kind,setKind] = useState<string|null|undefined>(undefined);
  useEffect(()=>{ fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user)).catch(()=>{}); },[]);
  useEffect(()=>{ fetch("/api/profiles").then(r=>r.json()).then(d=>setKind(d?.active?.kind ?? null)).catch(()=>setKind(null)); },[]);

  const load = useCallback(async ()=>{
    const r = await fetch("/api/wire").then(r=>r.json()).catch(()=>null);
    if (!r) { setStations([]); return; }
    setNoAccount(!!r.no_account);
    if (r.error) setMsg(r.error);
    setStations(r.stations || []);
  },[]);
  useEffect(()=>{ load(); },[load]);

  async function toggle(st: Station) {
    setBusy(st.slug); setMsg(null);
    const r = await fetch("/api/wire",{
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ slug: st.slug, is_public: !st.is_public }),
    }).then(r=>r.json()).catch(e=>({error:String(e)}));
    setBusy(null);
    if (r?.error) { setMsg(r.error); return; }
    load();
  }

  if (stations === null) {
    return <div className="card p-5 text-sm text-muted flex items-center gap-2">
      <Loader2 size={14} className="animate-spin"/> Checking your stations…
    </div>;
  }

  if (noAccount || !stations.length) {
    return (
      <div className="card p-5">
        <div className="label mb-2">It&apos;s your music, and it&apos;s your call</div>
        <p className="text-sm text-muted">
          Nothing reaches The Wire on its own. A track only plays here when someone in the
          band pushes it. Don&apos;t push it and it never airs — no catalogue gets
          swept onto the radio.
        </p>
        {msg && usesMymymy(me, kind) && <p className="text-sm text-[#ff3d6e] mt-2">{msg}</p>}
        {usesMymymy(me, kind) &&
          <a href="/api/auth/sso/start" className="btn btn-neon inline-block mt-3">Open mymymy →</a>}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="label mb-1">Your stations</div>
      <p className="text-sm text-muted mb-3">
        On air means fans can find you on the dial. Off means it&apos;s yours alone — the
        tracks stay, nobody else hears them. Either way, only what your band pushed from
        the Deck is on it.
      </p>

      <div className="flex flex-col gap-2">
        {stations.map(st=>(
          <div key={st.slug} className="flex items-center gap-3 p-3 rounded-xl border border-[#2a2a3a]">
            <Radio size={16} className={st.is_public ? "text-neon" : "text-muted"}/>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{st.name}</div>
              <div className="text-xs text-muted">
                {st.tracks} track{st.tracks===1?"":"s"}
                {st.genre ? ` · ${st.genre}` : ""}
                {" · "}{st.is_public ? "on air" : "private"}
              </div>
            </div>
            <button className={"btn shrink-0 "+(st.is_public?"":"btn-neon")}
              disabled={busy===st.slug || (!st.is_public && !st.has_tracks)}
              onClick={()=>toggle(st)}>
              {busy===st.slug ? "…" : st.is_public ? "Take it off" : "Put it on air"}
            </button>
          </div>
        ))}
      </div>

      {stations.some(s=>!s.has_tracks) && (
        <p className="text-xs text-muted mt-3">
          A station with nothing on it can&apos;t go on air — push a track from the Deck first.
        </p>
      )}
      {msg && <p className="text-sm text-[#ff3d6e] mt-3">{msg}</p>}
    </div>
  );
}
