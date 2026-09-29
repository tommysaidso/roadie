"use client";
import { useEffect, useState, useCallback } from "react";
import { Save, Check, Copy, FileText, ChevronDown, ChevronRight } from "lucide-react";
import PitchContacts from "./PitchContacts";

const DEFAULTS = {
  show_title: "ROADIE: The Ring",
  tagline: "Every town has a stage. We bring it.",

  // ---- ONE SHEET (the answer to "what is it?") ----
  one_line: "A road show where the advertising is the story. 8 rings, 16 bands, two seasons, CA$1,050,000 at union scale.",
  one_sheet_logline: "Eight bands nobody has heard of each get a touring circuit through the towns the big tours drive past — and in every town, the show shoots the commercials for the businesses on the main street. The ads you see in the break were made in the episode you are watching.",
  engine: `THE SHAPE — There are eight rings, corridors of five to twelve towns each, already routed across BC and Alberta. EACH RING GETS ITS OWN BAND. Eight bands go out per season, one per corridor, running their ring end to end. One episode is one ring and one band: a season is eight hours, two seasons is sixteen, and sixteen Canadian bands, most of them touring for the first time.

The band plays every stop on its ring; the camera covers three of those nights plus the advance days around them. Forty-eight filmed stops across two seasons, sixty-two shoot days.

THE CLOCK — every stop runs the same:

1. ROLL IN — Convoy hits a town. Nobody has been here. Nothing is booked past the room.
2. THE DEAL — The crew has to sell the night to the town: the hardware store, the credit union, the diner. Each one that says yes gets a commercial shot that day.
3. THE SHOOT — We make their ad. Their words, their counter, their staff. One take, no agency. This is the comedy and the heart of the show.
4. THE NIGHT — The band plays. 100 to 400 people in a Legion or a hall.
5. THE COUNT — Door split on camera. 60 band / 25 venue / 15 ROADIE. Everyone sees the number.

The jeopardy is real and it is not manufactured: WILL THE TOWN SHOW UP. That question answers itself on camera every episode, and the answer is different every time. That is why there is an episode 2.

THE RING FINDS ITS OWN CAST — the series does not cast next season in an office, it finds it on the road. Every night has a local opener, a band from that town on a professional stage, often for the first time. Across one ring that is five to twelve local acts auditioning without anyone calling it an audition. One of them gets a ring of their own next season. It costs nothing extra to shoot and the stakes in the opening slot are real rather than manufactured.

THE HANDOFF — season two takes a completely fresh set of eight bands. Nobody defends a place; the promise the format runs on is that the ring is open. What carries over is the handoff: a season-one band returns at the top of season two, plays the first night of the new band's ring, and names the local opener they believe earned a ring. That one scene is the check-in (what actually happened to them, not guaranteed to be a happy answer), the succession (the cast chosen on camera by someone with standing), and the close (repeated at the finale, bracketing the new cast with the last one).

THE FORMAT IS SELF-FEEDING — season one's towns produce season two's cast. A returning order needs no development spend and no casting call.`,
  two_chairs: `THE HOST — Rides the whole ring. Carries the cold open, does the interviews, holds a broadcaster's confidence. The host is the audience's way in; he is not the story, he is the one asking. THE SEAT IS THE FORMAT, THE NAME IS CASTING — it can be a working television host, or it can be the ring operator himself, which is the cheaper and in some ways more honest version.

THE VETERAN — A legacy Canadian act who has played these rooms for forty years. THE VETERAN DOES NOT TOUR THE RING. That is the whole trick, and it is what makes the casting affordable and gettable. They shoot in one block day at their own place or a studio: two or three hours, a chair, a camera, a bottle of whatever. We cut that across the entire season.

How it plays: before the rookie band walks into a room, we cut to the veteran, who played that exact room in 1983. He tells you what the load-in is like, what the promoter will try, what the crowd wants at 11pm in that town. Then we watch the rookies find out. He is right sometimes and wrong sometimes, and both are good television.

He never judges and never eliminates. He vouches, he warns, he remembers. It is a blessing, not a job.

NO CASTING IS ATTACHED. The seat is written to be filled by any Canadian act who has run these corridors, and several are approachable on the strength of one block day rather than a tour commitment. Names are identified at the point a broadcaster or financier is in the room, not before.

THE ROOKIE — A band from the platform who has never toured. They ride the whole ring. They get the guarantee, the room, and the chance to be wrong in front of a camera.

Host asks, veteran remembers, rookie finds out. That triangle is the emotional spine. Everything else is the route.`,
  ad_break: `Standard broadcast: the show stops, unrelated ads play, the show resumes.
ROADIE: the ad break IS content from the episode. The spot for Trail Auto Body that we watched get made in act two runs in the break, in market, and the owner keeps the master forever.

- Nobody else on television can do this. A national broadcaster's ad cost rises with every market; ours does not, because the crew is already there.
- It makes the show fundable from a source that is not a broadcast licence: local advertising budgets that already exist in every one of these towns.
- It is the answer to "what is it?" — it is a show that makes its own commercials and pays for itself in the towns it shoots in.`,
  formats_rejected: `X-FACTOR / MAKING THE BAND — Competition needs judges, elimination, and a cast of 30. It makes the band the product and the town the backdrop. We are the opposite, and every broadcaster already has one.

MTV-STYLE CLIP SHOW — No spine, no reason to watch two. Music blocks are a playlist, not a series.

INTERVIEW DOCUMENTARY — Every music doc is this. It sells to nobody, and it does not use the one thing we have that nobody else has: we are actually going there.`,
  interactive_layer: `GENERATION A — watch it and talk to it. At any point the viewer stops the episode and asks, and the show answers in the context of the scene playing:

- "Who is that guy?" — it tells you, and rolls the behind-the-scenes clip of him.
- "What did that room look like empty?" — it shows you.
- "Play the whole song." — it plays the whole song.

The AI has the entire footage library, not just the cut. Everything shot for every episode is searchable and talkable, so the show gets deeper every week instead of older.

BROADCAST SYNC — when the episode airs linear, members with the ROADIE app get the interactive layer on their phone, synced to the broadcast clock. Show on the TV, show in your hand.

No returning series has done this. It is a format category, not a feature.`,
  anchor_advertiser: `THE PRIMARY ASK IS NOT EQUITY. It is one national advertiser taking the ENTIRE ROUTE NETWORK across both seasons — all eight rings, forty-eight towns, sixteen bands — at CA$1,000,000 — forty-eight towns at CA$25,000 each. That single relationship, plus the tax credits it generates and a Canadian broadcast licence, finances all sixteen hours with no equity, no debt, no cap table and nothing to recoup.\n\nWHAT CA$1,000,000 BUYS:\n- Every ring, every stop, both seasons. The brand is on every night the network runs, camera present or not.\n- Forty-eight commercials produced and OWNED — one per filmed town, for their own location, dealer or franchisee in the market that location actually sells into. Masters they keep and run anywhere, in perpetuity.\n- Category exclusivity across the whole network for the full two-season term.\n- The message: their position carried as the civic spine of the show, stated by the series rather than claimed by the brand.\n- Per-stop measurement on the live ROI board.\n\nWHY IT CLOSES: CA$1,000,000 is a modest national campaign line that ordinarily buys thirty-second placements which stop existing the moment the flight ends. Here it buys forty-eight owned commercials at twenty-five thousand a town, sixteen hours of television in which the brand is the reason the thing happened, and a documented record of showing up in two provinces worth of communities that national advertisers otherwise reach with a billboard. Neither side is doing the other a favour.\n\nTARGETS: agricultural and heavy equipment dealers; national tire and auto service; truck and powersports marques; farm, ranch and building supply; credit union networks; rural-serving telecom; brewers with small-market heritage (mind the all-ages format); work apparel and tool brands; and foreign majors entering the Canadian market, for whom local credibility is the one thing that cannot be bought in a media plan.\n\nAPPROACH: direct to the brand's Canadian marketing lead or agency of record, NOT through a broadcaster. It is an advertising production buy that happens to come with sixteen hours of television attached — which is why it is paid from a media budget rather than a goodwill one.`,
  business_terms: `CA$1,050,000 for sixteen hours \u2014 CA$65,625 a finished hour. Materially below the Canadian factual mid-tier, and costed at union scale rather than talked down to a number.\n\nDirect cost of production ......... 852,000\nContingency (10% of direct) ....... 85,000\nCompletion bond (3%) .............. 28,000\nProducer and admin fee (10%) ...... 85,000\nTOTAL ............................. 1,050,000\n\nCONTINGENCY, BOND AND FEE SIT ON TOP OF DIRECT COST, NEVER INSIDE IT. The contingency is a reserve and belongs to the production, not the company. The fee is what the company earns for carrying the production \u2014 office, accounting, legal and clearance, payroll, routing and platform operations, and the risk of running it \u2014 and it is earned on delivery whether or not a dollar comes back downstream. A budget without it is a company paying to work.\n\nWHY THE NUMBER HOLDS: the rings tour on their own economics, so the series budget carries the camera department, not the tour.\n\nUNION SCALE \u2014 three agreements govern different people and there is no single global rate. UBCP/ACTRA covers on-camera performers. IATSE Local 891 covers BC crew, costed at technician scale plus fringes rather than a flat day rate. AFM covers musicians. Everything is budgeted at published scale even where the production may not be signatory, because scale is a third-party benchmark: it absorbs wage inflation across a two-season shoot, survives a bond company's review without a line-by-line defence, and needs no re-budget if a licence forces signatory status mid-stream.\n\nPERFORMER STATUS \u2014 this is a Canadian production and the operator participates in it as a Canadian. The creator is a long-standing SAG-AFTRA member (stunt coordinator, 36 years in the business) but is not a signatory producer. SAG-AFTRA Global Rule One would engage only if a US performer were brought on, which is not contemplated. The host line carries signatory-scale fees and P&H as a provision either way, so the budget absorbs it if it ever happens.\n\nCREW LIVING AND VEHICLES \u2014 nobody sleeps in their own bed for 62 days, so every field position carries accommodation (CA$41,000) and a living-out allowance (CA$21,000) budgeted per person per day. Vehicles are budgeted at the HIGHER option: CA$42,000 in production rentals, which keeps insurance, maintenance and liability inside the production. The lower option is noted but not taken \u2014 owner-drivers paid the CRA prescribed per-kilometre rate, about 19,000 km across the network for roughly CA$13,000, saving CA$29,000. It moves breakdown risk onto an individual and needs their personal policy to cover commercial use, so it is a decision to take with the risk understood, not a default assumed to hit a target.\n\nREBATES AND CREDITS are treated as post-delivery recovery throughout. Never production cash flow. No shoot day depends on their arrival and no rate is set on the assumption of them.`,
  pp_network_pitch: `PROACTIVE PLANNING ONLY. No approach has been made and no decision taken. This is the lay of the land if we ever went down the buyer road.

THE PITCH, RESHAPED FOR A BUYER — a network or streamer is not buying an advertising business, it is buying a returnable show. Lead with the format and the returnability. The budget is a reason it is easy to say yes, never the reason to say yes.

WHAT WE LEAD WITH:
1. THE SERIES — eight bands who have never toured each get a circuit of small towns. One band per route, one route per episode. They arrive with nothing booked past the room and the door money is counted on camera. No elimination, no judges. The question every hour asks is whether the town shows up, and it answers itself on camera.
2. IT CASTS ITSELF — every night has a local opener from that town, and one of them gets a route of their own next season. Season two is cast on camera during season one, so a renewal needs no development cycle and no casting call. The renewal is cheaper than the order. This is the single most commissioner-friendly thing about the format.
3. IT TRAVELS — Canada routed (8 rings, 48 stops, platform live). United States routed and dated (3 rings, 20 stops, 21 fairgrounds and expo centres across WA/OR/CA, 2027). The format localises to any market with a highway and a touring desert. A global buyer can run a version per market from one bible.
4. GENERATION A — the interactive layer, already built. Strong SECOND-meeting asset, weak opener: it reads as tech and they are buying a show. For a device-ecosystem buyer it is the lead.

TWO CUTS, ONE SHOOT — the series is shot once and finished two ways, and the difference is a recut not a reshoot.
- AD-SUPPORTED CUT: the full format. The commercial made in act two plays in that episode's break, in market. The show supplies its own inventory.
- PLATFORM CUT (ad-free): the finished spots come out; everything human about making them stays — the crew selling the night, the shop owner doing take one, the staff arguing about what to say. No advertising plays on the service at any point.
This is nearly free to deliver because the finished spots are already separate deliverables made for the advertiser to keep. Lifting them out is a trim, not a restructure — the story was never the commercial.

BUYER MAP, RANKED BY FIT NOT PRESTIGE:
- TIER 1 (the format is a perfect fit): ad-supported streamers — Tubi, The Roku Channel, Pluto, Amazon's ad tier. They sell the break and this show fills its own break. Also CBC/Gem (unlocks CMF) and APTN.
- TIER 2 (strong, needs a licence conversation): Crave, Paramount+ Canada, Prime Video Canada, PBS and member stations, MTV/Paramount unscripted.
- NETFLIX (a separate case): it HAS an ads tier, so the break idea has somewhere to live, and rolling a format out as local versions per territory is its established unscripted playbook — exactly our shape. Access is the only obstacle and a warm internal introduction largely removes it.
- TIER 3 (aspirational): Apple TV+. The advertising objection is answered by the platform cut. Two frictions remain — its unscripted slate is small, premium and talent-led while ours is built on people nobody has heard of, and it does not accept unsolicited material at all.

ACCESS — THE PART NOBODY WRITES DOWN: Apple, Netflix and the major US streamers do not read unsolicited pitches and will not open an email from an unrepresented producer. Material reaches them three ways only: a production company with an existing overall or first-look deal, a literary agent at a major agency, or an entertainment lawyer with buyer relationships. Attaching one of those is prior and separate work. Tier 1 buyers can be approached directly today.

THE PRACTICAL SEQUENCE: land a Tier 1 order, shoot it, and let a finished season with an audience and a working interactive layer open the Tier 3 door. Attachment is cheap once something exists and nearly impossible before.`,
  pp_what_changes: `IF A BUYER COMES IN, FIVE THINGS MOVE. Better to know them before the room than to renegotiate after.

1. WHERE THE MONEY COMES FROM — a licence fee displaces most or all of the network advertising anchor. The independent model funds from advertisers and recovers through credits; a commissioned model funds from the buyer. THE TWO DO NOT SIMPLY ADD TOGETHER, and the budget rises to a network delivery standard regardless.

2. THE ADVERTISING BUSINESS — most buyers want control over commercial content inside the programme. On an ad-free platform the spots come off the show entirely (see the platform cut) and live only on the advertisers' own channels. Survivable — the ads still get made and the businesses still keep their masters — but it removes the break-is-the-show idea from the finished episode and with it a large part of the independent revenue line.

3. RIGHTS — THE ONE TO FIGHT ON. A global streamer will ask for worldwide rights in perpetuity. That forecloses the format sale, the local-version business in every other territory, which is the largest long-term value in this property. Territory-limited or windowed rights are worth arguing for even at a lower fee. DECIDE WHERE THE LINE IS BEFORE THE CALL, NOT DURING IT.

4. COST AND OVERHEAD — network delivery brings standards documentation, legal and clearance review, E&O at a higher tier, production insurance to their schedule, and approvals at every stage. CA$1.05M is an INDEPENDENT number. A commissioned version of the same sixteen hours costs materially more and the fee has to cover it.

5. HOW IT IS RUN — creative approvals on casting, cuts and structure. A delivery schedule set by them rather than by the ring's touring calendar. Production reporting obligations. The rings currently move on their own economics; a commissioned season moves on the broadcaster's.

NONE OF THIS IS AN ARGUMENT AGAINST A COMMISSION. A buyer brings reach, a marketing budget and a credential the independent version cannot buy. It is an argument for walking in knowing which terms are negotiable and which are not.`,
  pp_delivery: `WHAT A STREAMER ACTUALLY REQUIRES US TO DELIVER. Planning only — none of this is committed. Specifics vary by buyer and every one of these must be confirmed against their current delivery spec before a budget is signed.

PICTURE
- 4K/UHD capture is the norm for streamer originals. Netflix in particular publishes an APPROVED CAMERA LIST and requires the large majority of an original's runtime to be shot on it (true 4K sensor). Archive, drone, phone and specialty material is allowed only as a limited percentage.
- Masters delivered as ProRes 4444 XQ or an IMF package to their spec, not H.264.
- HDR grade increasingly expected alongside SDR.
- Textless elements at the tail. Clean plates of every title, lower third and on-screen graphic.

AUDIO
- 5.1 surround AND a stereo fold-down.
- A full M&E (music and effects) stem with dialogue removed — required for dubbing. This is the one that quietly breaks documentary shows: if the music is bleeding into the dialogue track because it was captured live in the room, an M&E cannot be built cleanly afterwards.
- Separate dialogue, music and effects stems.

TIMED TEXT AND LOCALISATION
- Subtitles and closed captions to their template, usually in several languages.
- Dub scripts if the show is being localised.
- Forced narrative subtitles for any on-screen text.

LEGAL AND CLEARANCE
- Chain of title, E&O insurance at their required limit.
- Appearance releases from EVERY identifiable person on camera — worldwide, in perpetuity, all media. This is a much wider grant than a Canadian broadcast release, and it has to be got right on the night, in the room, at the time. It cannot be fixed in post.
- Music clearance worldwide in perpetuity for every cue. OUR ADVANTAGE: the music is original and the bands are platform-registered, so this is a negotiation with people we already have a relationship with rather than a needle-drop budget. Any incidental music playing in a venue, a bar radio or a passing car is the real exposure.
- Location agreements, trademark and signage clearance for every business we shoot in.

TECHNICAL QC
- Full QC pass against their spec before acceptance. Failures are re-delivered at our cost.
- Metadata, key art, episode synopses, credits in their format.

WHAT WE DELIVER PER EPISODE, IN SHORT: the platform cut, the ad-supported cut, the textless elements, the audio stems including a clean M&E, the timed text, the clearances, and the QC-passed master.`,
  pp_how_we_shoot: `HOW THE SHOOT CHANGES UNDER A COMMISSION. Planning only.

CAMERA — the field unit as budgeted is small, fast and cheap because it is built for our own delivery. A streamer original likely requires a camera off their approved list, which means bigger bodies, far higher data rates, and a media manager on the road who does nothing else. Budget the camera package and the data pipeline up, not the crew count.

SOUND — this is the biggest technical change and it is easy to underestimate. Delivering a clean M&E means dialogue has to be captured isolated from the music. In a Legion with a band playing, that means a dedicated sound recordist, radio mics on the people who matter, and a discipline about where conversations happen. Our current approach captures the room; theirs requires captured tracks that can be separated afterwards. Add a sound recordist to every shoot day.

RELEASES — worldwide-perpetuity releases from everyone identifiable, got on the night. That means a production coordinator whose actual job on a show night is paperwork and signage at the door, not a producer doing it between other tasks. In a 400-person hall this is a real workload and it is the single most likely thing to fail quietly and surface at delivery.

SCHEDULE — the ring currently moves on its own touring economics. A commissioned season moves on a delivery date, which means the shoot calendar stops being able to flex around weather, a venue falling through, or a band's availability. Build more contingency days, not fewer.

APPROVALS — casting approval on the bands, cut approvals at rough and fine, structural notes. Add post weeks for notes rounds that the independent version does not need.

ONE THING THAT DOES NOT CHANGE: the advertising shoots. Whether or not the finished spots ever appear on the platform, we still shoot them in every town, because that is the story and it is also the business. The platform cut simply does not include the finished commercial.

THE HONEST SUMMARY: a commissioned season is not the same shoot with a bigger cheque. It is a heavier, slower, more documented production, and the fee has to pay for that heaviness. The place to protect is the thing that makes the show good — arriving in a town with nothing booked and finding out what happens.`,
  pp_netflix_letter: `PROACTIVE PLANNING. A warm introduction is not a cold email with a friend's name on it. The friend is spending their own credibility, so the note must survive being forwarded with nothing but 'worth a look' on top, and must make the friend look good for sending it.

NO ATTACHMENT ON THE FIRST SEND. An attachment asks for a decision; a note asks for a reply.

WHO IT SHOULD REACH: Unscripted / Documentary Series at Director or VP level, or the Canada originals team if separate. Not a coordinator — a coordinator has to sell it upward, which is the problem we started with. Let the friend pick the person; they know the building.

--- THE FORWARDABLE NOTE ---

Subject: ROADIE — 8 bands, 8 towns, the ads are made in the episode

Hi [Name],

[Friend] suggested I send this to you directly.

ROADIE is a returning docu-series. Eight bands who have never toured each get a circuit of small towns — the places national tours drive past. One band per route, one route per episode. They arrive with nothing booked past the room, they have to make the town care, and at the end of the night the door money is counted on camera in front of everyone.

There is no elimination and no judges. The question every hour asks is whether the town shows up, and it answers itself on camera. Sometimes it is a full hall and sometimes it is forty people and a bartender, and both are the show.

Three things that I think make it worth twenty minutes:

IT CASTS ITSELF. Every night has a local opener — a band from that town, on a real stage, often for the first time. One of them gets a route of their own next season. Season two is cast on camera during season one, so a renewal needs no development cycle and no casting call.

IT IS ALREADY ROUTED IN TWO COUNTRIES. Eight circuits and forty-eight towns across British Columbia and Alberta, and three more circuits and twenty stops across Washington, Oregon and California — real fairgrounds and expo centres, dated. The format localises to any market with a highway and a touring desert.

THE AD BREAK IS CONTENT FROM THE EPISODE. In every town we write and shoot commercials for the businesses on the main street — one take, their own counter and staff — and they keep the masters. On an ad tier those spots run in that episode's break, in market. The show supplies its own inventory. I have not seen another series that can do that, and it is also why a fully bonded season costs a fraction of the category norm.

I am not looking for development money to find out whether this works. The routes, the venue and band registry, the booking and settlement platform and the advertising arm are built and running today, and there is an interactive layer that lets a viewer stop an episode and ask it questions in the context of the scene playing.

Happy to send the bible and the numbers, or to walk you through it on a call.

Ben Easterday
UARX MIXEDREALITY CORP
development@evprod.com

--- THE SEPARATE LINE TO THE FRIEND (not for forwarding) ---

Thanks for this. Two things that would help: pick whoever you think is the right person rather than the most senior one, and if you can add a line about why you thought of it, that is worth more than anything in my note. If it is a no, a no is genuinely useful — I would rather know fast than be polite about it.

--- IF THEY REPLY ---
Send in this order: one-sheet first, deck second, financing model only if asked. Never all three at once — three documents reads as someone who does not know which one matters. Lead the call with the format, not the money. Be ready for the rights question and know the line before the call.

--- WHAT NOT TO DO ---
Do not attach anything to the first note. Do not lead with the budget — cheap is a closing argument, not a hook. Do not oversell the interactive layer up front; it reads as tech and they are buying a show. Do not name-drop the friend beyond one line. Do not chase — one follow-up after two weeks, then leave it. A warm introduction you chase becomes a favour you spent.`,
  micro_version: `THE MICRO VERSION — one ring, not eight. The format scales down without changing shape: a single corridor of five to twelve towns, one band, cut as ONE longer episode rather than a season. Run it a few minutes longer than a broadcast hour to compensate for the missing scale, and use the extra room the way the big version cannot — stay in the diner longer, let the ad shoot go wrong on camera, play the whole song.

It is not a pilot or a proof of concept. It is the same show at one-eighth the commitment, and it is the version that gets made if an anchor advertiser takes one corridor instead of the network, or if a broadcaster wants to see it before ordering a season. Everything else holds: the ads are made in the episode, the door is counted on camera, the local openers are scouted, and the interactive layer works exactly the same over one ring as over eight.

Budget scales with it, roughly linearly on the camera side and better than linearly on post, since the pipeline cost is carried once regardless.`,
  comparables: "Bourdain (place-led) · Amazing Race (the route is the engine) · Long Way Round (the convoy is the cast) — with a music payoff at the end of every hour.",
  what_exists: `- The route network — 8 rings mapped across BC and Alberta
- The platform — booking, band matching, sponsor tracking, live ROI, all live
- The band and venue registry
- The advertising production arm, already the stated business
- The interactive AI layer, built

This is not a development project looking for infrastructure. The infrastructure is running and the show is the camera pointed at it.`,

  logline: "A rolling, all-ages music ring brings a professional stage, PA and touring production to communities across BC and Alberta — spotlighting homegrown artists and connecting local culture to a national music platform one town at a time.",
  format: "16-episode interactive docu-series across two full seasons — 8 rings, 8 bands per season, one episode per ring. Each episode follows the ring through one or two stops — the advance work, the local band lineup, the community connection, and the show itself. Runtime: 22 min (short-form) or 44 min (long-form) per episode.\n\nINTERACTIVE LAYER: Every episode is AI-interactive. At any point the viewer pauses and the AI picks up — answering in context of exactly where they are in the show. The AI is clip-aware: if related footage exists (behind-the-scenes, alternate angles, earlier or later episode content), it surfaces the clip and talks about it. The content library is the AI's reference database. The more the ring shoots, the smarter the show gets.\n\nBROADCAST SYNC: When an episode airs on a linear broadcaster, the ROADIE app syncs to the broadcast timeline for members. They watch on TV and hold the AI in their hand, locked to the same minute of the show. This format category does not exist yet.",
  episode_structure: `ACT 1 — THE ADVANCE (5-8 min)\nRing coordinator scouts the site and meets the local host sponsor. Local band lineup confirmed. Community context established — what this town is, who plays here, what's missing.\n\nACT 2 — THE TALENT (8-12 min)\nIntimate portrait of the local headliner or featured homegrown act. Their story, their roots, their sound. Intercut with ring production setup.\n\nACT 3 — THE SHOW (6-10 min)\nDoors open. The ring runs. All-ages, no alcohol. Local vendors, community crowd. The music.\n\nCLOSE — THE NEXT TOWN (2-3 min)\nRing rolls out. Preview of the next stop. Community reaction.`,
  themes: `Local talent discovery and amplification\nCommunity economic injection (local sponsors, vendors at their own licence)\nAll-ages, non-alcohol format — accessible to families and youth\nMobile production infrastructure as cultural infrastructure\nIndigenous and First Nations cultural partnership where applicable (BC Interior context)\nLocal food and vendor economy at each stop\nThe ring as rolling marketing and advertising vehicle for homegrown music\nInteractive AI format — viewer can pause and talk to the show at any moment; AI responds in context of episode position and available clip library; broadcast sync delivers the interactive layer to members watching linear TV in real time`,
  cultural_mandate: "ROADIE: The Ring fulfils the cultural mandate criteria by: (1) reflecting Canadian regional identity through portraits of BC Interior and Alberta communities; (2) providing platform and economic opportunity to Canadian emerging artists who have no access to major touring infrastructure; (3) establishing a replicable model for all-ages community music events in underserved markets; (4) documenting the economic and cultural life of small-market communities through the lens of live music.",
  regions_bc: "BC Interior Ring: Kamloops, Kelowna, Vernon, Salmon Arm, Merritt, Princeton, Penticton, Oliver, Osoyoos, Revelstoke, Golden, Fernie. Secondary: Prince George, Quesnel, Williams Lake, 100 Mile House.",
  regions_ab: "Alberta Interior Ring: Lethbridge, Red Deer, Drumheller, Lloydminster, Grande Prairie, Peace River. Season 2 target after BC Interior build.",
  production_company: "UARX MIXEDREALITY CORP (CDN Federal #1695020-5) / EV Entertainment / EV Productions",
  creator_credit: "Ben Easterday / OSTERTOG — Creator, Executive Producer, Ring Operator",
  target_broadcasters: "CBC Gem (primary), Crave, APTN (for First Nations content segments), Prime Video Canada. Independent streaming / social distribution via mymymy platform (ROADIETV).",
  budget_tier: "Low-budget / Micro-budget production. Ring infrastructure is operational (stage, PA, crew). Production cost = camera crew, post, music licensing clearance. No set build, no location build-out.",
  bc_film_notes: "Permit argument: the ring is not a concert promoter — it is a touring production infrastructure that serves as both a live event platform and a film/TV production environment. Each stop is a production day. The mobile stage constitutes a mobile production unit under the ring operator's permit. Safety plan includes nearest hospital, police and fire at each stop, filed in advance.",
  ab_film_notes: "Alberta Film Commission submission: ROADIE: The Ring will document Alberta Interior communities in Season 2. Preliminary community contacts include Lethbridge Arts Council and Red Deer events. BC build confirms model viability.",
  episode_1_title: "Episode 1 — Roll Call",
  episode_1: `COLD OPEN (0:00–2:00)
Aerial of the BC Interior — not the ski-resort BC, but the real one. Highway 97 through the Okanagan. Motels, tire shops, fairgrounds. A shuttered venue in a town square. Title card: "There are 1,516 places in the BC/Alberta Interior where a crowd can gather. Most have never hosted a professional touring act."
CUT TO: a phone ringing in a bar in Merritt. Someone picks up. "The ring is coming."

ACT 1 — THE ADVANCE (2:00–16:00)
The ring coordinator arrives two days before the stop, driving the scout vehicle. Venue walk — stage specs, PA power, load-in door, fire capacity. Then: the host sponsor. A local business owner who's never heard of ROADIE but immediately gets the math. Then: the band. A Merritt-based country-rock trio who've played the same bar for six years. This is their first time on a professional-spec stage in their own town.

The advance work IS the content. The coordinator calling the permit office. The wrong table getting delivered. The PA tech driving up from Kelowna because there's no one local who handles this size of rig. This is the invisible production infrastructure that every touring act takes for granted in a city, and that simply doesn't exist in Merritt.

ACT 2 — THE TALENT (16:00–30:00)
We follow the local headliner in the 48 hours before the show. Their day job. Rehearsal in a garage. The conversation with their kids about what this means. This is not a starving-artist story — it's the story of a working musician who built a real life in a real place. Intercut with: the touring support act arriving from Kamloops. Two years into a real touring career, and this is the first show where the guarantee was in the bank before they left home.

ACT 3 — SHOW DAY (30:00–40:00)
Doors open at 7. All-ages. No alcohol. A family in the front row — kids who've never been to a concert. The band plays like it's the last show on earth. Because in Merritt, for many people in that room, it kind of is. The ring doesn't editorialize. It puts up the stage and turns on the lights.

CLOSE — THE NEXT TOWN (40:00–44:00)
Load-out. The coordinator pins the next stop on the van map. Kamloops. Two days out. The local band waves from the parking lot. The van rolls.
TEXT ON BLACK: "The ring runs every season. The music never leaves."`,

  episode_2_title: "Episode 2 — The Content Machine",
  episode_2: `COLD OPEN (0:00–2:00)
A drive day. The van on Highway 97 between stops. Nobody on a stage. Nothing "happening." And yet the camera can't stop rolling.
One musician is asleep. Another is writing chord charts on their knee. The coordinator is on the phone with the next venue. Outside: the Okanagan in summer — orchards, roadside stands, a reserve boundary marked by a hand-painted sign. This is the content the ring produces even when the ring isn't running.

ACT 1 — THE INFRASTRUCTURE OF THE ROAD (2:00–16:00)
A full day on the ring van between Kamloops and Prince George. The mechanics of touring: the cooler, gear triage, the playlist argument. A stop at a reserve gas station where the cashier recognizes the band from Instagram and asks where they're playing next. This episode is about the content that exists between the stops. The highway is a character. The towns they pass through but don't stop in are characters.

ACT 2 — THE SPARK (16:00–32:00)
A 19-year-old drummer from Quesnel posted a clip three months ago and now has 40,000 followers but has never played a show outside of town. A local fan submitted their name to the ROADIE talent spotlight. The ring is making an unscheduled stop.

We meet the drummer at their parents' house. Twenty minutes of conversation. The ring coordinator floats an opening slot in Prince George. By the end of the segment, it's real.

This is the pipeline: the ring isn't just a tour — it's a discovery machine. Every town has a spark. The ring is what makes it visible.

ACT 3 — THE SHOW THAT WASN'T PLANNED (32:00–40:00)
Prince George. The Quesnel drummer at soundcheck, first time in a real venue. The opening set is raw and a little messy and absolutely unmistakeable. The room is full of people who found out about it through the ROADIE fan notification system 36 hours ago. This is what the content machine produces: spontaneous, real, and only possible because the infrastructure was already there.

CLOSE — THE PIPELINE (40:00–44:00)
The drummer gets into the van. Not to stay — just to the next stop. They have a day job in Quesnel. But the ring has given them a frame. The coordinator updates the ROADIE platform. The fan who submitted the name gets a notification.
TEXT ON BLACK: "The ring doesn't manufacture stars. It gives sparks a stage."`,

  status: "Development",
  notes: "",
};

