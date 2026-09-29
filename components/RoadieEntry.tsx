"use client";
import { useEffect, useRef, useState } from "react";
import { Guitar, X, Send, UserPlus, LogIn, ArrowLeft, Flame } from "lucide-react";
import SetupWizard from "./SetupWizard";

function SignInChat({ onBack }:{ onBack:()=>void }){
  // Remembered email → skip straight to the password. Click, type once, in.
  let saved=""; try{ saved = localStorage.getItem("roadie_email")||""; }catch{}
  const [log,setLog]=useState<{role:string;text:string}[]>([
    saved ? {role:"bot",text:`Welcome back — still ${saved}? Just your password.\n(or type a different email)`}
          : {role:"bot",text:"Welcome back. What's the email on your account?"}]);
  const [step,setStep]=useState<"email"|"pass">(saved ? "pass" : "email");
  const [email,setEmail]=useState(saved); const [q,setQ]=useState(""); const [busy,setBusy]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[log]);
  async function submit(){
    const v=q.trim(); if(!v||busy) return; setQ("");
    setLog(l=>[...l,{role:"you",text: step==="pass"?"•".repeat(v.length):v}]);
    if(step==="email"){ if(!/.+@.+\..+/.test(v)){ setLog(l=>[...l,{role:"bot",text:"That doesn't look like an email — try again."}]); return; } setEmail(v); setStep("pass"); setLog(l=>[...l,{role:"bot",text:"Got it. And your password."}]); return; }
    if(step==="pass" && /.+@.+\..+/.test(v)){ setEmail(v); setLog(l=>[...l,{role:"bot",text:"Switched. And the password for that one?"}]); return; }
    setBusy(true);
    const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password:v})});
    const d=await r.json();
    if(d.user){ try{ localStorage.setItem("roadie_name", d.user.display_name||""); localStorage.setItem("roadie_email", email); }catch{}; window.dispatchEvent(new Event("roadie:auth"));
      setLog(l=>[...l,{role:"bot",text:`Welcome back, ${d.user.display_name||"friend"} — taking you in…`}]); setTimeout(()=>location.href="/",800); }
    else { setBusy(false); setStep("email"); setLog(l=>[...l,{role:"bot",text:(d.error||"That didn't work")+" Let's try again — your email?"}]); }
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll">
        {log.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="you"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role==="you"?"bg-neon text-ink":"bg-panel2"}`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="p-3 border-t border-edge">
        {/* Most ROADIE accounts are mymymy accounts (Google/Apple/email) with no
            ROADIE password ever set — asking only for a password made the lander a
            dead end for them. Same handoff as /signin. */}
        <a href="https://app.mymymy.studio/sso/out?next=/" className="btn btn-neon w-full text-center block mb-2">Continue with mymymy</a>
        <div className="text-[11px] text-muted text-center mb-2">Signed up with Google, Apple or email on mymymy? Use this — there&rsquo;s no separate ROADIE password.</div>
        <div className="flex items-center gap-2 text-[11px] text-muted mb-2"><div className="flex-1 border-t border-edge"/>or password<div className="flex-1 border-t border-edge"/></div>
        <div className="flex gap-2">
          <button onClick={onBack} className="btn px-2" aria-label="back"><ArrowLeft size={16}/></button>
          <input value={q} type={step==="pass"?"password":"text"} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={step==="email"?"you@email.com":"your password"} className="flex-1 bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"/>
          <button onClick={submit} className="btn btn-neon flex items-center gap-1"><Send size={15}/></button>
        </div>
        <div className="text-[11px] text-muted mt-2">Verification is typed, not spoken — your password stays private.</div>
      </div>
    </div>
  );
}

export default function RoadieEntry(){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<"choose"|"signup"|"signin">("choose");
  const [me,setMe]=useState<any>(null);
  useEffect(()=>{
    const o=(e:any)=>{
      setMode(e?.detail?.mode||"choose"); setOpen(true);
      // Already signed in? Don't ask again — greet and walk them in.
      fetch("/api/auth/me").then(r=>r.json()).then(d=>{
        if(d.user){ setMe(d.user); setTimeout(()=>{ location.href="/"; }, 1200); }
      }).catch(()=>{});
    };
    window.addEventListener("roadie:entry",o as any);
    return ()=>window.removeEventListener("roadie:entry",o as any);
  },[]);
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" style={{ background:"rgba(0,0,0,.6)" }}>
      <div className="card w-full md:max-w-lg mx-2 mb-2 md:mb-0 rounded-2xl overflow-hidden flex flex-col" style={{ height:"82vh", maxHeight:680 }}>
        <div className="flex items-center justify-between px-4 py-3 card-h border-b border-edge">
          <div className="flex items-center gap-2"><Guitar size={18} className="text-neon"/><span className="font-bold">ROADIE</span></div>
          <button onClick={()=>setOpen(false)} aria-label="close" className="p-1.5 text-muted hover:text-white"><X size={18}/></button>
        </div>

        {me && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Guitar size={34} className="text-neon mb-3"/>
            <div className="text-xl font-black">Welcome back, {me.display_name||me.email}.</div>
            <div className="text-sm text-muted mt-2">You're already signed in — walking you in…</div>
          </div>
        )}
        {!me && mode==="choose" && (
          <div className="flex-1 overflow-y-auto p-5 scroll">
            <h2 className="text-xl font-black">Welcome to My Music, My Money, My Hustle.</h2>
            <p className="text-muted text-sm mt-2">I&rsquo;m ROADIE. One door for the whole world — your road kit here, your catalog &amp; money in mymymy, one account for both. Which are you?</p>
            <div className="grid gap-3 mt-5">
              <button onClick={()=>setMode("signup")} className="card-h border border-edge rounded-xl p-4 text-left hover:border-neon flex items-center gap-3">
                <UserPlus className="text-neon" size={22}/>
                <div><div className="font-bold">I&rsquo;m new — sign me up</div><div className="text-xs text-muted">I&rsquo;ll set you up in a couple of questions. Free; your content stays registered to you.</div></div>
              </button>
              <button onClick={()=>setMode("signin")} className="card-h border border-edge rounded-xl p-4 text-left hover:border-neon flex items-center gap-3">
                <LogIn className="text-cyan" size={22}/>
                <div><div className="font-bold">I&rsquo;ve been here — sign in</div><div className="text-xs text-muted">Welcome back. I&rsquo;ll get you to where you left off.</div></div>
              </button>
              <button onClick={()=>{ location.href="/pit"; }} className="card-h border border-edge rounded-xl p-4 text-left hover:border-neon flex items-center gap-3">
                <Flame size={22} style={{color:"#ff9a3d"}}/>
                <div><div className="font-bold">I&rsquo;m a fan — take me in</div><div className="text-xs text-muted">Follow bands, catch shows, jump into The PIT. No account needed.</div></div>
              </button>
            </div>
            <button onClick={()=>{ setOpen(false); window.dispatchEvent(new Event("roadie:open")); }} className="text-xs text-muted mt-5 hover:text-white">or just look around &amp; ask me anything →</button>
          </div>
        )}
        {!me && mode==="signup" && <div className="flex-1 overflow-hidden"><SetupWizard/></div>}
        {!me && mode==="signin" && <div className="flex-1 overflow-hidden"><SignInChat onBack={()=>setMode("choose")}/></div>}
      </div>
    </div>
  );
}
