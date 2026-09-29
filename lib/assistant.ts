// "Roadie" assistant — rule-based responder over ROADIE's own data + BC/border rules
// + guest onboarding. Deterministic fallback brain; runs offline. The LLM layer
// (lib/llm.ts) overrides with real conversation when a key is set.
import { all } from "./db";
import { sharedInterests } from "./community";

const WALK:Record<string,string[]> = {
  band: [
    "Build your profile in Garage — name, genre, home town, and your links (Spotify, socials).",
    "Drop a Floor Session — record off your phone; ROADIE cleans it up so it doesn't sound rough.",
    "Open the Tour Map, plot a runout — ROADIE finds open slots that fit your genre and draw.",
    "One tap books a slot and ROADIE drafts the BC contract.",
    "Spin up a poster or sponsor pitch from your dates. Your catalog & royalties live on mymymy.",
  ],
  venue: [
    "List your room (Backend → Venue): capacity, genres, pay model.",
    "Post your open nights — type them, snap a paper calendar (OCR), or just say them.",
    "ROADIE smart-places the right band into each gap; you approve.",
    "Auto-contract + the shared calendar handle the rest. The booking system is the paid add-on.",
  ],
  fan: [
    "Browse Discover and follow your bands — free, no sign-in to look around.",
    "Grab tickets/merch on the band's own page; tip or donate if you like.",
    "Ask a band or venue a question right from their profile.",
  ],
  advertiser: [
    "We are not asking you to sponsor us — we make your ad and we run it.",
    "One shoot day at your place: we script it, shoot it, cut it. You own every master.",
    "It runs on RoadieTV, The Wire and the screens at every ring stop in your market.",
    "Rates depend on the shoot and the markets, so we quote it rather than list it.",
  ],
  sponsor: [
    "We make your advertising and run it — your message, your offer, and you keep the files.",
    "Sponsorship is the other thing: your name on the ring itself. Different budget, different product.",
    "Join the directory free and offer tour perks (hotel night / van day / bar tab).",
    "Watch live ROI — ROADIE shows where the next dollar performs best.",
  ],
};
function role(s:string){ if(/\bband|musician|artist|my band\b/.test(s))return "band"; if(/venue|bar|club|room|promoter/.test(s))return "venue"; if(/fan|listener|public|supporter/.test(s))return "fan"; if(/advertis|ad|ads|commercial|spot/.test(s))return "advertiser"; if(/sponsor|rep|vendor|store/.test(s))return "sponsor"; return ""; }

export type HubCtx = { name:string; province:string; loop:string[] };
const DEFAULT_HUB: HubCtx = { name:"Kelowna Hub", province:"BC", loop:["Kelowna","Vernon","Kamloops","Penticton"] };

