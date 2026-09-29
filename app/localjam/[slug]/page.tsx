import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Music, Ticket, Star, Users, Guitar, ArrowLeft } from "lucide-react";
import { findLoc, locData } from "@/lib/localjam";
import { listForCity } from "@/lib/backline";
export const dynamic = "force-dynamic";

// ONE template, filled from each town's own data. No SoCal copy leaks in —
// the words and every card come from this location's rows.
export default async function LocalJamTown({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loc = findLoc(slug);
  if (!loc) notFound();
  const d = locData(loc);
  const backline = listForCity(loc.city);
  const A = loc.color;
  const label = `LocalJams / ${loc.city} ${loc.code}`;

  return (
    <div className="min-w-0">
      {/* ---- HERO ---- */}
      <section className="relative overflow-hidden" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${A}22, transparent 60%)` }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-12 flex items-center gap-5 flex-wrap">
          <img src={`/localjams-icons/${loc.slug}.png`} alt="" width={104} height={104}
            style={{ borderRadius: 18, border: `2px solid ${A}`, background: "#0b0b0f" }} />
          <div className="min-w-0">
            <div className="text-xs font-mono tracking-widest" style={{ color: A }}>{loc.country === "CA" ? "CANADA" : "U.S.A."} · {loc.region}</div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none mt-1">
              Local<span style={{ color: A }}>Jams</span> <span className="text-muted font-bold text-2xl md:text-3xl">/ {loc.city} {loc.code}</span>
            </h1>
            <p className="text-muted mt-3 max-w-xl">
              The {loc.region} live-music community — organized jams, open mics, artist showcases and local
              events, tied into the LocalJams &amp; ROADIE network so your points, profile and gigs travel.
            </p>
            <div className="mt-4">
              {d.nextJam
                ? <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: A, color: "#0b0b0f" }}><Ticket size={15} />Next jam — {d.nextJam.date} · {d.nextJam.venue}</span>
                : <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border border-edge text-muted"><Ticket size={15} />First jam forming — <Link href="/community" className="underline underline-offset-2">get it started</Link></span>}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-10">

        {/* ---- VENUES ---- */}
        <section>
          <div className="flex items-center gap-2 mb-3"><Music size={18} style={{ color: A }} /><h2 className="text-xl font-black">Rooms in {loc.city}</h2><span className="text-xs text-muted">{d.venues.length}</span></div>
          {d.venues.length === 0
            ? <div className="card p-5 text-sm text-muted">No rooms mapped here yet. <Link href="/venues" className="underline">Claim or add a venue</Link> and it shows up here.</div>
            : <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {d.venues.map((v: any) => (
                  <div key={v.id} className="card p-4">
                    <div className="font-bold flex items-center gap-2">
                      <span className="truncate">{v.name}</span>
                      {(!v.user_id || v.member_status === "sample") && <span className="text-[9px] font-mono uppercase tracking-wide px-1 py-0.5 rounded shrink-0" style={{ border: "1px solid #ffb33d", color: "#ffb33d" }}>sample</span>}
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin size={11} />{v.city}</span>
                      {v.capacity ? <span className="flex items-center gap-1"><Users size={11} />cap {v.capacity}</span> : null}
                    </div>
                    {v.genres ? <div className="text-[11px] text-muted mt-1 truncate">{String(v.genres).replace(/,/g, " · ")}</div> : null}
                  </div>
                ))}
              </div>}
        </section>

        {/* ---- JAMPOINTS VENDORS ---- */}
        <section>
          <div className="flex items-center gap-2 mb-3"><Ticket size={18} style={{ color: A }} /><h2 className="text-xl font-black">JamPoints — local discounts</h2></div>
          {d.vendors.length === 0
            ? <div className="card p-5 text-sm text-muted">No local businesses signed up yet. It&rsquo;s free — they set a discount, the community earns points across the network.</div>
            : <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {d.vendors.map((v: any, i: number) => (
                  <div key={i} className="card p-4">
                    <div className="font-bold truncate">{v.business_name}</div>
                    <div className="text-sm mt-1" style={{ color: A }}>{v.kind === "percent" ? `${v.value}% off` : v.title}</div>
                    {v.terms ? <div className="text-[11px] text-muted mt-1 line-clamp-2">{v.terms}</div> : null}
                  </div>
                ))}
              </div>}
        </section>

        {/* ---- SPONSORED BACKLINE ---- */}
        <section>
          <div className="flex items-center gap-2 mb-3"><Guitar size={18} style={{ color: A }} /><h2 className="text-xl font-black">Sponsored backline</h2><span className="text-xs text-muted">what&rsquo;s on the stage · tap to buy</span></div>
          {backline.length === 0
            ? <div className="card p-5 text-sm text-muted">No sponsored gear listed yet.</div>
            : <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {backline.map((b: any) => (
                  <a key={b.id} href={b.buy_url || `/backline/${b.venue_id}`} target="_blank" rel="noreferrer" className="card p-4 hover:border-neon transition">
                    <div className="font-bold truncate">{b.item}</div>
                    <div className="text-[11px] text-muted mt-1">{[b.brand, b.venue_name].filter(Boolean).join(" · ")}{b.sponsor_name ? ` · via ${b.sponsor_name}` : ""}</div>
                    {b.buy_url ? <div className="text-xs mt-1" style={{ color: A }}>tap to buy &rarr;</div> : null}
                  </a>
                ))}
              </div>}
        </section>

        {/* ---- ARTIST SPOTLIGHT: local + national ---- */}
        <section>
          <div className="flex items-center gap-2 mb-3"><Star size={18} style={{ color: A }} /><h2 className="text-xl font-black">Artist spotlight</h2></div>
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <div className="label mb-2">Local — {loc.city}</div>
              {d.local.length === 0
                ? <div className="card p-4 text-sm text-muted">Local artists forming. <Link href="/garage" className="underline">Add your band</Link>.</div>
                : <div className="space-y-2">{d.local.map((b: any) => <BandRow key={b.id} b={b} A={A} />)}</div>}
            </div>
            <div>
              <div className="label mb-2">National — touring the network</div>
              {d.national.length === 0
                ? <div className="card p-4 text-sm text-muted">No touring acts featured right now.</div>
                : <div className="space-y-2">{d.national.map((b: any) => <BandRow key={b.id} b={b} A={A} />)}</div>}
            </div>
          </div>
          <p className="text-xs text-muted mt-3">Band info connects to <b>ROADIE</b> — <Link href="/discover" className="underline underline-offset-2">find every band on the network →</Link></p>
        </section>

        {/* ---- FOOTER ---- */}
        <section className="border-t border-edge pt-5 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/localjam" className="inline-flex items-center gap-1 text-muted hover:text-white"><ArrowLeft size={14} />All LocalJams towns</Link>
          <span className="text-muted">·</span>
          <a href="https://localjams.org" className="text-muted hover:text-white">← main LocalJams</a>
          <span className="ml-auto text-[11px] text-muted">Independent {loc.city} hub · same template, own venues, vendors &amp; spotlights · part of the LocalJams + ROADIE network.</span>
        </section>
      </div>
    </div>
  );
}

function BandRow({ b, A }: { b: any; A: string }) {
  return (
    <Link href="/discover" className="card p-3 flex items-center gap-3 hover:border-neon transition">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${A}22`, color: A }}><Guitar size={16} /></span>
      <span className="min-w-0">
        <span className="font-semibold block truncate">{b.name}</span>
        <span className="text-[11px] text-muted">{[b.genre, b.home_city].filter(Boolean).join(" · ")}{b.touring ? " · touring" : ""}</span>
      </span>
    </Link>
  );
}
