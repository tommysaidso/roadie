"use client";
import { useMemo, useRef, useState } from "react";
import { Image as ImageIcon, FileText, Download, Printer, Sparkles } from "lucide-react";
import SongArt from "./SongArt";

const W=760, H=1080;
function wrap(s:string, max:number){ const w=(s||"").split(" "); const out:string[]=[]; let cur="";
  for(const x of w){ if((cur+" "+x).trim().length>max){ if(cur)out.push(cur); cur=x; } else cur=(cur+" "+x).trim(); }
  if(cur)out.push(cur); return out.slice(0,3); }

export default function PosterStudio({ bands, venues, bookings, sponsors, roi }:any){
  const [mode,setMode]=useState<"poster"|"pitch">("poster");
  const [bookingId,setBookingId]=useState<string>(bookings[0]?String(bookings[0].id):"");
  const bk = bookings.find((b:any)=>String(b.id)===bookingId);
  const [bandId,setBandId]=useState<string>(bk?String(bk.band_id):(bands[0]?String(bands[0].id):""));
  const [venueId,setVenueId]=useState<string>(bk?String(bk.venue_id):(venues[0]?String(venues[0].id):""));
  const [sponsorId,setSponsorId]=useState<string>(sponsors[0]?String(sponsors[0].id):"");

  const band = bands.find((b:any)=>String(b.id)===bandId)||{};
  const venue = venues.find((v:any)=>String(v.id)===venueId)||{};
  const sponsor = sponsors.find((s:any)=>String(s.id)===sponsorId)||{};

  const [headline,setHeadline]=useState("");   // optional override
  const [date,setDate]=useState(bk?bk.date:"2026-07-18");
  const [time,setTime]=useState("8:00 PM");
  const [price,setPrice]=useState("$15 / door");
  const [tagline,setTagline]=useState("Live on the road");
  const [hero,setHero]=useState<string>("");      // generated song art, as a data URL
  const [heroDim,setHeroDim]=useState(0.55);      // scrim opacity over the art

  function applyBooking(id:string){ setBookingId(id); const b=bookings.find((x:any)=>String(x.id)===id);
    if(b){ setBandId(String(b.band_id)); setVenueId(String(b.venue_id)); setDate(b.date); } }

  const ref=useRef<SVGSVGElement>(null);
  const fname = `${(band.name||"roadie").replace(/\W+/g,"_")}_${mode}`;

  function download(name:string, blob:Blob){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); }
  function exportSVG(){ if(!ref.current)return; const s=new XMLSerializer().serializeToString(ref.current); download(`${fname}.svg`, new Blob([s],{type:"image/svg+xml"})); }
  function exportPNG(){ if(!ref.current)return; const svg=ref.current; const s=new XMLSerializer().serializeToString(svg);
    const img=new Image(); img.onload=()=>{ const c=document.createElement("canvas"); c.width=W*2; c.height=H*2; const ctx=c.getContext("2d")!; ctx.scale(2,2); ctx.drawImage(img,0,0,W,H); c.toBlob(b=>{ if(b)download(`${fname}.png`,b); }); };
    img.src="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(s))); }
  function printIt(){ if(!ref.current)return; const s=new XMLSerializer().serializeToString(ref.current);
    const w=window.open("","_blank"); if(!w)return; w.document.write(`<html><head><title>${fname}</title><style>@page{margin:0}body{margin:0}</style></head><body>${s}</body></html>`); w.document.close(); w.focus(); setTimeout(()=>w.print(),300); }

  // proof numbers for the pitch
  const cap = venue.capacity||120;
  const draw = band.draw||100;
  const inRoom = Math.min(cap, Math.round((draw+cap)/2));
  const social = Math.round(draw*12);                 // rough social reach
  const netCtr = roi?.impr? (roi.clk/roi.impr) : 0.03;
  const tags = String(band.genres||band.genre||"").split(",").map((x:string)=>x.trim()).filter(Boolean).slice(0,4);
  const head = headline || (band.name||"BAND NAME");
  const headLines = wrap(head.toUpperCase(), 13);

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4">
      {/* CONTROLS */}
      <div className="card p-4 h-fit">
        <div className="flex gap-2 mb-4">
          <button onClick={()=>setMode("poster")} className={`btn text-sm flex-1 flex items-center justify-center gap-1 ${mode==="poster"?"btn-neon":""}`}><ImageIcon size={15}/>Gig poster</button>
          <button onClick={()=>setMode("pitch")} className={`btn text-sm flex-1 flex items-center justify-center gap-1 ${mode==="pitch"?"btn-neon":""}`}><FileText size={15}/>Sponsor pitch</button>
        </div>

        {bookings.length>0 && (
          <div className="mb-3">
            <div className="label mb-1">From a booking</div>
            <select value={bookingId} onChange={e=>applyBooking(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm">
              <option value="">— manual —</option>
              {bookings.map((b:any)=><option key={b.id} value={b.id}>{b.band} @ {b.venue} · {b.date}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><div className="label mb-1">Band</div>
            <select value={bandId} onChange={e=>setBandId(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm">{bands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="col-span-2"><div className="label mb-1">Venue</div>
            <select value={venueId} onChange={e=>setVenueId(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm">{venues.map((v:any)=><option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}</select></div>
          <div><div className="label mb-1">Date</div><input value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm"/></div>
          <div><div className="label mb-1">Time</div><input value={time} onChange={e=>setTime(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm"/></div>
          {mode==="poster" && <>
            <div><div className="label mb-1">Door</div><input value={price} onChange={e=>setPrice(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm"/></div>
            <div><div className="label mb-1">Tagline</div><input value={tagline} onChange={e=>setTagline(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm"/></div>
            <div className="col-span-2"><div className="label mb-1">Headline override</div><input value={headline} placeholder={band.name} onChange={e=>setHeadline(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm"/></div>
          </>}
          <div className="col-span-2"><div className="label mb-1">Sponsor (optional)</div>
            <select value={sponsorId} onChange={e=>setSponsorId(e.target.value)} className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm"><option value="">— none —</option>{sponsors.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>

        {mode==="poster" && (
          <SongArt bandId={bandId} band={band} hero={hero} setHero={setHero}
            heroDim={heroDim} setHeroDim={setHeroDim}/>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={exportPNG} className="btn btn-neon text-sm flex-1 flex items-center justify-center gap-1"><Download size={15}/>PNG</button>
          <button onClick={exportSVG} className="btn text-sm flex items-center justify-center gap-1"><Download size={15}/>SVG</button>
          <button onClick={printIt} className="btn text-sm flex items-center justify-center gap-1"><Printer size={15}/></button>
        </div>
        <div className="text-[11px] text-muted mt-3 flex items-center gap-1"><Sparkles size={12} className="text-neon"/>Drafted from your data. Art is generated from your song — the layout stays.</div>
      </div>

      {/* PREVIEW */}
      <div className="card p-3 overflow-auto scroll">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" style={{maxWidth:520, margin:"0 auto", display:"block", borderRadius:12}} xmlns="http://www.w3.org/2000/svg">
          <rect width={W} height={H} fill="#0b0b0f"/>
          {!hero && <>
            {Array.from({length:24}).map((_,i)=><line key={i} x1={0} y1={i*45} x2={W} y2={i*45} stroke="#121219"/>)}
            {Array.from({length:17}).map((_,i)=><line key={"v"+i} x1={i*45} y1={0} x2={i*45} y2={H} stroke="#121219"/>)}
          </>}
          {hero && <>
            {/* song art sits behind the type; the scrim keeps the copy readable */}
            <image href={hero} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice"/>
            <rect width={W} height={H} fill="#07070c" opacity={heroDim}/>
          </>}
          <rect x={24} y={24} width={W-48} height={H-48} fill="none" stroke="#2a2a3a" strokeWidth={2} rx={18}/>

          {mode==="poster" ? <>
            <text x={60} y={110} fill="#ff3d6e" fontFamily="system-ui" fontSize={22} fontWeight="800" letterSpacing="4">LIVE · {(band.genre||"MUSIC").toUpperCase()}</text>
            <text x={60} y={140} fill="#8a8aa0" fontFamily="system-ui" fontSize={20}>{tagline}</text>
            {headLines.map((ln,i)=><text key={i} x={56} y={250+i*92} fill="#ffffff" fontFamily="system-ui" fontSize={88} fontWeight="900" letterSpacing="-2">{ln}</text>)}
            <line x1={60} y1={560} x2={W-60} y2={560} stroke="#2a2a3a" strokeWidth={2}/>
            <text x={60} y={620} fill="#3df0ff" fontFamily="system-ui" fontSize={40} fontWeight="700">{venue.name}</text>
            <text x={60} y={660} fill="#8a8aa0" fontFamily="system-ui" fontSize={24}>{venue.city}, BC</text>
            <text x={60} y={760} fill="#ffb33d" fontFamily="system-ui" fontSize={56} fontWeight="800">{date}</text>
            <text x={60} y={804} fill="#e8e8f0" fontFamily="system-ui" fontSize={28}>{time} · {price}</text>
            {tags.map((t,i)=><g key={t}><rect x={60+i*150} y={860} width={138} height={40} rx={20} fill="none" stroke="#2a2a3a"/><text x={60+i*150+69} y={886} fill="#c9c9da" fontFamily="system-ui" fontSize={18} textAnchor="middle">{t}</text></g>)}
            {sponsor.name && <text x={60} y={980} fill="#8a8aa0" fontFamily="system-ui" fontSize={22}>Sponsored by <tspan fill="#e8e8f0" fontWeight="700">{sponsor.name}</tspan></text>}
            <text x={W-60} y={1020} fill="#ff3d6e" fontFamily="system-ui" fontSize={24} fontWeight="900" textAnchor="end" letterSpacing="1">ROADIE</text>
          </> : <>
            <text x={60} y={100} fill="#ff3d6e" fontFamily="system-ui" fontSize={20} fontWeight="800" letterSpacing="3">SPONSORSHIP PROPOSAL</text>
            <text x={56} y={170} fill="#ffffff" fontFamily="system-ui" fontSize={52} fontWeight="900">{band.name}</text>
            <text x={60} y={210} fill="#8a8aa0" fontFamily="system-ui" fontSize={24}>{venue.name} · {venue.city}, BC · {date}</text>
            <line x1={60} y1={250} x2={W-60} y2={250} stroke="#2a2a3a" strokeWidth={2}/>

            <text x={60} y={300} fill="#3df0ff" fontFamily="system-ui" fontSize={24} fontWeight="700">The opportunity</text>
            {[["Room capacity",`${cap}`],["Band typical draw",`${draw}`],["Expected in-room",`${inRoom}`],["Est. social reach",`${social.toLocaleString()}`]].map((r,i)=>(
              <g key={i}><rect x={60+(i%2)*330} y={325+Math.floor(i/2)*92} width={310} height={78} rx={12} fill="#14141c" stroke="#2a2a3a"/>
                <text x={80+(i%2)*330} y={358+Math.floor(i/2)*92} fill="#8a8aa0" fontFamily="system-ui" fontSize={18}>{r[0]}</text>
                <text x={80+(i%2)*330} y={392+Math.floor(i/2)*92} fill="#ffffff" fontFamily="system-ui" fontSize={30} fontWeight="800">{r[1]}</text></g>
            ))}

            <text x={60} y={560} fill="#3df0ff" fontFamily="system-ui" fontSize={24} fontWeight="700">What {sponsor.name||"the sponsor"} gets</text>
            {["Logo on the gig poster + door signage","Banner on the band & venue ROADIE profiles","Stage shout-out + social tag the night of","Listed on the tour-map pin for the run"].map((t,i)=>(
              <text key={i} x={70} y={600+i*34} fill="#e8e8f0" fontFamily="system-ui" fontSize={21}>•  {t}</text>
            ))}

            <rect x={60} y={760} width={W-120} height={120} rx={14} fill="#14141c" stroke="#2a2a3a"/>
            <text x={84} y={800} fill="#ffb33d" fontFamily="system-ui" fontSize={20} fontWeight="700">The ask</text>
            <text x={84} y={836} fill="#e8e8f0" fontFamily="system-ui" fontSize={22}>Night sponsorship or perk (bar tab / hotel / van).</text>
            <text x={84} y={864} fill="#8a8aa0" fontFamily="system-ui" fontSize={18}>Network avg engagement: {(netCtr*100).toFixed(1)}% CTR across ROADIE placements.</text>

            <text x={60} y={960} fill="#8a8aa0" fontFamily="system-ui" fontSize={18}>Prepared on ROADIE for {venue.name}. Proof of value for the room.</text>
            <text x={W-60} y={1020} fill="#ff3d6e" fontFamily="system-ui" fontSize={24} fontWeight="900" textAnchor="end" letterSpacing="1">ROADIE</text>
          </>}
        </svg>
      </div>
    </div>
  );
}
