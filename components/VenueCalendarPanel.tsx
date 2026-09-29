"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, RefreshCw, Link2, ClipboardPaste, CheckCircle2, AlertTriangle, BadgeCheck } from "lucide-react";

type Me = { id:number; role:string; venue_id:number|null } | null;
type SyncInfo = { calendar_url?:string|null; kind?:string|null; last_sync?:string|null;
  last_result?:{ added:number; updated:number; skipped:number; total:number }|null };

// Per-venue calendar controls. Rendered on every venue card:
//  - sample (temp) venues show a "claim this venue" button for signed-in venue accounts
//  - the venue's owner (or admin) gets the calendar hookup: paste a URL
//    (webcal:// | Google Calendar share link | direct .ics) or dump raw ICS text.
export default function VenueCalendarPanel({ venue }:{ venue:any }){
  const [me, setMe] = useState<Me>(null);
  const [info, setInfo] = useState<SyncInfo|null>(null);
  const [url, setUrl] = useState("");
  const [ics, setIcs] = useState("");
  const [mode, setMode] = useState<"url"|"paste">("url");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok:boolean; text:string }|null>(null);
  const [claiming, setClaiming] = useState(false);
  const [legalOwner, setLegalOwner] = useState("");
  const [bizLicense, setBizLicense] = useState("");

  const isSample = venue.member_status === "sample" || !venue.user_id;
  const owns = !!me && (me.venue_id === venue.id || me.role === "admin" || me.role === "operator");

  useEffect(()=>{ fetch("/api/auth/me").then(r=>r.ok?r.json():null).then(d=>setMe(d?.user||d||null)).catch(()=>{}); },[]);
  useEffect(()=>{ if(owns) fetch(`/api/venues/calendar?venueId=${venue.id}`).then(r=>r.json()).then(setInfo).catch(()=>{}); },[owns, venue.id]);

  async function claim(){
    setBusy(true); setMsg(null);
    const r = await fetch("/api/auth/link",{ method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ role:"venue", recordId: venue.id, legal_owner: legalOwner, business_license: bizLicense }) });
    const d = await r.json().catch(()=>({}));
    setBusy(false);
    setMsg(r.ok ? { ok:true, text:"Claimed! This is your room now — hook up your calendar below." }
                : { ok:false, text: d.error || "Could not claim (are you signed in as a venue?)" });
    if (r.ok) setMe(m => m ? { ...m, venue_id: venue.id, role:"venue" } : m);
  }

  async function submit(){
    setBusy(true); setMsg(null);
    const body = mode==="url" ? { venueId: venue.id, url } : { venueId: venue.id, ics };
    const r = await fetch("/api/venues/calendar",{ method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body) });
    const d = await r.json().catch(()=>({}));
    setBusy(false);
    if (r.ok) {
      setMsg({ ok:true, text:`Synced ${d.added} new + ${d.updated} updated dates (${d.skipped} past dates skipped).` });
      setInfo(i => ({ ...i, calendar_url: mode==="url"?url:i?.calendar_url, last_result:{ added:d.added, updated:d.updated, skipped:d.skipped, total:d.total } }));
      setIcs("");
    } else setMsg({ ok:false, text: d.error || "Sync failed." });
  }

  async function refresh(){
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/venues/calendar?venueId=${venue.id}&refresh=1`);
    const d = await r.json().catch(()=>({}));
    setBusy(false);
    setMsg(r.ok ? { ok:true, text:`Re-synced: ${d.added} new, ${d.updated} updated.` } : { ok:false, text: d.error || "Refresh failed." });
  }

  // Anonymous visitors on a claimed venue: nothing to show.
  if (!isSample && !owns) return null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {isSample && !owns && !claiming && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted flex items-center gap-1"><AlertTriangle size={12}/>Example listing — is this your room?</span>
          {/* Signed-out visitors got a DISABLED button whose onClick was null —
              the one CTA telling an operator "is this your room?" did nothing
              at all when clicked. Send them to sign-in and come back here. */}
          <button
            onClick={() => me ? setClaiming(true) : (window.location.href = `/signin?next=${encodeURIComponent(location.pathname)}`)}
            disabled={busy} className="btn text-xs flex items-center gap-1"
            title={me ? "Claim it — takes 30 seconds" : "Sign in, then claim this room"}>
            <BadgeCheck size={13}/>{me ? "Claim this venue" : "Sign in to claim"}
          </button>
        </div>
      )}
      {isSample && !owns && claiming && (
        <div className="space-y-2">
          <div className="text-xs text-muted">This makes it a real business listing — partners see who's behind the room.</div>
          <input value={legalOwner} onChange={e=>setLegalOwner(e.target.value)} placeholder="Legal owner / GM name"
            className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-xs outline-none focus:border-neon"/>
          <input value={bizLicense} onChange={e=>setBizLicense(e.target.value)} placeholder="Business license #"
            className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-xs outline-none focus:border-neon"/>
          <div className="flex gap-2">
            <button onClick={claim} disabled={busy || !legalOwner || !bizLicense} className="btn text-xs flex items-center gap-1">
              <BadgeCheck size={13}/>{busy?"…":"Claim + submit for verification"}</button>
            <button onClick={claim} disabled={busy} className="text-[11px] text-muted hover:text-white" title="You can add license details later — listing stays unverified until you do.">skip for now</button>
          </div>
        </div>
      )}

      {owns && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold flex items-center gap-1"><CalendarPlus size={13}/>Your calendar</span>
            <div className="flex gap-1">
              <button onClick={()=>setMode("url")} className={`text-[11px] px-2 py-0.5 rounded ${mode==="url"?"bg-white/15":"bg-white/5"}`}><Link2 size={11} className="inline mr-1"/>URL</button>
              <button onClick={()=>setMode("paste")} className={`text-[11px] px-2 py-0.5 rounded ${mode==="paste"?"bg-white/15":"bg-white/5"}`}><ClipboardPaste size={11} className="inline mr-1"/>Paste .ics</button>
            </div>
          </div>

          {mode==="url" ? (
            <div className="flex gap-2">
              <input value={url} onChange={e=>setUrl(e.target.value)}
                placeholder={info?.calendar_url || "webcal://… , Google Calendar link, or …/cal.ics"}
                className="flex-1 bg-ink border border-edge rounded-lg px-2 py-1.5 text-xs outline-none focus:border-neon" />
              <button onClick={submit} disabled={busy || !url} className="btn text-xs">{busy?"…":"Connect"}</button>
              {info?.calendar_url && <button onClick={refresh} disabled={busy} className="btn text-xs" title="Re-sync saved calendar"><RefreshCw size={13}/></button>}
            </div>
          ) : (
            <div>
              <textarea value={ics} onChange={e=>setIcs(e.target.value)} rows={3}
                placeholder="Paste the contents of an exported .ics file (BEGIN:VCALENDAR …)"
                className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-neon" />
              <button onClick={submit} disabled={busy || !ics} className="btn text-xs mt-1">{busy?"…":"Import dump"}</button>
            </div>
          )}

          {info?.last_result && !msg && (
            <div className="text-[11px] text-muted mt-1">Last sync: {info.last_result.added} added · {info.last_result.updated} updated{info.last_sync ? ` · ${info.last_sync}` : ""}</div>
          )}
        </div>
      )}

      {msg && (
        <div className={`text-[11px] mt-2 flex items-center gap-1 ${msg.ok?"text-emerald-400":"text-amber-400"}`}>
          {msg.ok? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}{msg.text}
        </div>
      )}
    </div>
  );
}
