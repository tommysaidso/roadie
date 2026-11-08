import { Page } from "@/components/ui";
import { CurrencyToggle, Money } from "@/components/Currency";
import MembershipTiers from "@/components/MembershipTiers";
import PromoBanner from "@/components/PromoBanner";
import { Check } from "lucide-react";
export const metadata = { title: "Membership", alternates: { canonical: "/membership" } };
export const dynamic = "force-dynamic";

const FALLBACK = [
  { id:"free", label:"Fan", price_usd_month:0, tagline:"Follow the music. Free forever.",
    features:["Community feed — blabber + share","Follow bands, find shows","10 Works trial studio"] },
  { id:"session_player", label:"Session Player", price_usd_month:4.99, tagline:"Get booked. Get covered.",
    features:["Bookable in the player pool","Gear-share + gig alerts","Join unlimited bands","Covered FREE when a paying band rosters you"] },
  { id:"pro", label:"Solo Artist", price_usd_month:8.99, tagline:"Your catalog, stacked and shipped.",
    features:["Unlimited Works + takes","Real ISRC minting + CWR export","AI variants","Catalog audit unlimited"] },
  { id:"studio", label:"Studio", price_usd_month:24.99, tagline:"The full studio swarm.",
    features:["AI section repair + multi-engine remix","Voice cloning + custom voices","Priority queue on all gens","Suno headless full-song"] },
];
async function getPlans(){
  const base = process.env.MYMYMY_API_URL || "http://localhost:8000";
  try{ const r = await fetch(`${base}/billing/plans`, { signal: AbortSignal.timeout(1500) });
    if(r.ok){ const d = await r.json(); if(Array.isArray(d) && d.length) return d; } }catch{}
  return FALLBACK;
}

// Live pricing (2026-07-18) — par USD/CAD: the number is the number.
const VENUE = [
  { name:"List your room", price:0, tagline:"Always free", feats:["Venue profile on ROADIE","Post availabilities (type, OCR, or voice)","Show up on the tour map","Receive band enquiries"] },
  { name:"Booking Pro", price:19.99, tagline:"Add-on, per venue", feats:["AI smart-placement into open nights","Calendar, holds, offers + contracts","Show analytics + settlement","Opportunity alerts"] },
  { name:"Vendor Spotlight", price:9.99, tagline:"Shops, studios, rentals", feats:["Featured in your hub","Push events + specials to the feed","Referral tracking","Gear-share priority"] },
];
const SPONSOR = [
  { name:"Bronze", price:99, tagline:"per hub / month", feats:["Feed placement in your hub","Sponsor directory listing","Basic ROI dashboard"] },
  { name:"Silver", price:199, tagline:"per hub / month", feats:["Feed + show-page placement","Band profiles + tour-map pin","Full ROI dashboard"], hot:true },
  { name:"Gold", price:349, tagline:"per hub / month", feats:["Top placement across the hub","Every show page in your hub","Full ROI dashboard + reports"] },
  { name:"Hub Anchor", price:1000, tagline:"6 months — ONE per hub", feats:["The exclusive anchor slot for the season","Top of everything in your hub","When it's gone, it's gone"] },
  { name:"Tour Sponsor", price:1000, tagline:"per tour (up to 6 months)", feats:["Your name on every show page","Every poster + EPK of the run","The easiest brag in local marketing"] },
];

function Card({ name, price, tagline, feats, hot, accent }:{ name:string; price:number; tagline:string; feats:string[]; hot?:boolean; accent:string }){
  return (
    <div className="card p-5 flex flex-col" style={hot?{borderColor:accent}:{}}>
      {hot && <span className="pill self-start mb-2" style={{borderColor:accent,color:accent}}>Most visible</span>}
      <div className="text-lg font-black">{name}</div>
      <div className="text-sm text-muted">{tagline}</div>
      <div className="mt-3 mb-3">
        {price>0 ? <><span className="text-3xl font-black"><Money cad={price}/></span><span className="text-muted text-sm">/mo</span></> : <span className="text-3xl font-black">Free</span>}
      </div>
      <ul className="space-y-1">{feats.map((f,i)=>(<li key={i} className="text-sm flex gap-2"><Check size={14} style={{color:accent}} className="mt-0.5 shrink-0"/>{f}</li>))}</ul>
    </div>
  );
}

export default async function Membership(){
  const plans = await getPlans();
  // Route through SSO so signed-in ROADIE users land in mymymy already logged in.
  const checkout = "/api/auth/sso/start?next=" + encodeURIComponent("/?pricing=1");
  return (
    <Page title="Membership" sub="Bands and venues join free. Bands pay only on the mymymy side (catalog & royalties); venues pay only if they want the booking system; sponsors join free but pay a placement fee to be seen."
      actions={<div className="flex items-center gap-2"><span className="label">Show in</span><CurrencyToggle/></div>}>

      <div className="card p-5 mb-8" style={{borderColor:"#3ddc84"}}>
        <div className="flex items-center gap-2 mb-1"><span className="text-2xl font-black text-moss"><Money cad={5}/></span><span className="text-muted">/mo · keeps it running</span></div>
        <p className="text-sm text-muted">Joining ROADIE is free. A small <Money cad={5}/>-a-month from active members just helps cover hosting, the shared calendar sync, and the upkeep — it’s not a paywall, it’s a hand to keep the community board lit. Everything below is on top of that.</p>
      </div>
      <h2 className="text-xl font-black mb-1">For bands</h2>
      <p className="text-sm text-muted mb-3">ROADIE — the road kit — is <b className="text-moss">free for bands</b>. The cost lives on <span className="text-cyan">mymymy</span> (catalog, ISWC/CWR registration, royalties), and that same plan now also unlocks the ROADIE Pro/Studio tools.</p>
      <MembershipTiers plans={plans} checkoutUrl={checkout}/>

      <h2 className="text-xl font-black mt-10 mb-3">For venues &amp; vendors</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {VENUE.map((v,i)=><Card key={v.name} {...v} accent="#3df0ff" hot={i===1}/>)}
      </div>

      <h2 className="text-xl font-black mt-10 mb-1">For sponsors</h2>
      <p className="text-sm text-muted mb-3">Join free and offer perks. To actually <i>be seen</i>, take a placement in your hub. One <b className="text-amber">Hub Anchor</b> per hub — the exclusive season slot. Think the classified pages in the back of the old Hit Parader, except your ad is on every show page in town.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {SPONSOR.map(s=><Card key={s.name} {...s} accent="#ffb33d" hot={s.name==="Hub Anchor"}/>)}
      </div>
      <div className="mt-4">
        <a href={"/api/auth/sso/start?next=" + encodeURIComponent("/business")}
           className="btn btn-neon text-sm">Buy a placement — card checkout, 2 minutes →</a>
        <span className="text-xs text-muted ml-3">One login for both worlds; every purchase lands on the platform books automatically.</span>
      </div>

      <h2 className="text-xl font-black mt-10 mb-1">For fans</h2>
      <p className="text-sm text-muted mb-6">Always free. Sign up to follow your bands, get notified, grab tickets and merch (on the band&rsquo;s own page), tip/donate, and message bands &amp; venues directly. ROADIE never handles the payment &mdash; those buttons open the act&rsquo;s own ticket or tip page.</p>

      <p className="text-xs text-muted mt-6">All prices are par USD/CAD — the number is the number: you pay in your country&rsquo;s currency, no FX games. Founder/partner accounts are comped.</p>
          <div className="mt-6"><PromoBanner src="/promo/donate.png" alt="Free for every band. Kept alive by the ones who chip in." maxH={320}/></div>
    </Page>
  );
}
