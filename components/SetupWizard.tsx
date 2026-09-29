"use client";
import { useEffect, useRef, useState } from "react";
import { Guitar, Building2, Globe, BadgeDollarSign, Send, Check, ShieldCheck, Briefcase } from "lucide-react";
import RoadieCaptcha from "./RoadieCaptcha";

type Step = { key:string; q:string; validate?:(v:string)=>boolean; optional?:boolean };
const MUSIC=/(spotify\.com|music\.apple\.com|bandcamp\.com|soundcloud\.com|youtube\.com|youtu\.be)/i;
const CONTACT=/[^@\s]+@[^@\s]+\.[^@\s]+|https?:\/\/|\.\w{2,}\b/i;
const EMAIL=/.+@.+\..+/;

const SCRIPTS:Record<string,Step[]> = {
  band: [
    { key:"name", q:"What's the band called?" },
    { key:"music", q:"Paste a link to your music — Spotify, Apple Music, Bandcamp, SoundCloud or YouTube.", validate:(v)=>MUSIC.test(v) },
    { key:"city", q:"What town are you based in? Add the province so I file you right - like 'Kelowna BC' or 'Regina SK'." },
    { key:"genre", q:"Main genre?" },
  ],
  venue: [
    { key:"name", q:"Venue name?" },
    { key:"city", q:"What city is it in? Add the province - like 'Kamloops BC'." },
    { key:"contact", q:"Booking email or website? (this is how we keep venues real)", validate:(v)=>CONTACT.test(v) },
    { key:"capacity", q:"Roughly how many does the room hold?", optional:true },
  ],
  fan: [ { key:"name", q:"What should we call you?" } ],
  pro: [
    { key:"name", q:"Your name or studio name?" },
    { key:"tags", q:"What do you do? (comma-sep: producer, mixing, mastering, music_video, distribution, bmi, sag…)" },
    { key:"city", q:"What city are you in?" },
    { key:"country", q:"Country? (CA / US / MX / other)" },
  ],
  sponsor: [
    { key:"name", q:"Company or brand name?" },
    { key:"kind", q:"What kind — food vendor, music store, hotel, vehicle rental, retail, outfitter, or other?" },
    { key:"city", q:"What city are you in?" },
  ],
  brand_rep: [
    { key:"name", q:"What should we call you? (your name, not the company)" },
    { key:"rep_brand", q:"Which brand or company do you represent?" },
    { key:"rep_role", q:"What's your title there — like 'Brand Ambassador', 'Regional Manager', 'Account Rep'?", optional:true },
    { key:"city", q:"What city are you in?" },
  ],
};
const ROLES=[
  {id:"band",      label:"Band / Artist",     icon:Guitar},
  {id:"venue",     label:"Venue / Operator",  icon:Building2},
  {id:"fan",       label:"Fan",               icon:Globe},
  {id:"sponsor",   label:"Sponsor",           icon:BadgeDollarSign},
  {id:"pro",       label:"Producer / Pro",    icon:Guitar},
  {id:"brand_rep", label:"Brand Rep",         icon:Briefcase},
];