export function ask(q:string, hub: HubCtx = DEFAULT_HUB): string {
  const s=q.toLowerCase();

  // Onboarding / sign-up walkthrough (concierge)
  if(/walk me through|get started|sign ?up|let'?s start|onboard|set up|join|how do i (start|begin)/.test(s)){
    const r=role(s);
    if(r){ const steps=WALK[r]; return `Here's the ${r} walkthrough:\n`+steps.map((x,i)=>`${i+1}. ${x}`).join("\n")+`\n\nReady? Sign in and I'll walk you through it live, step by step — or do it all manually, everything's in the menu.`; }
    return "Happy to set you up. Are you a band, a venue, a fan, or a sponsor? Tell me which and I'll walk you through it — and when you're ready to sign up, we start right there. Prefer to poke around yourself? Everything's in the menu.";
  }

  // Lifeline: producers / pros / #need / shared interests
  if(/#?need\s?producer|find .*producer|need a producer|us producer|producer in/.test(s)){
    let pros:any[]=[]; try{ pros=all("SELECT name,headline,country,remote,member_status FROM pros WHERE (','||lower(replace(tags,' ',''))||',') LIKE '%,producer,%'"); }catch{}
    const us = /\busa?\b|united states|american/.test(s);
    const list=(us?pros.filter(p=>p.country==='US'):pros).slice(0,5);
    return "Producers on ROADIE"+(us?" in the USA":"")+":\n"+list.map(p=>`• ${p.name} — ${p.headline}${p.member_status==='lifetime_free'?' (lifetime member)':''}`).join("\n")+"\nFlag #needproducer on the Community page and I'll match by skill + country.";
  }
  if(/#?need\s?gig|need a gig|need a room|book a (gig|show)/.test(s)){
    let slots:any[]=[]; try{ slots=all("SELECT v.name,v.city,sl.date FROM venue_slots sl JOIN venues v ON v.id=sl.venue_id WHERE sl.status='open' ORDER BY sl.date LIMIT 6"); }catch{}
    return "Open rooms right now:\n"+slots.map(r=>`• ${r.date} — ${r.name}, ${r.city}`).join("\n")+"\nPost #needgig with your town and I'll auto-load the area's slots (or the venue's contact).";
  }
  if(/#?need\s?video|music video|videograph|need a video/.test(s)){
    let v:any[]=[]; try{ v=all("SELECT name,city,country FROM pros WHERE (','||lower(replace(tags,' ',''))||',') LIKE '%,music_video,%'"); }catch{}
    return "Video folks on ROADIE:\n"+v.map(x=>`• ${x.name} — ${x.city||x.country}`).join("\n")+"\nFlag #needvideo on the Community page to match one.";
  }
  if(/who .*(music video|makes video|same|common interest)|connect me|shared interest|others like me/.test(s)){
    let g:any[]=[]; try{ g=sharedInterests(); }catch{}
    if(g&&g.length) return "Shared-interest connections I spotted:\n"+g.map((x:any)=>`• ${x.who.length} members ${x.label}: ${x.who.join(', ')}`).join("\n")+"\nWant intros?";
    return "Add your skills/flags to your profile and I'll connect you with members who share them (producers, video, distribution).";
  }
  // What is this / pricing / about
  if(/what is|what.?s roadie|about|how does .*work|new here|who is this for|what.*cost|how much|pricing|why join|tell me about/.test(s)){
    return "Welcome — here's the quick version:\n• ROADIE is the FREE road kit for BC bands: a clean profile, get found by venues, AI books you into open gigs, route a tour, make posters + pitch sponsors, record Floor Sessions off your phone, and reach fans.\n• It's paired with mymymy — your catalog, registration and royalties (the money side). One hub, two tools.\n• Bands & fans join free; you pay on mymymy only for catalog/royalty tools; venues only for the booking system; sponsors pay a small placement fee to be seen. A $5/mo supporter fee just helps keep it running.\nAsk me anything right here without signing in — you only log in to use the tools. Want the walkthrough for a band, venue, fan, or sponsor?";
  }

  // mymymy is artists-only (the money/back-end)
  if(/mymymy|money side|back ?end|catalog|royalt|get paid|publishing|isrc|iswc/.test(s)){
    return "mymymy is the artist back-end — your catalog, registration (ISWC/ISRC, CWR to ASCAP/BMI/SOCAN) and royalties. It's for rights holders: bands and songwriters, not fans/venues/sponsors. ROADIE gets you on stages; mymymy turns your catalog into money. Want help registering your songs? I can walk you through it.";
  }
  // PRO / registration guidance
  if(/bmi|ascap|socan|\bpro\b|performing rights|mechanical|register.*(song|work|music|catalog)|publish/.test(s)){
    return "Registering your music (general guide - not legal advice):\n- Join a PRO for performance royalties: SOCAN (Canada), ASCAP or BMI (USA), or your local PRO elsewhere (PRS UK, GEMA, SACEM).\n- Get a writer/publisher IPI number; works get an ISWC, recordings get ISRCs.\n- Register each work + its splits - mymymy builds the CWR file that submits to ASCAP/BMI for you.\n- Set up mechanical/streaming collection too (e.g. the MLC in the US; your distributor elsewhere).\nWant me to point you into mymymy to start? Confirm specifics with your PRO or a music lawyer.\n\nWant the full education? Watch Casey Graham's Music Money Makeover Show on YouTube (@MusicMoneyMakeover) - the teacher whose lessons inspired mymymy. Free, from scratch: labels, publishing, getting paid.";
  }
  // Contract review pointers
  if(/contract|agreement|deal memo|booking agreement|management|sign.*(deal|contract)/.test(s)){
    return "Reading a music contract — what to check (general info, not legal advice):\n• Term & territory — how long, and where.\n• Rights granted — exactly what they get, and what you keep.\n• Splits & royalties — the %, when you're paid, on gross or net.\n• Recoupment — what costs come off your share first.\n• Exclusivity — are you locked in.\n• Termination & reversion — how you exit and get your rights back.\nROADIE auto-drafts BC gig contracts for you. For anything bigger, have a music lawyer review before you sign.";
  }
  // Copyright basics CA/US/EU
  if(/copyright|who owns|infring|trademark|music law|\blegal\b|\brights\b/.test(s)){
    return "Copyright basics (general info, not legal advice):\n• Your song is protected automatically the moment you create/record it — in Canada, the US and across the EU.\n• Two copyrights: the composition (the song) and the master (the recording) — they can be owned and split differently.\n• Registration strengthens enforcement: CIPO (Canada), the U.S. Copyright Office (USA); the EU is automatic with no central registry.\n• Agree splits in writing up front — mymymy locks a split sheet before any release.\nFor a specific dispute or deal, talk to a music/IP lawyer in your country.";
  }
  if(/visa|border|cross|\busa\b|u\.s|america|mexico|carnet|work permit|p-?2|withhold|customs|port of entry/.test(s)){
    let rows:any[]=[]; let ct:any;
    try { rows=all("SELECT to_country,title,key_fact FROM crossings ORDER BY to_country, category LIMIT 8"); } catch {}
    try { ct=all("SELECT name,website FROM contacts WHERE role='immigration_help' LIMIT 1")[0]; } catch {}
    const body = rows.map((r:any)=>`• →${r.to_country}: ${r.title} (${r.key_fact||''})`).join("\n");
    return "Cross-border touring (CA/US/MX) — highlights:\n"+body+(ct?`\n\nVisa/application help: ${ct.name} — ${ct.website||''}`:'')+"\nFull detail + official links on the Border & Visas page.";
  }
  if(/(open|empty|slot|gig).*(slot|gap|gig|date)|where.*play|find.*gig/.test(s)){
    const rows:any[]=all("SELECT v.name,v.city,sl.date,sl.genre_wanted,sl.guarantee FROM venue_slots sl JOIN venues v ON v.id=sl.venue_id WHERE sl.status='open' ORDER BY sl.date LIMIT 6");
    return "Open slots on the board right now:\n"+rows.map(r=>`• ${r.date} — ${r.name}, ${r.city} (${r.genre_wanted||'any'}, $${r.guarantee||0})`).join("\n");
  }
  if(/runout|route|tour.*(loop|okanagan)|drive/.test(s)){
    const loop = hub.loop.length ? hub.loop.join(" -> ") : "your hub loop";
    return `${hub.name} runout loop: ${loop}. Works as a ${Math.max(2,hub.loop.length-1)}-${hub.loop.length} night routing - check the Tour Map for live drive times. Want me to draft stops?`;
  }
  if(/permit|minor|all.ages|licen|vendor/.test(s)){
    let r:any[]=[]; try{ r=all("SELECT rule,source FROM region_rules WHERE topic IN ('site_permit','food_vendor') AND region=? LIMIT 2", hub.province); }catch{}
    if(!r.length) return `I don't have the ${hub.province} permit/all-ages pack loaded yet - confirm with the municipality or the host site.`;
    return r.map((x:any)=>`• ${x.rule} (${x.source})`).join("\n");
  }
  if(/noise|curfew|loud|sound/.test(s)){
    let r:any; try{ r=all("SELECT rule,source FROM region_rules WHERE topic='noise' AND region=? LIMIT 1", hub.province)[0]; }catch{}
    return r? `${r.rule} (${r.source})` : "Noise curfews are municipal - confirm with the venue.";
  }
  if(/sponsor|perk|hotel|van|gear|tab/.test(s)){
    const r:any[]=all("SELECT p.kind,p.city,p.qty,p.qty_claimed,s.name FROM perks p JOIN sponsors s ON s.id=p.sponsor_id");
    return "Sponsor perks you can claim on a routed tour:\n"+r.map(x=>`• ${x.kind} in ${x.city} — ${x.qty-x.qty_claimed} left (${x.name})`).join("\n");
  }
  return "I'm your ROADIE — booking & help line. Ask me: 'what is ROADIE', 'get started as a band', 'find open slots', 'plan a runout', 'visa rules for the USA', or 'what perks can we claim'. Or just tell me what you're trying to do.";
}
