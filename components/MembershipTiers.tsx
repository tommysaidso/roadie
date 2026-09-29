"use client";
import { Money } from "./Currency";
import { Check } from "lucide-react";

const ROADIE_PERKS:Record<string,string[]> = {
  free: ["Band profile + public page","Browse venues & notice board","Offline tour map","Claim your scraped band/venue — free, forever","Full tools FREE for 3 months when you claim"],
  pro: ["AI smart-placement booking","Runout tour routing on the map","Auto-contracts (BC)","Poster & sponsor-pitch studio","Sponsor ROI dashboard"],
  studio: ["Everything in Pro, prioritised","AI promo-video prep from your catalog","Full CA/US/MX border & visa kit","Gmail/Drive auto-send of contracts & posters"],
  forever_free: ["Founder / partner — everything, both apps"],
};

export default function MembershipTiers({ plans, checkoutUrl }:{ plans:any[]; checkoutUrl:string }){
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {plans.filter((p:any)=>p.id!=="forever_free").map((p:any)=>{
        const featured = p.id==="pro";
        const perks = ROADIE_PERKS[p.id]||[];
        return (
          <div key={p.id} className={`card p-5 flex flex-col ${featured?"":""}`} style={featured?{borderColor:"#ff3d6e"}:{}}>
            {featured && <span className="pill self-start mb-2" style={{borderColor:"#ff3d6e",color:"#ff3d6e"}}>Most popular</span>}
            <div className="text-lg font-black">{p.label}</div>
            <div className="text-sm text-muted">{p.tagline}</div>
            <div className="mt-3 mb-1">
              {p.price_usd_month>0
                ? <><span className="text-3xl font-black"><Money usd={p.price_usd_month}/></span><span className="text-muted text-sm">/mo</span></>
                : <span className="text-3xl font-black">Free</span>}
            </div>
            <a href={p.price_usd_month>0?checkoutUrl:"#"} target={p.price_usd_month>0?"_blank":undefined} rel="noreferrer"
               className={`btn text-sm mt-2 mb-4 text-center ${featured?"btn-neon":""}`}>{p.price_usd_month>0?"Subscribe on mymymy":"Start free"}</a>

            <div className="label mb-1">mymymy — catalog & money</div>
            <ul className="space-y-1 mb-3">{p.features.slice(0,5).map((f:string,i:number)=>(
              <li key={i} className="text-sm flex gap-2"><Check size={14} className="text-moss mt-0.5 shrink-0"/>{f}</li>))}</ul>

            <div className="label mb-1 text-neon">+ ROADIE — the road kit</div>
            <ul className="space-y-1">{perks.map((f,i)=>(
              <li key={i} className="text-sm flex gap-2"><Check size={14} className="text-neon mt-0.5 shrink-0"/>{f}</li>))}</ul>
          </div>
        );
      })}
      <div className="md:col-span-3 card p-4 text-sm text-muted">
        <b className="text-neon">The participation deal:</b> joining is free, claiming your club or band is free, and the full toolkit is free for 3 months.
        After that, membership only kicks in once ROADIE books you past a revenue line ($2,000/90 days through the platform) — if we're not making you money, you don't pay.
        And when you do pay, it's a working business tool, so it's typically a deductible expense (ask your accountant).
      </div>
    </div>
  );
}
