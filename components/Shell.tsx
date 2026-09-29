"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { CurrencyProvider, CurrencyToggle } from "./Currency";
import { usesMymymy } from "@/lib/roles";
import ProfileSwitcher from "./ProfileSwitcher";
import { hubsByCountry, hubLabel } from "@/lib/hub-groups";
import RoadieAssistant from "./RoadieAssistant";
import RoadieEntry from "./RoadieEntry";
import StatHeader from "./StatHeader";
import { Home, Wrench, Building2, ClipboardList, Map, Globe, BadgeDollarSign, CalendarDays, ServerCog, PlaneTakeoff, Menu, X, MoreHorizontal, Guitar, ImagePlus, Star, Radio, UserPlus, LifeBuoy, ReceiptText, Tent, Hammer, Tv, Flame, Backpack, Clapperboard, ChevronRight, Video, Mail } from "lucide-react";

// The watch-and-listen things. These stay OUT of the collapsing groups and
// always visible — they're what a fan or a passing band opens without hunting,
// and burying them one click deep behind a section header loses them.
// The way back out to the LocalJams entrance. ROADIE (the rings) and LocalJams
// (the jams) are two doors on one account — a visitor must always be able to
// step back to where they came from.
const LOCALJAMS_URL = "https://localjams.org";

const LIVE = [
  { href:"/roadietv", label:"RoadieTV", icon:Tv },
  { href:"/rtv",      label:"RTV",      icon:Clapperboard }, // band videos, back to back
  { href:"/wire",     label:"The Wire", icon:Radio },   // the ring's radio
  { href:"/pit",      label:"The PIT",  icon:Flame },   // fan entrance
];

// Grouped AND collapsed, because a flat list of nineteen links is a wall — you
// scroll it looking for the one thing you came for. Band things sit under YOUR
// BAND, road things under TOUR, everything shared under COMMUNITY.
const GROUPS = [
  { label: "Your band", items: [
    { href:"/garage", label:"Garage / Studio", icon:Wrench },
    { href:"/gigbag", label:"Gig Bag / Merch", icon:Backpack },
    { href:"/sessions", label:"Floor Sessions", icon:Radio },
    // The radio is band business, not just a fan toy — it's their music on it,
    // and only if they push a take to it. It appears here as well as in LIVE.
    { href:"/wire", label:"The Wire", icon:Radio },
    { href:"/poster", label:"Poster / Pitch", icon:ImagePlus },
    { href:"/business", label:"Books / Taxes", icon:ReceiptText },
    { href:"/membership", label:"Membership", icon:Star },
  ]},
  // Six sibling links that shared no context — you picked a ring on one and the
  // next had never heard of it. They're now tabs inside /tour, under one ring
  // selector, and the map keeps its own entry because it's a different mode of
  // looking rather than another list. The old routes all still work.
  { label: "Tour", items: [
    { href:"/tour", label:"Tour", icon:Tent },
    { href:"/map", label:"Tour Map", icon:Map },
  ]},
  { label: "Community", items: [
    { href:"/community", label:"Bands & Lifeline", icon:LifeBuoy },
    { href:"/venues", label:"Host Sites", icon:Building2 },
    { href:"/host", label:"Host the Ring", icon:Hammer },
    { href:"/discover", label:"Discover", icon:Globe },
    { href:"/advertising", label:"Advertising", icon:Video },
    { href:"/sponsors", label:"Sponsors / ROI", icon:BadgeDollarSign },
    { href:"/pitch",    label:"Sponsor Deck",   icon:Star },
  ]},
];
const MAIN = [
  { href:"/setup", label:"Get started", icon:UserPlus },
  { href:"/", label:"Hub", icon:Home },
];
// Operator plumbing. Hidden from bands and the public — a band's ROADIE is
// about the band, not about how the route gets built behind the curtain.
const OPS = [
  { href:"/admin", label:"Admin console", icon:ServerCog },
  { href:"/admin/canvass", label:"Canvassing", icon:ClipboardList },
  { href:"/admin/backline", label:"Backline", icon:Guitar },
  { href:"/admin/inbox", label:"Inbox", icon:Mail },
  { href:"/backend", label:"Backend consoles", icon:ServerCog },
  { href:"/backend/venue", label:"· Host site", icon:Building2 },
  { href:"/backend/advertiser", label:"· Sponsor / vendor", icon:BadgeDollarSign },
];
// keep in step with isOperator() in lib/roles.ts
const ELEVATED = new Set(["super_admin", "manager", "admin", "operator"]);
const TABS = [
  { href:"/", label:"Hub", icon:Home },
  { href:"/ring", label:"Ring", icon:Tent },
  { href:"/garage", label:"Garage", icon:Wrench },
  { href:"/board", label:"Board", icon:ClipboardList },
];

