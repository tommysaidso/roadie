import Link from "next/link";
import { one } from "@/lib/db";
import { Money } from "@/components/Currency";
import { CurrencyToggle } from "@/components/Currency";
import {
  Mountain, Radio, Film, Users, DollarSign, Map, Star,
  Tent, TrendingUp, Zap, Globe,
} from "lucide-react";
export const dynamic = "force-dynamic";

const TIERS = [
  {
    key: "platform_title",
    label: "Platform Title",
    cad: 45000,
    period: "/ season",
    color: "#ff3d6e",
    badge: "Presenting",
    scope: "Names every ring across the network — \"The [Brand] ROADIE Circuit\"",
    perks: [
      "Brand in platform name across all rings",
      "Logo on every ring poster, stage backdrop & digital surface",
      "Opening slot intro at every stop",
      "First-look on new ring announcements",
      "Non-competing category lock across the whole network",
    ],
    note: "One sponsor. All rings. Every season.",
  },
  {
    key: "ring_title",
    label: "Ring Title",
    cad: 12000,
    period: "/ ring",
    color: "#3df0ff",
    badge: "Presented by",
    scope: "Names one ring — \"The [Brand] Interior Ring\" or \"[Brand] Kootenay Circuit\"",
    perks: [
      "Brand in ring name (posters, merch, press)",
      "Stage backdrop + announce at every ring stop",
      "Category exclusivity within that ring's territory",
      "First-look on additional stops or extensions",
      "Live ROI dashboard for the ring",
    ],
    note: "Available per ring. Non-competing categories guaranteed.",
  },
  {
    key: "corridor_partner",
    label: "Corridor Partner",
    cad: 5000,
    period: "/ arc",
    color: "#3ddc84",
    badge: "Partner",
    scope: "An arc of 4–8 stops within a ring (e.g. Nelson → Trail → Castlegar → Rossland)",
    perks: [
      "Logo on arc posters and stage signage",
      "Booth or activation spot at each arc stop",
      "Coupon / offer delivered to fans in the arc",
      "ROI report per arc",
    ],
    note: "Great for regional brands with strong corridor presence.",
  },
  {
    key: "market_partner",
    label: "Market Partner",
    cad: 1500,
    period: "/ city",
    color: "#b33dff",
    badge: "Local sponsor",
    scope: "One city — maximum reach in your own market on ring night",
    perks: [
      "Logo on city night poster",
      "Vendor table or activation area",
      "Fan coupon delivered at the gate",
      "Post-event social mention",
    ],
    note: "One brand per category per city. First in, locked in.",
  },
  {
    key: "local_supporter",
    label: "Local Supporter",
    cad: 550,
    period: "/ stop",
    color: "#ffb33d",
    badge: "Supporter",
    scope: "A single stop — put your name on a night in your community",
    perks: [
      "Name on the stop poster",
      "Mention from the stage",
      "Social post from the ROADIE account",
    ],
    note: "Perfect for local businesses, credit unions, and community groups.",
  },
];

const RINGS = [
  { name: "Interior Ring",     stops: "Kelowna → Kamloops → PG", status: "planning" },
  { name: "Fraser Canyon",     stops: "Hope → Yale → Lytton → Cache Creek", status: "planning" },
  { name: "Kootenay Circuit",  stops: "Nelson → Castlegar → Trail → Rossland", status: "planning" },
  { name: "Lower Kootenay",    stops: "Cranbrook → Fernie → Kimberley → Creston", status: "planning" },
  { name: "Alberta Belt",      stops: "Lethbridge → Fort Macleod → Crowsnest Pass → Pincher Creek", status: "planning" },
  { name: "Sea to Sky",        stops: "Squamish → Whistler → Pemberton", status: "planning" },
  { name: "Cariboo Run",       stops: "100 Mile House → Williams Lake → Quesnel", status: "planning" },
  { name: "Yellowhead",        stops: "Smithers → Terrace · Burns Lake · Houston", status: "planning" },
];