type Doc = typeof DEFAULTS;
type FieldSpec = { label: string; field: keyof Doc; multiline?: boolean; rows?: number };


function Field({ label, field, doc, set, multiline = false, rows = 3 }: {
  label: string; field: keyof Doc; doc: Doc; set: (k: keyof Doc, v: string) => void;
  multiline?: boolean; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label text-xs">{label}</label>
      {multiline ? (
        <textarea value={doc[field]} onChange={e => set(field, e.target.value)} rows={rows}
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon resize-y" />
      ) : (
        <input value={doc[field]} onChange={e => set(field, e.target.value)}
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon" />
      )}
    </div>
  );
}

export default function PitchEditor() {
  const [doc, setDoc] = useState<Doc>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"" | "one" | "full">("");
  const [loaded, setLoaded] = useState(false);
  // Groups ship closed. Opening one is the user's move.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/admin/pitch").then(r => r.json()).then(d => {
      if (d.content && Object.keys(d.content).length) {
        setDoc({ ...DEFAULTS, ...d.content });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const set = useCallback((k: keyof Doc, v: string) => {
    setDoc(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }, []);

  async function save() {
    setBusy(true);
    try {
      await fetch("/api/admin/pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(doc),
      });
      setSaved(true);
    } finally { setBusy(false); }
  }

  function buildOneSheet() {
    return [
      `${doc.show_title.toUpperCase()} — ONE SHEET`,
      ``,
      `WHAT IT IS`,
      doc.one_line,
      ``,
      `LOGLINE`,
      doc.one_sheet_logline,
      ``,
      `THE ENGINE`,
      doc.engine,
      ``,
      `THE TWO CHAIRS`,
      doc.two_chairs,
      ``,
      `THE BREAK IS THE SHOW`,
      doc.ad_break,
      ``,
      `THE ANCHOR ADVERTISER`,
      doc.anchor_advertiser,
      ``,
      `BUDGET, SCALE, FEE AND RESERVES`,
      doc.business_terms,
      ``,
      `THE MICRO VERSION`,
      doc.micro_version,
      ``,
      `GENERATION A — INTERACTIVE LAYER`,
      doc.interactive_layer,
      ``,
      `WHY NOT THE OTHER FORMATS`,
      doc.formats_rejected,
      ``,
      `COMPARABLES`,
      doc.comparables,
      ``,
      `WHAT ALREADY EXISTS`,
      doc.what_exists,
      ``,
      `PRODUCTION`,
      doc.production_company,
      doc.creator_credit,
      `development@evprod.com`,
    ].join("\n");
  }

  function buildExport() {
    return [
      `${doc.show_title.toUpperCase()}`,
      `"${doc.tagline}"`,
      ``,
      `WHAT IT IS`,
      doc.one_line,
      ``,
      `THE ENGINE`,
      doc.engine,
      ``,
      `THE TWO CHAIRS`,
      doc.two_chairs,
      ``,
      `THE BREAK IS THE SHOW`,
      doc.ad_break,
      ``,
      `THE ANCHOR ADVERTISER`,
      doc.anchor_advertiser,
      ``,
      `BUDGET, SCALE, FEE AND RESERVES`,
      doc.business_terms,
      ``,
      `THE MICRO VERSION`,
      doc.micro_version,
      ``,
      `GENERATION A — INTERACTIVE LAYER`,
      doc.interactive_layer,
      ``,
      `COMPARABLES`,
      doc.comparables,
      ``,
      `WHAT ALREADY EXISTS`,
      doc.what_exists,
      ``,
      `LOGLINE`,
      doc.logline,
      ``,
      `FORMAT`,
      doc.format,
      ``,
      `EPISODE STRUCTURE`,
      doc.episode_structure,
      ``,
      `THEMES`,
      doc.themes,
      ``,
      `CULTURAL MANDATE`,
      doc.cultural_mandate,
      ``,
      `REGIONS — BC`,
      doc.regions_bc,
      ``,
      `REGIONS — ALBERTA`,
      doc.regions_ab,
      ``,
      `PRODUCTION COMPANY`,
      doc.production_company,
      ``,
      `CREATOR / EXECUTIVE PRODUCER`,
      doc.creator_credit,
      ``,
      `TARGET BROADCASTERS`,
      doc.target_broadcasters,
      ``,
      `BUDGET TIER`,
      doc.budget_tier,
      ``,
      `BC FILM COMMISSION NOTES`,
      doc.bc_film_notes,
      ``,
      `ALBERTA FILM COMMISSION NOTES`,
      doc.ab_film_notes,
      ``,
      `PROACTIVE PLANNING — NETWORK / STREAMER PITCH`,
      doc.pp_network_pitch,
      ``,
      `PROACTIVE PLANNING — WHAT CHANGES IF A BUYER COMES IN`,
      doc.pp_what_changes,
      ``,
      `PROACTIVE PLANNING — WHAT WE WOULD DELIVER`,
      doc.pp_delivery,
      ``,
      `PROACTIVE PLANNING — HOW THE SHOOT CHANGES`,
      doc.pp_how_we_shoot,
      ``,
      `PROACTIVE PLANNING — NETFLIX LETTER`,
      doc.pp_netflix_letter,
      ``,
      `STATUS: ${doc.status}`,
      doc.notes ? `\nNOTES\n${doc.notes}` : "",
      ``,
      `EPISODE 1 — ${doc.episode_1_title}`,
      doc.episode_1,
      ``,
      `EPISODE 2 — ${doc.episode_2_title}`,
      doc.episode_2,
    ].join("\n");
  }

  async function copy(mode: "one" | "full") {
    try {
      await navigator.clipboard.writeText(mode === "one" ? buildOneSheet() : buildExport());
      setCopied(mode);
      setTimeout(() => setCopied(""), 2000);
    } catch {}
  }

  if (!loaded) return <div className="text-sm text-muted">Loading...</div>;

  const oneSheet: FieldSpec[] = [
    { label: "What it is, in one line", field: "one_line" },
    { label: "One-sheet logline", field: "one_sheet_logline", multiline: true, rows: 4 },
    { label: "The engine (why there is an episode 2)", field: "engine", multiline: true, rows: 14 },
    { label: "The three chairs — Host, Veteran, Rookie", field: "two_chairs", multiline: true, rows: 16 },
    { label: "The break is the show", field: "ad_break", multiline: true, rows: 9 },
    { label: "Generation A — interactive layer", field: "interactive_layer", multiline: true, rows: 12 },
    { label: "Why not the other formats", field: "formats_rejected", multiline: true, rows: 8 },
    { label: "The anchor advertiser — the primary ask", field: "anchor_advertiser", multiline: true, rows: 20 },
    { label: "Budget, union scale, fee and reserves", field: "business_terms", multiline: true, rows: 22 },
    { label: "The micro version — one ring", field: "micro_version", multiline: true, rows: 10 },
    { label: "Comparables", field: "comparables", multiline: true, rows: 2 },
    { label: "What already exists", field: "what_exists", multiline: true, rows: 8 },
  ];

  const groups: { key: string; title: string; hint: string; fields: FieldSpec[] }[] = [
    {
      key: "one_sheet",
      title: "One sheet",
      hint: "The answer to \"what is it?\" — this is the page you hand a broadcaster, an agent, or a prospective advertiser.",
      fields: oneSheet,
    },
    {
      key: "proactive",
      title: "Proactive planning — if we ever go to a buyer",
      hint: "Not a decision and not an approach. The lay of the land, what they would require, and what it would change.",
      fields: [
        { label: "The network / streamer pitch", field: "pp_network_pitch", multiline: true, rows: 22 },
        { label: "What changes if a buyer comes in", field: "pp_what_changes", multiline: true, rows: 16 },
        { label: "What we would have to deliver", field: "pp_delivery", multiline: true, rows: 20 },
        { label: "How the shoot changes", field: "pp_how_we_shoot", multiline: true, rows: 16 },
        { label: "Netflix — the forwardable letter", field: "pp_netflix_letter", multiline: true, rows: 24 },
      ],
    },
    {
      key: "series",
      title: "Series",
      hint: "Title, logline, format and themes for the full show bible.",
      fields: [
        { label: "Show title", field: "show_title" },
        { label: "Tagline", field: "tagline" },
        { label: "Logline (1-2 sentences)", field: "logline", multiline: true, rows: 3 },
        { label: "Format / series overview", field: "format", multiline: true, rows: 3 },
        { label: "Episode structure (per episode breakdown)", field: "episode_structure", multiline: true, rows: 10 },
        { label: "Themes", field: "themes", multiline: true, rows: 7 },
      ],
    },
    {
      key: "episodes",
      title: "Episodes",
      hint: "Full treatments.",
      fields: [
        { label: "Episode 1 title", field: "episode_1_title" },
        { label: "Episode 1 — full treatment", field: "episode_1", multiline: true, rows: 18 },
        { label: "Episode 2 title", field: "episode_2_title" },
        { label: "Episode 2 — full treatment", field: "episode_2", multiline: true, rows: 18 },
      ],
    },
    {
      key: "commission",
      title: "Commission and production",
      hint: "BC and Alberta Film Commission spine, permit argument, budget and credits.",
      fields: [
        { label: "Cultural mandate statement", field: "cultural_mandate", multiline: true, rows: 5 },
        { label: "Regions — BC", field: "regions_bc", multiline: true, rows: 3 },
        { label: "Regions — Alberta", field: "regions_ab", multiline: true, rows: 3 },
        { label: "Production company", field: "production_company" },
        { label: "Creator / Executive Producer credit", field: "creator_credit" },
        { label: "Target broadcasters / platforms", field: "target_broadcasters", multiline: true, rows: 3 },
        { label: "Budget tier", field: "budget_tier", multiline: true, rows: 3 },
        { label: "BC Film Commission notes (permit argument)", field: "bc_film_notes", multiline: true, rows: 5 },
        { label: "Alberta Film Commission notes", field: "ab_film_notes", multiline: true, rows: 4 },
      ],
    },
    {
      key: "admin",
      title: "Status and notes",
      hint: "Internal only. Never exported to a commission submission.",
      fields: [
        { label: "Status", field: "status" },
        { label: "Internal notes", field: "notes", multiline: true, rows: 4 },
      ],
    },
  ];

  const Buttons = () => (
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={save} disabled={busy} className="btn btn-neon flex items-center gap-1.5">
        {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save</>}
      </button>
      <button onClick={() => copy("one")} className="btn flex items-center gap-1.5">
        {copied === "one" ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy one sheet</>}
      </button>
      <button onClick={() => copy("full")} className="btn flex items-center gap-1.5">
        {copied === "full" ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy full bible</>}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Buttons />
        <span className="text-xs text-muted">
          <FileText size={12} className="inline mr-1" />
          One sheet goes to broadcasters and talent. Full bible goes to BC / Alberta Film Commission.
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map(g => {
          const open = !!openGroups[g.key];
          return (
            <div key={g.key} className="card overflow-hidden">
              <button
                onClick={() => setOpenGroups(p => ({ ...p, [g.key]: !p[g.key] }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition">
                {open ? <ChevronDown size={16} className="shrink-0 text-muted" />
                      : <ChevronRight size={16} className="shrink-0 text-muted" />}
                <div className="min-w-0">
                  <div className="font-black">{g.title}</div>
                  <div className="text-xs text-muted truncate">{g.hint}</div>
                </div>
                <span className="ml-auto text-[11px] pill shrink-0">{g.fields.length}</span>
              </button>
              {open && (
                <div className="grid gap-5 px-5 pb-5 border-t border-edge pt-5">
                  {g.fields.map(s => (
                    <Field key={s.field} label={s.label} field={s.field} doc={doc} set={set}
                      multiline={s.multiline} rows={s.rows} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Buttons />

      <PitchContacts />
    </div>
  );
}