function isActive(path:string, href:string){ return href==="/" ? path==="/" : path===href || (href!=="/backend" && path.startsWith(href)); }

/**
 * A collapsed section of the nav.
 *
 * Defined at module scope on purpose: declared inside Shell it would be a new
 * component type on every render, React would remount it, and the open/closed
 * state would reset every time anything else in the shell changed.
 *
 * Closed by default, but a section containing the page you're on opens itself —
 * otherwise the highlighted "you are here" link is hidden inside a collapsed
 * header and the nav stops telling you where you are.
 */
function NavGroup({ label, items, path, onClick, renderLink }:{
  label:string; items:any[]; path:string;
  onClick?:()=>void; renderLink:(i:any)=>React.ReactNode;
}){
  const hasActive = items.some(i=>isActive(path,i.href));
  const key = `roadie_nav_${label.toLowerCase().replace(/\s+/g,"_")}`;
  const [open,setOpen] = useState(false);

  // Restore the last choice, then let an active child force it open.
  useEffect(()=>{
    let remembered = false;
    try { remembered = localStorage.getItem(key)==="1"; } catch {}
    if (remembered || hasActive) setOpen(true);
  },[key,hasActive]);

  function toggle(){
    setOpen(o=>{
      const next = !o;
      try { localStorage.setItem(key, next?"1":"0"); } catch {}
      return next;
    });
  }

  return (
    <div>
      <button onClick={toggle} aria-expanded={open}
        className="w-full label px-3 pt-4 pb-1 flex items-center gap-1 hover:text-white">
        <ChevronRight size={11}
          className="transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}/>
        {label}
      </button>
      {open && items.map(i=>renderLink(i))}
    </div>
  );
}
function askRoadie(){ if(typeof window!=="undefined") window.dispatchEvent(new Event("roadie:open")); }