export default function SetupWizard(){
  const [role,setRole]=useState("");
  const [idx,setIdx]=useState(0);
  const [auth,setAuth]=useState<""|"email"|"pass">("");
  const [ans,setAns]=useState<Record<string,string>>({});
  const [log,setLog]=useState<{role:string;text:string}[]>([{role:"bot",text:"Let's get you set up. It's free — and signing up registers your content to you and protects your IP. That's the whole point.\n\nFirst: who are you here as?"}]);
  const [q,setQ]=useState("");
  const [done,setDone]=useState<any>(null);
  const [fails,setFails]=useState(0);
  const [captchaGate,setCaptchaGate]=useState(false);
  const pendingAns=useRef<Record<string,string>>({});
  const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[log]);

  function bot(text:string){ setLog(l=>[...l,{role:"bot",text}]); }
  function pickRole(r:string){
    setRole(r); setIdx(0); setAns({}); setFails(0); setAuth("");
    setLog(l=>[...l,{role:"you",text:ROLES.find(x=>x.id===r)!.label},{role:"bot",text:SCRIPTS[r][0].q}]);
  }
  function switchTo(r:string){ setRole(r); setIdx(0); setAns({}); setFails(0); setAuth(""); setTimeout(()=>bot(SCRIPTS[r][0].q),400); }

  async function submit(){
    const v=q.trim(); if(!v) return; setQ("");
    setLog(l=>[...l,{role:"you",text: auth==="pass"? "•".repeat(v.length) : v}]);

    // account collection phase
    if(auth==="email"){ if(!EMAIL.test(v)){ bot("That doesn't look like an email — try again."); return; } setAns(a=>({...a,email:v})); setAuth("pass"); bot("And a password (6+ characters) to lock it to you."); return; }
    if(auth==="pass"){ if(v.length<6){ bot("Make it at least 6 characters."); return; } const na={...ans,password:v}; setAns(na); setAuth(""); pendingAns.current=na; bot("One sec — quick check to keep the bots out."); setCaptchaGate(true); return; }

    if(!role) return;
    const step=SCRIPTS[role][idx];
    const skip=step.optional && /^skip$/i.test(v);
    if(step.validate && !skip && !step.validate(v)){
      const nf=fails+1; setFails(nf);
      if(role==="band" && step.key==="music"){
        if(nf>=2){ bot("No music link, no band listing — that's the rule that keeps it real and protects real artists' spots. I'll set you up as a fan instead. Cool?"); switchTo("fan"); return; }
        bot("Hmm, I need a real music link (Spotify / Apple / Bandcamp / SoundCloud / YouTube). Try again."); return;
      }
      if(role==="venue" && step.key==="contact"){
        if(nf>=2){ bot("Without a real booking contact I can't list this as a venue — sounds like you're here for the shows. Let me set you up as a fan."); switchTo("fan"); return; }
        bot("I need a booking email or website to verify a venue. Try again."); return;
      }
      bot("That doesn't look right — mind trying again?"); return;
    }
    const na={...ans,[step.key]: skip? "" : v}; setAns(na); setFails(0);
    if(idx+1 < SCRIPTS[role].length){ setIdx(idx+1); bot(SCRIPTS[role][idx+1].q); }
    else { setAuth("email"); bot("Last thing — your email, to claim this and keep your content registered to you."); }
  }

  async function finalize(a:Record<string,string>){
    bot("Creating your account & profile…");
    try{
      const reg=await (await fetch("/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:a.email,password:a.password,name:a.name,role})})).json();
      if(reg.error){ bot(`${reg.error}`); setAuth(""); setDone({role,signin:true}); return; }
      try{ localStorage.setItem("roadie_name", a.name||""); }catch{}
      let recordId=0, href="/discover", okMsg="";
      // Match before create. Every room/act on the platform was seeded in as an
      // unclaimed listing, and this wizard always INSERTed — so a real operator
      // signing up got a DUPLICATE while their own listing stayed unclaimed
      // forever. That is why the claim rate was 0 of 919.
      const findExisting = async (path:string, key:string, name:string, city:string) => {
        try{
          const d = await (await fetch(`${path}?q=${encodeURIComponent(name)}&limit=8`)).json();
          const rows = Array.isArray(d) ? d : (d[key]||[]);
          const norm = (s:string)=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
          const town = norm(String(city||"").replace(/\b(BC|AB|SK|MB|ON|QC|NS|NB|PE|NL|YT|NT|NU)\b/gi,""));
          return rows.find((r:any)=> !r.user_id && norm(r.name)===norm(name)
            && (!town || norm(r.city||r.home_city).includes(town) || town.includes(norm(r.city||r.home_city)))) || null;
        }catch{ return null; }
      };
      if(role==="band"){
        const af=await (await fetch("/api/setup/autofill",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role:"band",name:a.name,city:a.city,genre:a.genre})})).json();
        const key=/spotify/i.test(a.music)?"spotify":/apple/i.test(a.music)?"apple":/bandcamp/i.test(a.music)?"bandcamp":/soundcloud/i.test(a.music)?"soundcloud":"youtube";
        const links = JSON.stringify({[key]:a.music});
        const hit=await findExisting("/api/bands","bands",a.name,a.city);
        if(hit){
          recordId=hit.id; href="/garage";
          okMsg=`${hit.name} was already listed — claimed it for you rather than starting a duplicate. It's yours now; edit anything in the Garage.`;
        } else {
          const r=await (await fetch("/api/bands",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:a.name,genre:a.genre,genres:a.genre,home_city:a.city,bio_short:af.bio_short,bio:af.bio,socials:links,links})})).json();
          recordId=r.id; href="/garage";
          okMsg=`Done — ${a.name} is live and it's yours. I drafted your bio and pulled your music in. Welcome aboard! Edit anything in the Garage.`;
        }
      } else if(role==="venue"){
        const hit=await findExisting("/api/venues","venues",a.name,a.city);
        if(hit){
          recordId=hit.id; href="/backend/venue";
          okMsg=`Found ${hit.name} already on the map in ${hit.city} — claimed it for you instead of making a second listing. It's yours now. Post your open nights in the Venue console.`;
        } else {
          const r=await (await fetch("/api/venues",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:a.name,city:a.city,contact:a.contact,capacity:a.capacity?Number(a.capacity.replace(/\D/g,""))||null:null})})).json();
          recordId=r.id; href="/backend/venue";
          okMsg=`${a.name} is listed (pending hub verification) and tied to your account. Post your open nights in the Venue console — without open slots, #needgig falls back to your booking contact.`;
        }
      } else if(role==="sponsor"){
        const r=await (await fetch("/api/sponsors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:a.name,kind:(a.kind||"other").toLowerCase().replace(/\s+/g,"_"),city:a.city,contact:a.email})})).json();
        recordId=r.id; href="/backend/advertiser";
        okMsg=`${a.name} is in the sponsor directory and tied to your account. Add a Pool or Timber placement to be seen.`;
      } else if(role==="brand_rep"){
        const r=await (await fetch("/api/sponsors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:a.rep_brand,kind:"brand_rep",city:a.city,contact:a.email,rep_brand:a.rep_brand,rep_role:a.rep_role||"Brand Rep"})})).json();
        recordId=r.id; href="/backend/advertiser";
        okMsg=`You're in, ${a.name} — ${a.rep_brand} is registered as a brand partner. Your sponsor console is live. Talk to the tour coordinator about matching your placements to the right stops.`;
      } else if(role==="pro"){
        const r=await (await fetch("/api/pros",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:a.name,kind:(a.tags||"").split(",")[0]||"producer",tags:(a.tags||"").toLowerCase().replace(/\s/g,""),city:a.city,country:(a.country||"CA").toUpperCase().slice(0,2),remote:true,links:{email:a.email}})})).json();
        recordId=r.id; href="/community";
        okMsg=`You're in the directory, ${a.name} — flagged: ${a.tags}. Bands flag #needproducer/#needvideo and I'll route them to you by skill + country.`;
      } else {
        href="/discover"; bot(`Welcome aboard${a.name?`, ${a.name}`:""}! You're signed in. Follow your bands in Discover, grab tickets/merch on their pages, message them direct.`);
      }
      // The link call's result used to be ignored, and the "it's yours" message
      // was printed BEFORE it ran — so a 409 (already claimed by someone else)
      // still showed a success screen for a profile the user didn't get.
      if(recordId){
        const lr=await fetch("/api/auth/link",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role,recordId})});
        if(!lr.ok){
          const ld=await lr.json().catch(()=>({}));
          bot(ld.error || "Your account is set up, but that listing couldn't be linked to it — it may already be claimed. Contact support and we'll sort it.");
          setDone({role,href:"/discover"});
          return;
        }
      }
      if(okMsg) bot(okMsg);
      try{ window.dispatchEvent(new Event("roadie:auth")); }catch{}
      setDone({role,href});
    }catch{ bot("Something hiccuped creating that — try again in a sec."); }
  }

  return (
    <div className="card flex flex-col" style={{height:"68vh",maxHeight:620}}>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll">
        {log.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="you"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role==="you"?"bg-neon text-ink":"bg-panel2"}`}>{m.text}</div>
          </div>
        ))}
        {!role && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {ROLES.map(({id,label,icon:Icon})=>(
              <button key={id} onClick={()=>pickRole(id)} className="card-h rounded-xl p-3 flex items-center gap-2 hover:border-neon border border-edge text-sm">
                <Icon size={16} className="text-neon"/>{label}
              </button>
            ))}
          </div>
        )}
        {captchaGate && !done && (
          <div className="pt-1 pb-2">
            <RoadieCaptcha onVerified={()=>{ setCaptchaGate(false); finalize(pendingAns.current); }}/>
          </div>
        )}
        {done && (
          <div className="pt-2 flex gap-2">
            {done.signin
              ? <a href="/signin" className="btn btn-neon text-sm">Sign in instead</a>
              : <a href={done.href} className="btn btn-neon text-sm inline-flex items-center gap-1"><Check size={15}/>Go to my {done.role==="fan"?"feed":done.role}</a>}
          </div>
        )}
        <div ref={endRef}/>
      </div>
      {role && !done && !captchaGate && (
        <div className="p-3 border-t border-edge">
          <div className="flex gap-2">
            <input value={q} type={auth==="pass"?"password":"text"} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={auth==="email"?"you@email.com":auth==="pass"?"a password (6+ chars)":"Type your answer…"} className="flex-1 bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"/>
            <button onClick={submit} className="btn btn-neon flex items-center gap-1"><Send size={15}/></button>
          </div>
          <div className="text-[11px] text-muted mt-2 flex items-center gap-1"><ShieldCheck size={12} className="text-moss"/>Free — your profile & content stay registered to you (IP protected via mymymy).</div>
        </div>
      )}
    </div>
  );
}
