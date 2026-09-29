"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, Plus, ShieldCheck } from "lucide-react";

// The claim funnel for rooms.
//
// Every venue on the platform was scraped in as an unclaimed "sample" listing,
// and there was no way for the real operator to take one over: bands had
// BandFinder, venues had nothing. The only route to your own room was scrolling
// a page that renders all 919 of them, so the claim rate sat at exactly 0. The
// signup wizard made it worse by always INSERTing a new venue, handing a real
// operator a duplicate while their seeded listing stayed unclaimed forever.
//
// Search first, claim what's already there, and only create when nothing matches.
export default function VenueFinder() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [me, setMe] = useState<any>(undefined);        // undefined = still loading
  const [open, setOpen] = useState<number | null>(null);
  const [owner, setOwner] = useState("");
  const [license, setLicense] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null)
      .then(d => setMe(d?.user || null)).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setHits([]); return; }
      setBusy(true);
      try {
        const r = await fetch(`/api/venues?q=${encodeURIComponent(term)}&limit=8`);
        const d = await r.json();
        setHits((Array.isArray(d) ? d : d.venues || []).slice(0, 8));
      } catch { setHits([]); }
      finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function claim(id: number) {
    if (me === undefined) return;                      // don't bounce mid-lookup
    if (!me) { window.location.href = "/signin"; return; }
    setClaiming(true); setMsg("");
    try {
      const r = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "venue", recordId: id,
          legal_owner: owner.trim() || undefined,
          business_license: license.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error || "Couldn't claim that room — it may already be taken."); return; }
      window.location.reload();
    } catch { setMsg("Couldn't claim that room right now."); }
    finally { setClaiming(false); }
  }

  return (
    <div className="card p-5 mb-6">
      <div className="text-lg font-black">Is your room already listed?</div>
      <p className="text-sm text-muted mt-1">
        We&rsquo;ve mapped rooms across the loop. Find yours and claim it — the listing becomes
        yours to run, and claiming starts your free 3-month trial of the full tools.
        {me === null && <> You&rsquo;ll <a href="/signin" className="text-cyan hover:underline">sign in</a> to claim.</>}
      </p>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 flex items-center gap-2 bg-ink border border-edge rounded-lg px-3">
          <Search size={15} className="text-muted shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Your venue name or town…"
            className="flex-1 bg-transparent border-0 outline-none py-2 text-sm" />
          {busy && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
        <a href="/setup" className="btn btn-neon text-sm flex items-center gap-1 shrink-0">
          <Plus size={14} />New
        </a>
      </div>

      {hits.length > 0 && (
        <div className="mt-3 space-y-1">
          {hits.map((v: any) => (
            <div key={v.id} className="py-2 border-b border-edge last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted truncate">
                    {v.city}{v.capacity ? ` · cap ${v.capacity}` : ""}
                  </div>
                </div>
                {v.user_id
                  ? <span className="pill text-[11px] shrink-0">claimed</span>
                  : <button onClick={() => { setOpen(open === v.id ? null : v.id); setMsg(""); }}
                      className="btn text-xs shrink-0">that&rsquo;s us</button>}
              </div>

              {open === v.id && !v.user_id && (
                <div className="mt-2 space-y-2 bg-ink/60 border border-edge rounded-lg p-3">
                  <div className="text-[11px] text-muted flex items-center gap-1">
                    <ShieldCheck size={12} className="text-neon" />
                    Optional — adding both marks the claim verified-pending for partners.
                  </div>
                  <input value={owner} onChange={e => setOwner(e.target.value)}
                    placeholder="legal owner / operator name"
                    className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
                  <input value={license} onChange={e => setLicense(e.target.value)}
                    placeholder="business licence number"
                    className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
                  <div className="flex gap-2">
                    <button onClick={() => claim(v.id)} disabled={claiming}
                      className="btn btn-neon text-xs">{claiming ? "claiming…" : "Claim this room"}</button>
                    <button onClick={() => claim(v.id)} disabled={claiming}
                      className="btn text-xs">Skip — just claim it</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {q.trim().length >= 2 && !busy && !hits.length && (
        <div className="text-sm text-muted mt-3">
          Nothing by that name — <a href="/setup" className="text-cyan hover:underline">add your room</a>.
        </div>
      )}
      {msg && <div className="text-xs mt-2" style={{ color: "#e05c7a" }}>{msg}</div>}
    </div>
  );
}