function HubBadge(){
  const [hub,setHub]=useState<any>(null);
  const [hubs,setHubs]=useState<any[]>([]);
  useEffect(()=>{ fetch("/api/hub").then(r=>r.json()).then(d=>{ setHub(d.hub); setHubs((d.hubs||[]).filter((h:any)=>h.live)); }).catch(()=>{}); },[]);
  async function switchHub(slug:string){
    await fetch("/api/hub",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({slug})});
    location.reload();
  }
  if(!hub) return <div className="label mt-1">…</div>;
  if(hubs.length<=1) return <div className="label mt-1">{hub.name} • {hub.province}</div>;
  return (
    <select value={hub.slug} onChange={e=>switchHub(e.target.value)}
      className="label mt-1 bg-transparent border-0 outline-none cursor-pointer">
      {/* Grouped by country: "SoCal Mountains Hub • CA" reads as Canada when
          CA is California, and the two are not interchangeable anyway. */}
      {hubsByCountry(hubs).map(g=>(
        <optgroup key={g.country} label={g.label}>
          {g.hubs.map((h:any)=><option key={h.slug} value={h.slug}>{hubLabel(h)}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function useActiveKind(){
  const [k,setK]=useState<string|null|undefined>(undefined);
  useEffect(()=>{ const f=()=>fetch("/api/profiles").then(r=>r.json()).then(d=>setK(d?.active?.kind ?? null)).catch(()=>setK(null)); f(); window.addEventListener("roadie:auth",f); return ()=>window.removeEventListener("roadie:auth",f); },[]);
  return k;
}

function MymymyNote(){
  const [me,setMe]=useState<any>(null);
  const kind=useActiveKind();
  useEffect(()=>{ const f=()=>fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user)).catch(()=>{}); f(); window.addEventListener("roadie:auth",f); return ()=>window.removeEventListener("roadie:auth",f); },[]);
  if(kind===undefined) return null;
  if(!usesMymymy(me, kind)) return null;
  return <div className="px-4 pb-4 text-[11px] text-muted">Catalog &amp; royalties live in <span className="text-cyan">mymymy</span>.</div>;
}

function AccountBox(){
  const [me,setMe]=useState<any>(null);
  const kind=useActiveKind();
  useEffect(()=>{ const f=()=>fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user)).catch(()=>{}); f(); window.addEventListener("roadie:auth",f); return ()=>window.removeEventListener("roadie:auth",f); },[]);
  async function out(){ await fetch("/api/auth/logout",{method:"POST"}); try{localStorage.removeItem("roadie_name");}catch{}; location.href="/"; }
  if(me) return <div className="px-4 py-2 text-xs"><div className="text-white font-medium truncate">{me.display_name||me.email}</div><div className="flex gap-3 mt-0.5">
    {/* Fans, host sites and sponsors own nothing in the catalog, and showing
        them this link is how stray rights-holder accounts get created — the
        far side auto-provisions on arrival. */}
    {kind!==undefined && usesMymymy(me, kind) && <a href="/api/auth/sso/start" className="text-cyan hover:text-white">Open mymymy →</a>}
    <button onClick={out} className="text-muted hover:text-white">Sign out</button></div></div>;
  return <a href="/signin" className="block px-4 py-2 text-xs" style={{color:"#ff3d6e"}}>Sign in →</a>;
}

export default function Shell({ children }:{ children:React.ReactNode }){
  const path = usePathname();
  // While the assistant panel is up, the shell hides its own "Ask ROADIE"
  // buttons. Otherwise the launcher and the open panel share the screen —
  // two doors to one helper, which is worst in the mobile stack.
  const [assistantUp,setAssistantUp]=useState(false);
  useEffect(()=>{
    const h=(e:any)=>setAssistantUp(!!e?.detail?.showing);
    window.addEventListener("roadie:assistant",h as any);
    return ()=>window.removeEventListener("roadie:assistant",h as any);
  },[]);
  const [open,setOpen]=useState(false);
  const [role,setRole]=useState<string>("");
  const [signedIn,setSignedIn]=useState<boolean|undefined>(undefined);
  useEffect(()=>{ setOpen(false); },[path]);
  // Arriving from the LocalJams portal (?entry=1): open the smart entry — a
  // signed-in visitor is walked straight in, everyone else gets sign up / sign
  // in / look-around, and sign-in offers "Continue with mymymy" (SSO). This is
  // why Enter-ROADIE no longer dumps a fan onto a raw page they can't read.
  useEffect(()=>{ try{ if(new URLSearchParams(window.location.search).get("entry")) window.dispatchEvent(new CustomEvent("roadie:entry")); }catch{} },[]);
  useEffect(()=>{
    const f=()=>fetch("/api/auth/me").then(r=>r.json()).then(d=>{
      setRole(String(d.user?.role||""));
      // Tri-state on purpose: undefined until we know. Defaulting to "signed
      // out" made "Get started" flash on every page load for members, which
      // reads as being logged out and asked to sign up again.
      setSignedIn(!!d.user);
    }).catch(()=>{});
    f(); window.addEventListener("roadie:auth",f); return ()=>window.removeEventListener("roadie:auth",f);
  },[]);
  const isOps = ELEVATED.has(role);

  const NavLink = ({href,label,icon:Icon,onClick}:any)=>(
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${isActive(path,href)?"bg-panel2 text-white":"text-muted hover:text-white hover:bg-panel2"}`}>
      <Icon size={18}/>{label}
    </Link>
  );

  const FullMenu = ({onClick}:{onClick?:()=>void})=>(
    <>
      <button onClick={()=>{ askRoadie(); onClick?.(); }}
        hidden={assistantUp}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-1"
        style={{ background:"rgba(255,61,110,0.12)", color:"#ff3d6e", border:"1px solid rgba(255,61,110,0.35)" }}>
        <Guitar size={18}/>Ask ROADIE
      </button>
      {MAIN.filter(i=> i.href!=="/setup" || signedIn===false)
           .map(i=><NavLink key={i.href} {...i} onClick={onClick}/>)}

      {/* Always open. The radio, the TV and the fan entrance are the things
          people come back for; they don't sit behind a section header. */}
      <div className="label px-3 pt-4 pb-1">Live</div>
      {LIVE.map(i=><NavLink key={i.href} {...i} onClick={onClick}/>)}

      {GROUPS.map(g=>(
        <NavGroup key={g.label} label={g.label} items={g.items} path={path} onClick={onClick}
          renderLink={i=><NavLink key={i.href} {...i} onClick={onClick}/>}/>
      ))}
      {isOps && (<>
        <div className="label px-3 pt-4 pb-1 flex items-center gap-1"><ServerCog size={11}/> Operator</div>
        {OPS.map(i=><NavLink key={i.href} {...i} onClick={onClick}/>)}
      </>)}

      {/* Legal, on every page, for every audience.
          Terms used to be linked from exactly one page (/regions), which meant
          a band on a phone could not find what they had agreed to. Anything we
          ask someone to accept has to be reachable from wherever they are. */}
      <div className="label px-3 pt-4 pb-1">Legal</div>
      <div className="px-3 pb-4 text-[11px] leading-relaxed text-muted">
        <a href="/terms" onClick={onClick} className="hover:text-white underline decoration-dotted underline-offset-2">Terms &amp; disclaimer</a>
        {" · "}
        <a href="/ring-agreement" onClick={onClick} className="hover:text-white underline decoration-dotted underline-offset-2">Ring contract</a>
        {" · "}
        <a href="/crew" onClick={onClick} className="hover:text-white underline decoration-dotted underline-offset-2">Work the ring</a>
        {" · "}
        <a href="/legal-counsel" onClick={onClick} className="hover:text-white underline decoration-dotted underline-offset-2">Our counsel</a>
        {" · "}
        {/* ROADIE has no privacy policy of its own, and crew signups now collect
            real personal data. The mymymy policy names both platforms and the
            same operator (UARX), so it governs here too — link it rather than
            leave people with nowhere to look. */}
        <a href="https://mymymy.studio/privacy" target="_blank" rel="noreferrer" className="hover:text-white underline decoration-dotted underline-offset-2">Privacy</a>
        <div className="pt-1">
          <a href="/api/legal/ring-contract" download className="hover:text-white underline decoration-dotted underline-offset-2">
            download the ring contract
          </a>
        </div>
      </div>
    </>
  );

  return (
   <CurrencyProvider>
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-edge bg-panel min-h-screen sticky top-0 h-screen flex-col">
        <div className="p-5">
          <Link href="/" className="text-2xl font-black tracking-tight" style={{color:"#ff3d6e"}}>ROADIE</Link>
          <HubBadge/>
          <div className="mt-3"><CurrencyToggle/></div>
          <a href={LOCALJAMS_URL} className="mt-3 block text-xs text-muted hover:text-white">← LocalJams</a>
        </div>
        <ProfileSwitcher/>
        <nav className="flex-1 px-2 space-y-1 scroll overflow-y-auto"><FullMenu/></nav>
        <div className="border-t border-edge"><AccountBox/><MymymyNote/></div>
      </aside>

      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-panel/95 backdrop-blur border-b border-edge" style={{paddingTop:"env(safe-area-inset-top)"}}>
        <button aria-label="Menu" onClick={()=>setOpen(true)} className="p-2 -ml-2"><Menu size={22}/></button>
        <Link href="/" className="text-xl font-black tracking-tight" style={{color:"#ff3d6e"}}>ROADIE</Link>
        {!assistantUp && <button aria-label="Ask ROADIE" onClick={askRoadie} className="p-2 -mr-2" style={{color:"#ff3d6e"}}><Guitar size={20}/></button>}
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)}/>
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[82%] bg-panel border-r border-edge flex flex-col" style={{paddingTop:"env(safe-area-inset-top)"}}>
            <div className="flex items-center justify-between p-4">
              <span className="text-2xl font-black" style={{color:"#ff3d6e"}}>ROADIE</span>
              <div className="flex items-center gap-2"><CurrencyToggle/><button aria-label="Close" onClick={()=>setOpen(false)} className="p-2"><X size={22}/></button></div>
            </div>
            <a href={LOCALJAMS_URL} onClick={()=>setOpen(false)} className="px-4 pb-2 block text-xs text-muted hover:text-white">← LocalJams</a>
            <ProfileSwitcher/>
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto scroll"><FullMenu onClick={()=>setOpen(false)}/></nav>
            <div className="border-t border-edge"><AccountBox/><MymymyNote/></div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <StatHeader/>
        {children}
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-edge flex items-stretch" style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        {TABS.map(({href,label,icon:Icon})=>(
          <Link key={href} href={href} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${isActive(path,href)?"text-neon":"text-muted"}`}>
            <Icon size={20}/>{label}
          </Link>
        ))}
        <button onClick={()=>setOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-muted">
          <MoreHorizontal size={20}/>More
        </button>
      </nav>

      <RoadieAssistant/>
      <RoadieEntry/>
    </div>
   </CurrencyProvider>
  );
}
