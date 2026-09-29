import { Page } from "@/components/ui";
import Link from "next/link";
import { AD_PRODUCTS, AD_PITCH_LINE, AD_VS_SPONSOR, RING_SPINE, LOCAL_SPONSOR } from "@/lib/advertising";
import { Video, Clapperboard, Radio, Layers, Check, ArrowRight, Heart } from "lucide-react";
import { RoadieVendorTour, WalkMeThrough } from "@/components/RoadieTour";

export const dynamic = "force-dynamic";

const ICON: Record<string, any> = {
  spot: Video, cutdowns: Layers, onthering: Clapperboard, voice: Radio,
};

// The advertising page.
//
// This exists because every sponsor conversation so far has been the wrong
// conversation. A business owner hears "sponsor" and thinks charity; he hears
// "we'll make your ad and run it" and reaches for a budget he already has.
// Same crew, same cameras, same rooms — different product, different pocket.

export default function Advertising() {
  return (
    <Page
      title="Advertising"
      sub={AD_PITCH_LINE}
    >
      {/* The distinction, said plainly and early. This is the whole page in
          one block — everything below is detail. */}
      <div data-tour="ad-vs-sponsor" className="grid md:grid-cols-2 gap-3 mb-8">
        {[AD_VS_SPONSOR.advertising, AD_VS_SPONSOR.sponsorship].map((b, i) => (
          <div key={b.title}
            className="rounded-2xl p-5 border"
            style={{
              borderColor: i === 0 ? "#ff3d6e" : "#2a2a3a",
              background: i === 0 ? "rgba(255,61,110,0.06)" : "rgba(255,255,255,0.02)",
            }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-black">{b.title}</span>
              <span className="pill text-[10px]">{b.whose}</span>
            </div>
            <p className="text-sm mb-2">{b.line}</p>
            <p className="text-xs text-muted">{b.budget}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted mb-8 max-w-3xl">
        Both are on the table and they are not the same thing. Most businesses we talk to
        want the first one and get offered the second, which is why the answer is usually
        no. If you have an ad budget, this page is the one you want.
      </p>

      {/* The spine. This is the argument that actually closes a ring, and it
          is structural rather than persuasive — which is why it survives a
          room full of people looking for the catch. */}
      <h2 className="text-xl font-black mb-1">Why take a whole ring</h2>
      <p className="text-sm text-muted mb-4 max-w-3xl">
        Sponsorship gets harder to say yes to the bigger it gets. Advertising gets easier.
        That is not a sales line — it falls out of what each one actually buys.
      </p>

      <div data-tour="ring-spine" className="grid md:grid-cols-2 gap-3 mb-6">
        {RING_SPINE.map(x => (
          <div key={x.q} className="card p-4">
            <div className="flex items-start gap-2">
              <ArrowRight size={16} className="mt-0.5 shrink-0" style={{ color: "#ff3d6e" }} />
              <div>
                <div className="font-bold text-sm mb-1">{x.q}</div>
                <p className="text-xs text-muted">{x.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-10" style={{ borderColor: "#3ddc84" }}>
        <div className="label mb-1" style={{ color: "#3ddc84" }}>The part a station can&apos;t match</div>
        <p className="text-sm">
          Their cost goes up with every market, so their price per town can only go up too.
          Ours barely moves — the ring is already going there, the crew is already in the van,
          the masters are already cut. So <b>the whole ring costs less per town than one town
          does</b>, which makes taking all of it the obvious call rather than the upsell.
        </p>
      </div>

      <h2 className="text-xl font-black mb-1">And it frees sponsorship to be local</h2>
      <p className="text-sm text-muted mb-4 max-w-3xl">
        {LOCAL_SPONSOR.line}
      </p>
      <div data-tour="local-sponsor" className="grid md:grid-cols-2 gap-3 mb-4">
        {LOCAL_SPONSOR.points.map(x => (
          <div key={x.t} className="card p-4">
            <div className="flex items-start gap-2">
              <Heart size={16} className="mt-0.5 shrink-0" style={{ color: "#b33dff" }} />
              <div>
                <div className="font-bold text-sm mb-1">{x.t}</div>
                <p className="text-xs text-muted">{x.b}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted mb-10 max-w-3xl">
        The advertiser pays for the ring to exist. The local sponsor backs the band that
        plays it. Neither one is asked to be the other — which is why both get easier to
        sell.{" "}
        <Link href="/sponsors" className="text-neon hover:underline">Back a band →</Link>
      </p>

      <h2 className="text-xl font-black mb-1">What we make</h2>
      <p className="text-sm text-muted mb-4 max-w-3xl">
        We are a production company that happens to run a touring circuit. The crew, the
        cameras and the rooms are already booked and already paid for — which is why your
        spot costs what it does instead of what an agency would charge to do it from cold.
      </p>

      <div data-tour="ad-products" className="grid md:grid-cols-2 gap-3">
        {AD_PRODUCTS.map(p => {
          const Icon = ICON[p.key] || Video;
          return (
            <div key={p.key} className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} style={{ color: p.color }} />
                <span className="text-lg font-black">{p.label}</span>
              </div>
              <p className="text-sm mb-3">{p.what}</p>
              <dl className="flex flex-col gap-2 text-xs">
                {[["We shoot it", p.shoot], ["It runs", p.runs], ["You keep", p.keeps]].map(([k, v]) => (
                  <div key={k}>
                    <dt className="label text-[10px]">{k}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[11px] mt-3 pt-3 border-t border-[#2a2a3a]" style={{ color: p.color }}>
                {p.best}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="text-xl font-black mt-10 mb-3">Why us and not the local station</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          {
            t: "The shoot is included",
            b: "A station sells you airtime and hands you a rate card. We turn up with a crew and make the thing, then run it. The ad is the product, not the afterthought.",
          },
          {
            t: "You own the files",
            b: "Everything we shoot for you is yours to keep and run anywhere — your site, your socials, another station, forever. No usage window, no re-licensing.",
          },
          {
            t: "Your customers are in the room",
            b: "Ring nights fill a room in your own town with people who live there. Your spot plays where they already are, and it can be shot with them in frame.",
          },
        ].map(x => (
          <div key={x.t} className="card p-4">
            <div className="flex items-start gap-2">
              <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#3ddc84" }} />
              <div>
                <div className="font-bold text-sm mb-1">{x.t}</div>
                <p className="text-xs text-muted">{x.b}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rates deliberately absent — Ben sets them and words them. An invented
          number here becomes the number a client quotes back at him. */}
      <div className="card p-5 mt-10">
        <div className="label mb-1">What it costs</div>
        <p className="text-sm text-muted">
          Rates depend on the shoot, the markets and how long it runs, so we quote it rather
          than list it. Tell us what you sell and where your customers are and you&apos;ll get a
          number back — not a proposal deck.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <a href="mailto:development@evprod.com?subject=ROADIE — advertising"
            className="btn btn-neon px-6 py-3">Get a quote →</a>
          <Link href="/sponsors" className="btn px-6 py-3">
            Looking to sponsor instead? →
          </Link>
        </div>
      </div>
      <RoadieVendorTour />
      <WalkMeThrough label="? what am I buying" />
    </Page>
  );
}
