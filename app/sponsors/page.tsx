import { all } from "@/lib/db";
import { Page, Tag } from "@/components/ui";
import { Money } from "@/components/Currency";
import RoiBoard from "@/components/RoiBoard";
import PromoBanner from "@/components/PromoBanner";
import Link from "next/link";
import {
  Guitar, BedDouble, Truck, UtensilsCrossed, ShoppingBag, Tent, Backpack,
  Star, Globe, Map, MapPin, Building2,
} from "lucide-react";
export const metadata = { title: "Sponsors & Partners", alternates: { canonical: "/sponsors" } };
export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, any> = {
  music_store: Guitar, hotel: BedDouble, vehicle_rental: Truck,
  food_vendor: UtensilsCrossed, retail: ShoppingBag, outfitter: Backpack,
  family_brand: Tent,
};

const TIER_META: Record<string, { label: string; color: string; icon: any; rank: number }> = {
  platform_title:   { label: "Platform Title",    color: "#ff3d6e", icon: Globe,     rank: 0 },
  ring_title:       { label: "Ring Title",         color: "#3df0ff", icon: Star,      rank: 1 },
  corridor_partner: { label: "Corridor Partner",   color: "#3ddc84", icon: Map,       rank: 2 },
  market_partner:   { label: "Market Partner",     color: "#b33dff", icon: MapPin,    rank: 3 },
  local_supporter:  { label: "Local Supporter",    color: "#ffb33d", icon: Building2, rank: 4 },
};

