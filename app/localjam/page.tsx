import { Page } from "@/components/ui";
import Link from "next/link";
import { Music, QrCode, Users, Volume2 } from "lucide-react";
import { LJ_LOCATIONS } from "@/lib/localjam";
export const metadata = { title: "LocalJams", alternates: { canonical: "/localjam" } };
export const dynamic = "force-dynamic";

// LOCALJAM index — every town on one template, independent data each.
export default function LocalJam() {
  const ca = LJ_LOCATIONS.filter(l => l.country === "CA");
  const us = LJ_LOCATIONS.filter(l => l.country === "US");
  return (
    <Page
      title="LocalJams"
      sub="Hometown scenes on the network — organized jams, artist showcases and the JamPoints world. One template, every town independent: its own venues, vendors and spotlights. Tied to ROADIE so points, profiles and gigs travel with you."
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3"><Volume2 size={18} className="opacity-70" /><h2 className="font-bold">How it all works — 90 seconds</h2></div>
        <audio controls preload="metadata" className="w-full" src="/audio-jampoints-explainer.mp3" />
        <p className="text-muted text-sm mt-2">Pick a song, play a real stage. Scan vendor stickers, stack points. Hit 500 and the Anywhere Card spends at every vendor on the network — any town, any country.</p>
      </section>

      <section className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Music size={20} className="mb-2 opacity-70" /><h3 className="font-bold mb-1">Organized jams</h3><p className="text-muted text-sm">Reserved positions, setlists ahead, strangers become a band on a real stage.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><QrCode size={20} className="mb-2 opacity-70" /><h3 className="font-bold mb-1">JamPoints</h3><p className="text-muted text-sm">Earn at local counters, redeem network-wide — one points ledger with ROADIE&rsquo;s vendor offers.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Users size={20} className="mb-2 opacity-70" /><h3 className="font-bold mb-1">One membership, portable</h3><p className="text-muted text-sm">Profile, gig bag and history stay yours. Migrate into mymymy from your hub any time, free.</p></div>
      </section>

      <TownGrid title="🍁 Canada" locs={ca} />
      <TownGrid title="★ U.S.A." locs={us} />

      <p className="text-muted text-sm mt-6">Want a LocalJams hub in your town? It starts with one organized jam. <Link href="/community" className="underline underline-offset-4">Talk to the community</Link>.</p>
    </Page>
  );
}

function TownGrid({ title, locs }: { title: string; locs: typeof LJ_LOCATIONS }) {
  return (
    <div className="mb-8">
      <div className="label mb-3">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {locs.map(l => (
          <Link key={l.slug} href={`/localjam/${l.slug}`} className="card p-3 flex items-center gap-3 hover:border-neon transition">
            <img src={`/localjams-icons/${l.slug}.png`} alt="" width={40} height={40}
              style={{ borderRadius: 10, border: `1.5px solid ${l.color}`, background: "#0b0b0f", flex: "none" }} />
            <span className="min-w-0">
              <span className="font-semibold text-sm block truncate">{l.city} <span className="text-muted">{l.code}</span></span>
              <span className="text-[11px] text-muted">{l.region}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
