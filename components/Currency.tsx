"use client";
import { createContext, useContext, useEffect, useState } from "react";

// ROADIE is BC-based -> default CAD. mymymy subscription prices are USD.
// One indicative FX rate (USD per 1 CAD); the actual subscription charge is USD via mymymy.
const USD_PER_CAD = Number(process.env.NEXT_PUBLIC_USD_PER_CAD || "0.73");

type Cur = "CAD" | "USD";
const Ctx = createContext<{cur:Cur; setCur:(c:Cur)=>void; rate:number}>({cur:"CAD", setCur:()=>{}, rate:USD_PER_CAD});

export function CurrencyProvider({ children }:{ children:React.ReactNode }){
  const [cur,setCurState]=useState<Cur>("CAD");
  useEffect(()=>{ try{ const v=localStorage.getItem("roadie_cur") as Cur; if(v==="USD"||v==="CAD") setCurState(v); }catch{} },[]);
  const setCur=(c:Cur)=>{ setCurState(c); try{ localStorage.setItem("roadie_cur",c); }catch{} };
  return <Ctx.Provider value={{cur,setCur,rate:USD_PER_CAD}}>{children}</Ctx.Provider>;
}
export const useCurrency=()=>useContext(Ctx);

// Money: pass a CAD amount, or a USD amount; renders in the chosen currency.
export function Money({ cad, usd, className }:{ cad?:number; usd?:number; className?:string }){
  const { cur, rate } = useCurrency();
  const cadVal = cad!=null ? cad : (usd!=null ? usd/rate : 0);
  const val = cur==="CAD" ? cadVal : cadVal*rate;
  const sym = cur==="CAD" ? "CA$" : "US$";
  return <span className={className}>{sym}{Math.round(val).toLocaleString()}</span>;
}

export function CurrencyToggle({ className }:{ className?:string }){
  const { cur, setCur } = useCurrency();
  return (
    <div className={`inline-flex rounded-lg border border-edge overflow-hidden text-xs ${className||""}`}>
      {(["CAD","USD"] as Cur[]).map(c=>(
        <button key={c} onClick={()=>setCur(c)}
          className={`px-2.5 py-1 ${cur===c?"bg-neon text-ink font-semibold":"text-muted hover:text-white"}`}>{c}</button>
      ))}
    </div>
  );
}
