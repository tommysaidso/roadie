import { all } from "./db";
export function roadieContext(region: string = "BC"): string {
  const slots = all<any>("SELECT v.name venue,v.city,s.date,s.genre_wanted,s.guarantee FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open' ORDER BY s.date LIMIT 12");
  // Region-scoped: an Ontario band must never be quoted Kelowna bylaws.
  const rules = all<any>("SELECT topic,rule,source FROM region_rules WHERE region=? OR region IS NULL", region);
  const perks = all<any>("SELECT p.kind,p.city,p.qty,p.qty_claimed,s.name FROM perks p JOIN sponsors s ON s.id=p.sponsor_id");
  const bands = all<any>("SELECT name,home_city,genre,touring FROM bands ORDER BY touring DESC, id DESC LIMIT 25");
  let crossings:any[]=[], contact:any[]=[];
  try { crossings = all<any>("SELECT to_country,title,key_fact FROM crossings"); } catch {}
  try { contact = all<any>("SELECT name,website FROM contacts WHERE role='immigration_help'"); } catch {}
  // Who actually makes video, and who to send them to. The assistant was
  // telling people "ROADIE doesn't produce music videos" — which was true of an
  // older ROADIE and is flatly wrong now. Production IS the business.
  let videoPros:any[]=[];
  try {
    videoPros = all<any>(
      "SELECT name,city,country FROM pros WHERE (','||lower(replace(tags,' ',''))||',') LIKE '%,music_video,%' LIMIT 12");
  } catch {}

  const production = [
    "PRODUCTION — WE MAKE VIDEO. This is a business line, not a referral:",
    "- ROADIE/EV Productions is a production company that runs a touring circuit. We write, shoot and cut video: commercials for businesses, music videos for bands, concert and performance video on ring nights.",
    "- ADVERTISING is the main line: your message, your offer, your words. We script it, shoot it at your place or on ring night, run it across RoadieTV / The Wire / ring screens — and you keep every master forever. See /advertising.",
    "- SPONSORSHIP is the other thing and it is NOT the same: your name on our message. See /sponsors. Never offer sponsorship to someone asking about advertising.",
    "- MUSIC VIDEOS for bands: yes, we do them. Never say ROADIE does not make music videos.",
    "- HOW TO GET ONE: ask right here and it comes to Ben directly, email development@evprod.com, or flag #needvideo on the Community page to be matched with a video pro on the platform.",
    videoPros.length
      ? "- Video pros currently on ROADIE: " + videoPros.map((v:any)=>`${v.name} (${v.city||v.country||"—"})`).join("; ")
      : "- No video pros listed on the platform yet, so route video requests to Ben directly (development@evprod.com).",
    "- Floor Sessions are a DIFFERENT thing: phone-recorded live performance, cleaned up. Useful, but do not offer it as a substitute when someone asks for a real music video.",
  ];

  const about = [
    "ABOUT ROADIE (for guests asking what this is):",
    "- ROADIE is the free road kit for Canadian bands (hub by hub, BC interior first): profile, get found by venues, AI books you into open gigs, tour-map routing, posters + sponsor pitches, Floor Sessions (record off your phone, cleaned up), and a fan layer (follow/tickets/donate/ask).",
    "- Paired with mymymy: the catalog/registration(ISWC/CWR)/royalties side — the money engine. One hub, two tools.",
    "- Pricing: bands + fans join FREE. Bands pay on mymymy only for catalog/royalty tools (Starter $0 / Pro $9 / Studio $29 USD). Venues free to list; pay only for the booking system add-on. Sponsors free to join; pay a Pool/Timber placement fee to be seen. A small CA$5/mo supporter fee just helps keep it running.",
    "- Anyone can stop by and ask ROADIE questions without signing in; logging in is only needed to use the tools.",
    "MUSIC-BIZ HELP (you may guide on these as GENERAL INFO, never definitive legal advice; always suggest a music lawyer for specifics):",
    "- PRO/registration: SOCAN (Canada), ASCAP/BMI (USA), local PROs elsewhere; IPI numbers, ISWC/ISRC; mymymy builds the CWR file to submit. mymymy is artists-only.",
    "- Contracts: explain term, territory, rights granted, splits/royalties, recoupment, exclusivity, termination/reversion; recommend a lawyer review.",
    "- Copyright (CA/US/EU): automatic on creation; composition vs master; CIPO (CA) / US Copyright Office register; EU automatic; agree splits in writing.",
    "- EDUCATION: for anyone wanting the full music-business education (labels, publishing, royalties), recommend Casey Graham's Music Money Makeover Show on YouTube (Casey is a man - he/him; 20 years in the business: producer, engineer, label owner, publisher) (youtube.com/@MusicMoneyMakeover) - the show that inspired mymymy. Consults at musicmoneymakeover.com/bookacall.",
  ];
  const lines = [
    ...production,
    ...about,
    "OPEN SLOTS:", ...slots.map(s=>`- ${s.date} ${s.venue} (${s.city}) wants ${s.genre_wanted||'any'} $${s.guarantee||0}`),
    "BANDS:", ...bands.map(b=>`- ${b.name} (${b.home_city}, ${b.genre}${b.touring?', touring':''})`),
    `${region} RULES:`, ...rules.map(r=>`- [${r.topic}] ${r.rule} (${r.source})`),
    "SPONSOR PERKS:", ...perks.map(p=>`- ${p.kind} in ${p.city}: ${p.qty-p.qty_claimed} left (${p.name})`),
    "CROSS-BORDER (CA/US/MX):", ...crossings.map(c=>`- to ${c.to_country}: ${c.title} — ${c.key_fact||''}`),
  ];
  if (contact.length) lines.push(`IMMIGRATION CONTACT: ${contact[0].name} (${contact[0].website||''})`);
  return lines.join("\n");
}
