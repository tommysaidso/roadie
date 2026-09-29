import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { all, one } from "@/lib/db";
import { Tag } from "@/components/ui";
import { Money } from "@/components/Currency";
import RoadieHero from "@/components/RoadieHero";
import { RoadieArtistTour } from "@/components/RoadieTour";
import HubMap from "@/components/HubMap";
import LocationQuickStart from "@/components/LocationQuickStart";
import TermsAck from "@/components/TermsAck";
import EpisodePlayer from "@/components/EpisodePlayer";
import BusinessDoor from "@/components/BusinessDoor";
import { cookies } from "next/headers";
import { ensureAuthSchema, userForToken, SESSION_COOKIE } from "@/lib/auth";
import { getHub, hubLoop } from "@/lib/hubs";
import {
  Wrench, Building2, ClipboardList, Map, BadgeDollarSign, Video, Bot, Music,
  Mic, MapPin, Users, Sparkles, Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ASK_CHIPS = [
  { q: "Find me a US producer",                   icon: Mic },
  { q: "I need a gig in Kelowna this week",       icon: MapPin },
  { q: "Plot a runout Vernon → Kamloops → PG",    icon: Map },
  { q: "Who else makes music videos?",            icon: Sparkles },
];

export default async function Hub(){
  ensureAuthSchema();
  const c = await cookies();

  // RoadieTV Episode 1 — shown to every visitor before they pick a role
  let ep01: any = null;
  try {
    ep01 = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "roadietv", "ep01", "manifest.json"), "utf8")
    );
  } catch { /* not rendered yet — section is hidden */ }
  const me = userForToken(c.get(SESSION_COOKIE)?.value);
  const hub = getHub(c.get("roadie_hub")?.value);
  const loop = hubLoop(hub);

  // Counts for the entrance row
  const bands     = one<any>("SELECT COUNT(*) n FROM bands")?.n ?? 0;
  const venues    = one<any>("SELECT COUNT(*) n FROM venues")?.n ?? 0;
  const openSlots = one<any>("SELECT COUNT(*) n FROM venue_slots WHERE status='open'")?.n ?? 0;
  const adRev     = one<any>("SELECT SUM(cost) c FROM ad_placements")?.c ?? 0;

  // Map data
  const mapVenues = all<any>("SELECT id,name,city,lat,lng,capacity,genres FROM venues");
  const mapBands  = all<any>("SELECT id,name,home_city,genre,lat,lng FROM bands");
  const gkey      = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Lower bands
  const touring = all<any>("SELECT name,home_city,genre FROM bands WHERE touring=1");
  const notices = all<any>("SELECT * FROM notices ORDER BY created_at DESC LIMIT 4");

  // Tiles row (under the map) — leaves out duplicates of left-nav items the
  // entrance row already surfaces.
  const tiles = [
    { href:"/garage",    t:"Garage / Studio", d:"Your road kit — profile, AI bio, catalog & promo.",          icon:Wrench },
    { href:"/board",     t:"Notice Board",    d:"Touring, gig gaps, runouts, openers wanted.",                icon:ClipboardList },
    { href:"/advertising", t:"Advertising",  d:"We make your ad and run it — your message, your files.",     icon:Video },
    { href:"/sponsors",  t:"Sponsors / ROI",  d:"Vendors in the tent, route sponsors, hotels, vans — live ROI.", icon:BadgeDollarSign },
    { href:"/community", t:"Community",       d:"#needproducer, #needgig — pros, bands & fans wired up.",     icon:Users },
    { href:"/sessions",  t:"Floor Sessions",  d:"House shows, after-hours, listening rooms.",                 icon:Music },
    { href:"/calendar",  t:"Calendar",        d:"What's on, who's free, what's bookable.",                   icon:Calendar },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* An express lane for anyone who came here to spend money. Dismissible,
          and it stays dismissed for the bands who live on this page. */}
      <BusinessDoor />

      {/* ====================== ROADIETV EP. 01 ======================
          Plays for every visitor — fan, band, venue, sponsor, pro.
          Tells the whole story so they know which role fits them
          before they hit the signup wizard. Hidden if not rendered. */}
      {ep01 && (
        <section className="space-y-3">
          <div>
            <div className="label" style={{ color: "#ff3d6e" }}>ROADIETV &mdash; EP. 01</div>
            <h2 className="text-xl font-bold mt-0.5">We Bring the Ring</h2>
            <p className="text-sm text-muted mt-1">
              New here? Watch this first &mdash; it covers what Roadie is and who it&rsquo;s for.
              Press play, then cut in any time with a question. It picks up where it left off.
            </p>
          </div>
          <EpisodePlayer manifest={ep01} base="/roadietv/ep01" />
        </section>
      )}

      <RoadieArtistTour />
      <div data-tour="ask"><RoadieHero user={me ? { display_name: me.display_name } : null}/></div>
      {/* Shows only for bands/artists who have not acknowledged the
          current terms. Renders nothing for everyone else. */}
      <TermsAck />
      <LocationQuickStart />

      {/* ====================== ENTRANCE ROW ======================
          AI strip on top + four stat tiles directly under it.
          Each stat tile is a link straight to its page (left nav
          already lists them too — no inline expansion needed). */}

      <section
        className="card p-5"
        style={{ borderColor: "rgba(255,61,110,0.45)", background: "linear-gradient(180deg, rgba(255,61,110,0.06), transparent 70%)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-8 w-8 items-center justify-center">
              <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full" style={{ background: "rgba(255,61,110,0.35)" }} />
              <Bot size={22} style={{ color: "#ff3d6e" }} />
            </span>
            <div>
              <div className="label" style={{ color: "#ff3d6e" }}>ASK ROADIE</div>
              <div className="text-base md:text-lg font-medium">
                AI tour manager — slots, routing, contracts, perks. <span className="text-muted">No sign-in needed.</span>
              </div>
            </div>
          </div>
          <Link
            href="/roadie"
            className="px-4 py-2 rounded-full text-sm font-semibold transition shrink-0"
            style={{ background: "#ff3d6e", color: "#0b0b0f" }}
          >
            Open assistant →
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ASK_CHIPS.map(({ q, icon: Icon }) => (
            <Link
              key={q}
              href={`/roadie?ask=${encodeURIComponent(q)}`}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs hover:bg-white/5"
              style={{ borderColor: "rgba(255,61,110,0.35)" }}
            >
              <Icon size={12} style={{ color: "#ff3d6e" }} />
              {q}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile href="/garage"   label="Bands on ROADIE"        value={bands}             hint={hub.tagline} />
        <StatTile href="/venues"   label="Venues"                 value={venues}            hint={`${hub.name} loop`} />
        <StatTile href="/board"    label="Open slots"             value={openSlots}         hint="ready for smart-placement" />
        <StatTile href="/sponsors" label="Sponsor spend tracked"  value={<Money cad={adRev}/>} hint="with live ROI" />
      </div>

      {/* ====================== TOUR MAP ======================
          Big embedded map with a Start-from switcher. Pins are
          live venues + bands. Click "Full map →" for the
          standalone /map view. */}
      <div data-tour="map">
      <HubMap
        venues={mapVenues}
        bands={mapBands}
        defaultLoop={loop}
        center={{ lat: hub.center_lat, lng: hub.center_lng }}
        zoom={hub.default_zoom}
        box={{ minLng: hub.bbox_min_lng, maxLng: hub.bbox_max_lng, minLat: hub.bbox_min_lat, maxLat: hub.bbox_max_lat }}
        googleKey={gkey}
      />
      </div>

      {/* ====================== TILES (existing) ======================
          Quick links into the deeper modules. Two rows of three on
          desktop, one column on mobile. */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3" data-tour="tiles">
        {tiles.map(({ href, t, d, icon: Icon }) => (
          <Link key={href} href={href} className="card p-5 hover:border-neon transition group">
            <Icon className="text-neon mb-3" size={22} />
            <div className="font-bold text-lg group-hover:text-white">{t}</div>
            <div className="text-sm text-muted mt-1">{d}</div>
          </Link>
        ))}
      </div>

      {/* ====================== ACTIVITY ROW ====================== */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="label mb-3">Actively touring</div>
          {touring.length === 0 && <div className="text-sm text-muted">Nobody on the road right now.</div>}
          {touring.map((b: any) => (
            <div key={b.name} className="flex items-center justify-between py-2 border-b border-edge last:border-0">
              <div className="flex items-center gap-2">
                <Music size={15} className="text-cyan" />
                <span className="font-medium">{b.name}</span>
              </div>
              <div className="text-sm text-muted">{b.genre} · {b.home_city}</div>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <div className="label mb-3">Latest on the board</div>
          {notices.length === 0 && <div className="text-sm text-muted">No new notices.</div>}
          {notices.map((n: any) => (
            <Link key={n.id} href="/board" className="block py-2 border-b border-edge last:border-0">
              <div className="flex items-center gap-2"><Tag>{n.kind}</Tag><span className="font-medium">{n.title}</span></div>
              <div className="text-sm text-muted">{n.city} · {n.genre}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card p-5" style={{ borderColor: "rgba(61,240,255,.25)" }}>
        <div className="label mb-1">Connected systems</div>
        <p className="text-sm text-muted">
          Catalog, ISWC/CWR registration, AI variants and royalties live in{" "}
          <span className="text-cyan font-medium">mymymy</span>. ROADIE pulls each band's works for their public
          profile &amp; promo, and stays the front-of-house: community, booking, touring, sponsorship.
        </p>
      </div>
    </div>
  );
}

/* ----------------------- helpers ----------------------- */

function StatTile({ href, label, value, hint }: {
  href: string; label: string; value: React.ReactNode; hint?: string;
}) {
  return (
    <Link href={href} className="card p-4 hover:border-neon transition group block">
      <div className="label">{label}</div>
      <div className="text-3xl font-bold leading-tight mt-1 group-hover:text-white">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </Link>
  );
}
