"use client";
import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Check, Guitar, Building2, BadgeDollarSign, Briefcase } from "lucide-react";

// Which hat you're wearing.
//
// Only appears when there's actually a choice — one profile needs no switcher,
// and a row that never does anything is just noise in the sidebar.

type Profile = { id:number; kind:string; ref_id:number; label:string; is_default:boolean; active:boolean };

const ICON: Record<string, any> = {
  band: Guitar, venue: Building2, sponsor: BadgeDollarSign, pro: Briefcase,
};
const KIND_LABEL: Record<string,string> = {
  band: "Artist", venue: "Host site", sponsor: "Business", pro: "Pro / producer",
};

export default function ProfileSwitcher() {
  const [profiles,setProfiles] = useState<Profile[]>([]);
  const [active,setActive] = useState<Profile|null>(null);
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async ()=>{
    const r = await fetch("/api/profiles").then(r=>r.json()).catch(()=>null);
    if (!r?.profiles) return;
    setProfiles(r.profiles);
    setActive(r.profiles.find((p:Profile)=>p.active) || null);
  },[]);

  useEffect(()=>{
    load();
    window.addEventListener("roadie:auth", load);
    return ()=>window.removeEventListener("roadie:auth", load);
  },[load]);

  async function pick(p: Profile) {
    if (p.active) { setOpen(false); return; }
    setBusy(true);
    const r = await fetch("/api/profiles",{
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ action:"switch", id:p.id, remember:true }),
    }).then(r=>r.json()).catch(()=>null);
    setBusy(false);
    setOpen(false);
    // Full reload: the active profile changes what nearly every page shows,
    // and patching it in half the components would leave the other half stale.
    if (r && !r.error) location.reload();
  }

  if (profiles.length < 2) return null;

  const Icon = ICON[active?.kind || "band"] || Guitar;

  return (
    <div className="px-2 pb-2">
      <button onClick={()=>setOpen(o=>!o)} disabled={busy}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                   bg-[#14141c] border border-[#2a2a3a] hover:border-[#ff3d6e]">
        <Icon size={15} className="shrink-0 text-[#ff3d6e]"/>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{active?.label || "Choose a profile"}</span>
          <span className="block text-[10px] text-[#8a8aa0] truncate">
            {KIND_LABEL[active?.kind || ""] || ""}
          </span>
        </span>
        <ChevronDown size={14} className="shrink-0 transition-transform"
          style={{transform: open ? "rotate(180deg)" : "none"}}/>
      </button>

      {open && (
        <div className="mt-1 rounded-xl border border-[#2a2a3a] bg-[#14141c] overflow-hidden">
          {profiles.map(p=>{
            const I = ICON[p.kind] || Guitar;
            return (
              <button key={p.id} onClick={()=>pick(p)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#1c1c28]">
                <I size={14} className="shrink-0 text-[#8a8aa0]"/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.label}</span>
                  <span className="block text-[10px] text-[#8a8aa0]">{KIND_LABEL[p.kind] || p.kind}</span>
                </span>
                {p.active && <Check size={14} className="shrink-0 text-[#ff3d6e]"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
