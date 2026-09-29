"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Loader2, LocateFixed, MapPin, Search, Sparkles } from "lucide-react";

type Nearby = {
  origin: { label: string; city?: string; region?: string; lat: number; lng: number };
  radius_km: number;
  counts: { venues: number; slots: number; bands: number };
  venues: any[];
  slots: any[];
  bands: any[];
};

const DEFAULT_CITY = "Kelowna, BC";

function askRoadie(text: string) {
  window.dispatchEvent(new CustomEvent("roadie:open", { detail: { ask: text } }));
}

export default function LocationQuickStart() {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nearby, setNearby] = useState<Nearby | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("roadie_origin");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.city) setCity(saved.city);
        if (saved?.lat && saved?.lng) { load(`lat=${saved.lat}&lng=${saved.lng}`); return; }
      }
      // No saved spot yet — auto-detect ONCE. The whole promise on a phone is
      // "ROADIE knows where you are"; making the user hunt for a button every
      // time breaks that. We try automatically the first time, remember that
      // we tried, and never nag: deny it and you just get the city box.
      if (!localStorage.getItem("roadie_geo_tried") && navigator.geolocation) {
        localStorage.setItem("roadie_geo_tried", "1");
        autoGps();
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Quiet auto-detect: on denial we fall back silently to the city box
   *  instead of throwing a scary error the user didn't ask for. */
  function autoGps() {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => load(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      () => setLoading(false),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 10 * 60 * 1000 },
    );
  }

  const originLabel = useMemo(() => nearby?.origin?.label || city || "your city", [nearby, city]);

  async function load(query: string, savedCity?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/nearby?${query}&km=160`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "I could not place that location yet.");
      setNearby(data);
      // Keep the search box in step with whatever we just resolved, so hitting
      // "use my location" fills it in rather than leaving a stale city sitting
      // there contradicting the results underneath.
      const resolved = data?.origin?.city
        ? [data.origin.city, data.origin.region].filter(Boolean).join(", ")
        : data?.origin?.label;
      if (resolved && resolved !== "your location") setCity(resolved);
      // Tell the rest of the page. The panel used to update in isolation while
      // the map and the listings stayed wherever the hub put them, so picking
      // your location moved one box and nothing else.
      try {
        if (data?.origin?.lat && data?.origin?.lng) {
          window.dispatchEvent(new CustomEvent("roadie:origin", {
            detail: { lat: data.origin.lat, lng: data.origin.lng, label: resolved },
          }));
        }
      } catch {}
      try {
        localStorage.setItem(
          "roadie_origin",
          JSON.stringify({ city: savedCity || data.origin?.label, lat: data.origin.lat, lng: data.origin.lng }),
        );
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Location lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setError("This browser has location turned off, so use the city box.");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        load(`lat=${latitude}&lng=${longitude}`);
      },
      () => {
        setLoading(false);
        setError("Location permission did not come through. Type the city and I can still route you.");
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 10 * 60 * 1000 },
    );
  }

  // Who is looking — only operators get the "invite them" action.
  const [amAdmin, setAmAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json())
      .then(d => setAmAdmin(["admin", "owner"].includes(String(d?.user?.role || ""))))
      .catch(() => {});
  }, []);

  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [showList, setShowList] = useState<null | "venues" | "bands">(null);

  // Town suggestions, from our own gazetteer. No key in the browser, nothing
  // metered, and it only ever offers towns the circuit actually reaches — a
  // places API would happily send someone to Kelowna, Missouri.
  const [sugg, setSugg] = useState<any[]>([]);
  const [suggOpen, setSuggOpen] = useState(false);
  const [hi, setHi] = useState(-1);          // keyboard highlight
  const suggSeq = useRef(0);

  useEffect(() => {
    const q = city.trim();
    if (!suggOpen || q.length < 2) { setSugg([]); return; }
    const seq = ++suggSeq.current;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/cities?q=${encodeURIComponent(q)}`)
        .then(r => r.json()).catch(() => null);
      // Ignore a slow answer that lost the race to a newer keystroke.
      if (seq !== suggSeq.current) return;
      setSugg(r?.cities || []); setHi(-1);
    }, 120);
    return () => clearTimeout(t);
  }, [city, suggOpen]);

  /** Take a suggestion: fill the box and search it in one move. */
  function pickCity(c: any) {
    const label = [c.city, c.region].filter(Boolean).join(", ");
    setCity(label);
    setSugg([]); setSuggOpen(false); setHi(-1);
    load(`lat=${c.lat}&lng=${c.lng}`, label);
  }
  async function invite(kind: "venue" | "band", row: any) {
    const key = `${kind}:${row.id}`;
    setInvited(s => ({ ...s, [key]: true }));
    await fetch("/api/admin/reachout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id: row.id }),
    }).catch(() => {});
  }

  function citySearch(e?: React.FormEvent) {
    e?.preventDefault();
    const c = city.trim();
    if (!c) return;
    load(`city=${encodeURIComponent(c)}`, c);
  }

  const firstSlot = nearby?.slots?.[0];

  return (
    <section className="card p-4 md:p-5 border-cyan/30 bg-white/[0.025]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="label flex items-center gap-2 text-cyan">
            <LocateFixed size={14} />
            Start near you
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight md:text-2xl">Find the local signal first.</h2>
          <p className="mt-1 text-sm text-muted">
            On a phone, ROADIE should know where you are and show the nearest venues, gaps, bands and routes fast.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[auto,1fr] lg:w-[520px]">
          <button onClick={useGps} disabled={loading} className="btn btn-neon justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Compass size={16} />}
            Use my location
          </button>
          <form onSubmit={citySearch} className="relative flex min-w-0 rounded-full border border-edge bg-ink/80 p-1">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onFocus={(e) => { e.currentTarget.select(); setSuggOpen(true); }}
              onBlur={() => setTimeout(() => setSuggOpen(false), 140)}
              onKeyDown={(e) => {
                if (!sugg.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, sugg.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, -1)); }
                else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pickCity(sugg[hi]); }
                else if (e.key === "Escape") setSuggOpen(false);
              }}
              placeholder="Kelowna, BC"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
            <button className="btn px-3 py-2" aria-label="Search by city">
              <Search size={15} />
            </button>

            {suggOpen && sugg.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
                style={{
                  background: "rgba(20,20,28,0.96)",
                  backdropFilter: "blur(14px)",
                  border: "1px solid #2a2a3a",
                  boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
                }}>
                {sugg.map((c, i) => (
                  <button key={`${c.city}-${c.region}`} type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickCity(c); }}
                    onMouseEnter={() => setHi(i)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2"
                    style={{ background: i === hi ? "rgba(255,255,255,0.07)" : "transparent" }}>
                    <MapPin size={12} className="text-cyan shrink-0" />
                    <span>{c.city}</span>
                    <span className="text-[11px] text-muted">{c.region}</span>
                  </button>
                ))}
                <div className="px-3 py-1.5 text-[10px] text-muted border-t border-[#2a2a3a]">
                  towns on the circuit
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* The full list, as a popup rather than a panel that pushes the page
          down. Scrolls internally so it never grows past the window. */}
      {showList && nearby && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowList(null)}>
          <div className="card w-full max-w-lg flex flex-col"
            style={{ maxHeight: "72vh" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-edge">
              <b className="capitalize">{showList} near {originLabel}</b>
              <span className="text-[11px] text-muted">{nearby.radius_km} km</span>
              <button className="btn ml-auto px-2 py-1 text-[11px]"
                onClick={() => setShowList(null)}>Close</button>
            </div>
            <div className="overflow-y-auto p-2 flex flex-col gap-1">
              {(((nearby as any)[showList] || []) as any[]).map((r: any) => {
                const open = !r.user_id ||
                  ["unclaimed", "unverified", "example"].includes(String(r.verification_status || ""));
                const key = `${showList === "venues" ? "venue" : "band"}:${r.id}`;
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="truncate">{r.name}</span>
                    <span className="text-[11px] text-muted shrink-0">
                      {r.city || r.home_city}{typeof r.km === "number" ? ` · ${r.km} km` : ""}
                    </span>
                    {open && <span className="pill text-[9px] shrink-0" style={{ color: "#ffb03d" }}>unclaimed</span>}
                    {r.last_contacted_at && <span className="text-[10px] text-muted shrink-0">contacted</span>}
                    {amAdmin && open && (
                      <button onClick={() => invite(showList === "venues" ? "venue" : "band", r)}
                        disabled={!!invited[key]}
                        className="pill text-[9px] shrink-0 ml-auto hover:border-neon">
                        {invited[key] ? "asked" : r.last_contacted_at ? "ask again" : "invite"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      {nearby && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,1.2fr]">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="venues" value={nearby.counts.venues} />
            <Metric label="open slots" value={nearby.counts.slots} />
            <Metric label="bands" value={nearby.counts.bands} />
          </div>

          <div className="rounded-2xl border border-edge bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold">
                <MapPin size={14} className="mr-1 inline text-cyan" />
                Near {originLabel}
              </div>
              <span className="shrink-0 text-[11px] text-muted">{nearby.radius_km} km radius</span>
            </div>
            <div className="space-y-2 text-sm">
              {firstSlot ? (
                <Link href="/venues" className="block rounded-xl border border-edge px-3 py-2 hover:border-neon">
                  <b>{firstSlot.venue}</b> has {firstSlot.genre_wanted || "an open"} slot
                  <span className="text-muted"> · {firstSlot.city} · {firstSlot.km} km</span>
                </Link>
              ) : (
                <div className="rounded-xl border border-edge px-3 py-2 text-muted">No open slots nearby yet. ROADIE can still find venues and route a run.</div>
              )}
              {/* Tight by default. The full list is a popup — inlining eight
                  venues AND eight bands turned this panel into a wall. */}
              {(() => {
                const vs: any[] = (nearby as any).venues || [];
                const bs: any[] = (nearby as any).bands || [];
                const openCount = [...vs, ...bs].filter((r: any) => !r.user_id).length;
                if (!vs.length && !bs.length) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button onClick={() => setShowList("venues")} className="pill hover:border-neon">
                      {vs.length} venues
                    </button>
                    <button onClick={() => setShowList("bands")} className="pill hover:border-neon">
                      {bs.length} bands
                    </button>
                    {openCount > 0 && (
                      <span className="pill text-[10px]" style={{ color: "#ffb03d" }}>
                        {openCount} unclaimed
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => askRoadie(`find open gigs near ${originLabel}`)} className="pill hover:border-neon">
                  <Sparkles size={13} className="mr-1 inline" />
                  Ask ROADIE
                </button>
                <Link href="/venues" className="pill hover:border-neon">venues</Link>
                <Link href="/map" className="pill hover:border-neon">map</Link>
                <Link href="/board" className="pill hover:border-neon">board</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-edge bg-black/20 p-3 text-center">
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[.18em] text-muted">{label}</div>
    </div>
  );
}
