"use client";
import { useState } from "react";
import { Guitar } from "lucide-react";
export default function SignIn(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  async function go(){
    setBusy(true); setErr("");
    const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
    const d=await r.json();
    if(d.user){ try{ localStorage.setItem("roadie_name", d.user.display_name||""); }catch{}; window.location.href="/"; }
    else { setErr(d.error||"Sign in failed"); setBusy(false); }
  }
  return (
    <div className="p-6 md:p-10 max-w-md mx-auto">
      <img src="/promo/bookie.png" alt="ROADIE - be your own bookie" className="w-full rounded-2xl mb-4 border border-edge" style={{maxHeight:200,objectFit:"cover",objectPosition:"center 30%"}}/>
      <div className="flex items-center gap-2 mb-2"><Guitar className="text-neon"/><span className="text-2xl font-black">Sign in</span></div>
      <p className="text-muted text-sm mb-5">Welcome back to ROADIE. New here? <a href="/setup" className="text-neon">Get started</a> and I'll set you up.</p>
      <div className="card p-5 space-y-3">
        <a href="https://app.mymymy.studio/sso/out?next=/" className="btn btn-neon w-full text-center block">Continue with mymymy</a>
        <div className="text-[11px] text-muted text-center">Same account as mymymy — Google, Apple or email. No separate ROADIE password.</div>
        <div className="flex items-center gap-2 text-[11px] text-muted"><div className="flex-1 border-t border-edge"/>or password<div className="flex-1 border-t border-edge"/></div>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" className="w-full bg-ink border border-edge rounded-xl px-3 py-2 text-sm"/>
        <input value={password} type="password" onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="password" className="w-full bg-ink border border-edge rounded-xl px-3 py-2 text-sm"/>
        {err && <div className="text-sm text-amber">{err}</div>}
        <button onClick={go} disabled={busy} className="btn w-full">{busy?"…":"Sign in with password"}</button>
      </div>
    </div>
  );
}