export default function Sponsors() {
  const sponsors = all<any>("SELECT * FROM sponsors ORDER BY (CASE tier WHEN 'platform_title' THEN 0 WHEN 'ring_title' THEN 1 WHEN 'corridor_partner' THEN 2 WHEN 'market_partner' THEN 3 WHEN 'local_supporter' THEN 4 ELSE 5 END), name");
  const perks    = all<any>("SELECT p.*, s.name sponsor FROM perks p JOIN sponsors s ON s.id=p.sponsor_id");
  const coupons  = all<any>(`
    SELECT co.*, c.title campaign_title, c.owner_kind
    FROM coupons co JOIN campaigns c ON c.id=co.campaign_id
    WHERE c.status='live' ORDER BY co.created_at DESC LIMIT 8`);

  const platformTitles  = sponsors.filter((s: any) => s.tier === "platform_title");
  const ringTitles      = sponsors.filter((s: any) => s.tier === "ring_title");
  const rest            = sponsors.filter((s: any) => !["platform_title","ring_title"].includes(s.tier));

  return (
    <Page
      title="Sponsors & Partners"
      sub="We bring the ring, the room and the crowd — you get a branded spot inside it. Every tier is non-competing within its territory. First in, locked in."
    >
      <PromoBanner src="/promo/sponsors.png" alt="Sponsor the route — ROADIE brings the ring to town" />

      {/* Two different products, two different budgets. Most businesses want
          the other one and have never been offered it. */}
      <div className="card p-4 my-4 flex flex-wrap items-center gap-3"
        style={{ borderColor: "#ff3d6e" }}>
        <div className="flex-1 min-w-[260px]">
          <div className="font-black">Want your own ad instead?</div>
          <p className="text-sm text-muted">
            Sponsorship puts your name on our message. Advertising is your message — we
            write it, shoot it, run it, and you keep the files.
          </p>
        </div>
        <Link href="/advertising" className="btn btn-neon px-5 py-2.5">See advertising →</Link>
      </div>

      {/* The tiers below are the big end. This is the small end, and for a
          main-street business it is the one that actually means something. */}
      <div className="card p-5 my-4" style={{ borderColor: "#b33dff" }}>
        <div className="label mb-1" style={{ color: "#b33dff" }}>Back the band from your own town</div>
        <p className="text-sm mb-2">
          You don&apos;t have to take a tier to be part of this. A shop on the main street can
          stand behind a band from the same street — your name travels with them to every
          stop on the ring, and the money goes to the players, not to a placement budget.
        </p>
        <p className="text-sm text-muted">
          Ring night in your town is your town&apos;s night. Being the business that made it
          happen reads differently to a room full of locals than any ad ever will.
        </p>
        <a href="mailto:development@evprod.com?subject=ROADIE — back a local band"
          className="btn btn-neon px-5 py-2.5 mt-3 inline-block">Back a band →</a>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div />
        <Link href="/pitch" className="btn text-sm flex items-center gap-1.5">
          <Star size={13} /> Sponsor deck →
        </Link>
      </div>

      {/* Platform title sponsors — top of the world */}
      {platformTitles.length > 0 && (
        <section className="mb-8">
          <div className="card p-6 mb-3"
            style={{ borderColor: "#ff3d6e66", background: "linear-gradient(180deg,rgba(255,61,110,0.08),transparent 80%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Globe size={18} style={{ color: "#ff3d6e" }} />
              <span className="label" style={{ color: "#ff3d6e" }}>Platform Title — entire network</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {platformTitles.map((s: any) => (
                <SponsorCard key={s.id} s={s} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ring title sponsors */}
      {ringTitles.length > 0 && (
        <section className="mb-8">
          <div className="label mb-2 flex items-center gap-2">
            <Star size={13} style={{ color: "#3df0ff" }} />
            <span style={{ color: "#3df0ff" }}>Ring Title sponsors</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {ringTitles.map((s: any) => <SponsorCard key={s.id} s={s} />)}
          </div>
        </section>
      )}

      {/* All other sponsors */}
      {rest.length > 0 && (
        <section className="mb-8">
          <div className="label mb-2">Corridor, market &amp; local partners</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rest.map((s: any) => <SponsorCard key={s.id} s={s} />)}
          </div>
        </section>
      )}

      {sponsors.length === 0 && (
        <div className="card p-6 text-sm text-muted mb-8">
          No sponsors yet.{" "}
          <Link href="/pitch" className="text-neon hover:underline">See the sponsor deck</Link>{" "}
          to learn about available tiers.
        </div>
      )}

      <h2 className="text-xl font-black mb-3">ROI — ad placements</h2>
      <RoiBoard />

      <h2 className="text-xl font-black mt-8 mb-3">Live coupons &amp; fan offers</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {coupons.length ? coupons.map((c: any) => (
          <div key={c.id} className="card p-4">
            <div className="label">{c.owner_kind} campaign</div>
            <div className="font-bold">{c.title}</div>
            <div className="text-sm text-muted">{c.campaign_title}</div>
            <div className="mt-3 rounded-xl border border-neon/40 bg-black/20 p-3">
              <div className="text-xs text-muted">Code</div>
              <div className="text-2xl font-black text-neon">{c.code}</div>
              <div className="text-sm">{c.offer}</div>
            </div>
          </div>
        )) : (
          <div className="card p-4 text-sm text-muted md:col-span-2">
            No public coupons live yet. Bands, vendors and route sponsors can launch them from the advertiser console.
          </div>
        )}
      </div>

      <h2 className="text-xl font-black mt-8 mb-3">Tour perks bands can claim</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {perks.map((p: any) => (
          <div key={p.id} className="card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.kind.replace("_", " ")} — {p.city}</div>
              <div className="text-xs text-muted">{p.sponsor} · {p.notes}</div>
            </div>
            <Tag>{p.qty - p.qty_claimed} of {p.qty} left</Tag>
          </div>
        ))}
      </div>

      <div className="mt-10 card p-6 text-center space-y-3"
        style={{ borderColor: "rgba(255,61,110,0.25)" }}>
        <div className="text-xl font-black">Want a spot in the ring?</div>
        <p className="text-sm text-muted">Platform Title is available. Every ring title is open. Non-competing categories guaranteed.</p>
        <Link href="/pitch" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
          style={{ background: "#ff3d6e", color: "#0b0b0f" }}>
          See sponsor tiers &amp; pricing →
        </Link>
      </div>
    </Page>
  );
}

function SponsorCard({ s }: { s: any }) {
  const tier = TIER_META[s.tier] || TIER_META.market_partner;
  const Icon = KIND_ICON[s.kind] || Tent;
  const TierIcon = tier.icon;
  return (
    <div className="card p-4" style={{ borderColor: `${tier.color}44` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Icon size={18} style={{ color: tier.color }} />
        <span className="text-[11px] border rounded px-1.5 py-0.5 flex items-center gap-1"
          style={{ borderColor: tier.color, color: tier.color }}>
          <TierIcon size={10} />{tier.label}
        </span>
      </div>
      <div className="font-bold">{s.name}</div>
      <div className="text-sm text-muted">{s.kind?.replace("_", " ")} {s.city ? `· ${s.city}` : ""}</div>
      {s.budget_monthly ? (
        <div className="text-sm mt-1">Budget: <b><Money cad={s.budget_monthly} />/mo</b></div>
      ) : null}
    </div>
  );
}