export default async function PitchPage() {
  const bands  = one<any>("SELECT COUNT(*) n FROM bands")?.n ?? 0;
  const venues = one<any>("SELECT COUNT(*) n FROM venues")?.n ?? 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-16">

      {/* ---- HERO ---- */}
      <section className="text-center space-y-5 pt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-edge px-4 py-1.5 text-xs text-muted mb-2">
          <Radio size={13} style={{ color: "#ff3d6e" }} /> ROADIE — Canadian touring infrastructure
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-none tracking-tight">
          We bring the ring.<br />
          <span style={{ color: "#ff3d6e" }}>You own the night.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto">
          ROADIE is a homegrown media, music, and advertising machine — a ring-tour circuit
          that plays real towns, makes advertising for the businesses in them, and puts brands
          inside the moment. Not a festival. Not a streaming platform. A live media machine
          that moves.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/advertising" className="px-6 py-3 rounded-full font-bold text-sm transition mr-3"
            style={{ background: "#ff3d6e", color: "#0b0b0f" }}>
            We make your ad →
          </Link>
          <Link href="/sponsors" className="px-6 py-3 rounded-full font-bold text-sm transition"
            style={{ background: "#ff3d6e", color: "#0b0b0f" }}>
            Sponsor a ring →
          </Link>
          <Link href="/planner" className="btn px-6 py-3 text-sm">
            See the rings
          </Link>
        </div>
      </section>

      {/* ---- WHAT IT IS ---- */}
      <section className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: Mountain,
            color: "#ff3d6e",
            title: "Ring tours",
            body: "5–12 stop circuits through BC and Alberta corridors. Each ring hits markets national tours skip — Yale, Lytton, Nelson, Fort Macleod, Smithers. Real rooms, real people.",
          },
          {
            icon: Film,
            color: "#3df0ff",
            title: "Advertising production",
            body: "Every stop is a shoot. We write and shoot commercials for the businesses in each town, run them across the circuit, and hand them every master to keep. Their message, not ours — which is why it comes out of an ad budget instead of a goodwill one.",
          },
          {
            icon: TrendingUp,
            color: "#3ddc84",
            title: "Live ROI",
            body: "Every placement tracked. Impressions, coupon pulls, gate attribution. Advertisers and sponsors see exactly what they spent and what came back — per stop, per ring, per season.",
          },
        ].map(({ icon: Icon, color, title, body }) => (
          <div key={title} className="card p-6 space-y-3">
            <Icon size={28} style={{ color }} />
            <div className="text-xl font-black">{title}</div>
            <p className="text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      {/* ---- THE MODEL ---- */}
      <section className="card p-8 space-y-6"
        style={{ borderColor: "rgba(255,61,110,0.3)", background: "linear-gradient(180deg,rgba(255,61,110,0.05),transparent 80%)" }}>
        <div className="label" style={{ color: "#ff3d6e" }}>The money model</div>
        <h2 className="text-3xl font-black">60 / 25 / 15 — every night.</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { pct: "60%", who: "The band", color: "#ff3d6e", note: "Guaranteed floor — CA$3,000/night minimum, escrowed before departure." },
            { pct: "25%", who: "Host venue", color: "#3df0ff", note: "Door revenue share + in-ring vendor income for the host community." },
            { pct: "15%", who: "ROADIE", color: "#3ddc84", note: "Platform fee. Covers production, routing, media, and sponsor escrow management." },
          ].map(({ pct, who, color, note }) => (
            <div key={who} className="card-h rounded-xl p-5 space-y-1">
              <div className="text-5xl font-black" style={{ color }}>{pct}</div>
              <div className="font-bold">{who}</div>
              <p className="text-xs text-muted">{note}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Escrow covers the band guarantee floor — it is funded before the first stop departs.
          Door above the floor goes to the 60/25 split. Every number is tracked live.
        </p>
      </section>

      {/* ---- WHERE THE MONEY COMES FROM ---- */}
      <section className="card p-8 space-y-5"
        style={{ borderColor: "rgba(61,240,255,0.3)", background: "linear-gradient(180deg,rgba(61,240,255,0.05),transparent 80%)" }}>
        <div className="label" style={{ color: "#3df0ff" }}>Where the money comes from</div>
        <h2 className="text-3xl font-black">We sell advertising. We don&apos;t pass a hat.</h2>
        <p className="text-sm text-muted max-w-3xl">
          A sponsor buys a name, so eight towns is not eight times better than one and every
          extra market is cost without return — sponsorship gets <b>harder</b> to say yes to
          the bigger it gets. An advertiser buys customers, and they already hold a per-market
          budget, so it gets <b>easier</b>. That is the whole revenue thesis.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card-h rounded-xl p-5 space-y-2">
            <div className="font-black text-lg" style={{ color: "#3df0ff" }}>Advertising scales up</div>
            <p className="text-sm text-muted">
              We are already going to every stop — same crew, same shoot, same masters — so our
              marginal cost per market is near zero. Ring-wide therefore prices <b>below</b> per-town.
              A station&apos;s cost rises with every market, so their price can only rise too. This is
              the one thing they structurally cannot match.
            </p>
          </div>
          <div className="card-h rounded-xl p-5 space-y-2">
            <div className="font-black text-lg" style={{ color: "#b33dff" }}>Sponsorship scales down</div>
            <p className="text-sm text-muted">
              Freed from carrying the revenue, sponsorship becomes what it is actually good at:
              a shop on the main street backing a band from the same street. Small money, easy
              yes, and it means something to a room full of locals in a way a regional logo never does.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted">
          The advertiser pays for the ring to exist. The local sponsor backs the band that plays it.
          Neither is asked to be the other, which is why both get easier to sell.
        </p>
      </section>

      {/* ---- SPONSOR TIERS ---- */}
      <section className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="label">Sponsor tiers</div>
            <h2 className="text-3xl font-black">From one stop to the whole network.</h2>
          </div>
          <CurrencyToggle />
        </div>
        <p className="text-muted text-sm max-w-2xl">
          Every tier is non-competing within its territory — once a category is taken, it's locked.
          Tiers stack: a Platform Title sponsor doesn't block Ring Title sponsors in complementary categories.
        </p>
        <div className="space-y-4">
          {TIERS.map((tier) => (
            <div key={tier.key} className="card p-6 space-y-4"
              style={{ borderColor: `${tier.color}44` }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold rounded px-2 py-0.5 border"
                      style={{ borderColor: tier.color, color: tier.color }}>
                      {tier.badge}
                    </span>
                    <span className="text-xl font-black">{tier.label}</span>
                  </div>
                  <p className="text-sm text-muted">{tier.scope}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black" style={{ color: tier.color }}>
                    <Money cad={tier.cad} />
                  </div>
                  <div className="text-xs text-muted">{tier.period} · CAD</div>
                </div>
              </div>
              <ul className="grid sm:grid-cols-2 gap-1.5">
                {tier.perks.map((p) => (
                  <li key={p} className="text-sm flex items-start gap-2">
                    <span style={{ color: tier.color }} className="mt-0.5 shrink-0">✓</span>
                    <span className="text-muted">{p}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-muted italic border-t border-edge pt-3">{tier.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- THE RINGS ---- */}
      <section className="space-y-5">
        <div className="label">The rings</div>
        <h2 className="text-3xl font-black">8 corridors. 2 provinces. Audiences no one else reaches.</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {RINGS.map((r) => (
            <div key={r.name} className="card p-4 flex items-start gap-3">
              <Map size={16} className="text-neon mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">{r.name}</div>
                <div className="text-xs text-muted">{r.stops}</div>
              </div>
              <span className="ml-auto text-[11px] pill shrink-0">{r.status}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="card-h rounded-xl p-4 text-center">
            <div className="text-3xl font-black" style={{ color: "#ff3d6e" }}>{venues.toLocaleString()}</div>
            <div className="text-xs text-muted mt-1">Rooms in the network</div>
          </div>
          <div className="card-h rounded-xl p-4 text-center">
            <div className="text-3xl font-black" style={{ color: "#3df0ff" }}>{bands.toLocaleString()}</div>
            <div className="text-xs text-muted mt-1">Bands registered</div>
          </div>
          <div className="card-h rounded-xl p-4 text-center">
            <div className="text-3xl font-black" style={{ color: "#3ddc84" }}>2</div>
            <div className="text-xs text-muted mt-1">Provinces · BC + AB</div>
          </div>
        </div>
      </section>

      {/* ---- WHY IT WORKS ---- */}
      <section className="space-y-5">
        <div className="label">Why it works</div>
        <h2 className="text-3xl font-black">The corridor has always been there. Nobody built for it.</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              icon: Globe,
              title: "Underserved markets",
              body: "Smithers, Lytton, Fort Macleod, Nakusp — every town has a Legion, a community hall, or an arena. National tours skip them. ROADIE doesn't.",
            },
            {
              icon: Zap,
              title: "Captive, local audience",
              body: "This isn't a streaming metric. It's 100–400 people in a room, in your market, hearing your brand announced from the stage. That's a different kind of impression.",
            },
            {
              icon: Film,
              title: "Content that lives after the night",
              body: "Concert video, social cuts, sponsor recall. Every ring generates a season's worth of content. Your placement is in it — not beside it.",
            },
            {
              icon: Users,
              title: "Community-first economics",
              body: "The 25% host share stays in the town. Vendor spots go to local businesses first. ROADIE doesn't extract — it activates.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5 flex gap-4">
              <Icon size={20} className="text-neon shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-1">{title}</div>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- OPERATOR ---- */}
      <section className="card p-6 space-y-3" style={{ borderColor: "rgba(61,240,255,0.25)" }}>
        <div className="label" style={{ color: "#3df0ff" }}>The operator</div>
        <div className="font-black text-xl">UARX MIXEDREALITY CORP.</div>
        <p className="text-sm text-muted">
          Canadian federal corporation #1695020-5, based in South Hazelton, BC. Operator of record
          for ring production and sponsor escrow. Production entity for concert video and media output.
        </p>
        <p className="text-sm text-muted">
          Built by EV Productions — the team behind mymymy.studio. Every ring runs on the same
          platform: booking, band matching, sponsor tracking, live ROI.
        </p>
      </section>

      {/* ---- CTA ---- */}
      <section className="text-center space-y-5 pb-12">
        <h2 className="text-4xl font-black">Lock your territory before someone else does.</h2>
        <p className="text-muted max-w-lg mx-auto">
          Non-competing categories. First in, locked in. One sponsor per tier per territory.
          The Interior Ring title is available now.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="mailto:development@evprod.com?subject=ROADIE Sponsor Inquiry"
            className="px-8 py-4 rounded-full font-black text-base transition"
            style={{ background: "#ff3d6e", color: "#0b0b0f" }}>
            Book a sponsor call →
          </a>
          <Link href="/sponsors" className="btn px-8 py-4 text-base">
            See live ROI board
          </Link>
        </div>
        <div className="text-xs text-muted">development@evprod.com · UARX MIXEDREALITY CORP · South Hazelton BC</div>
      </section>

    </div>
  );
}
