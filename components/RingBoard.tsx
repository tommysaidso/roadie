"use client";
import { useEffect, useState } from "react";
import { Tent, MapPin, Users, Car, Check, Star, Hammer, Cross, Shield, Flame } from "lucide-react";

const SCALE_LABEL: Record<string, string> = {
  popup: "Pop-up", small_ring: "Small ring", mid_ring: "Mid ring", full_ring: "Full ring",
};

// Bands see the announced route and claim their stops. A hometown act can ask to
// host its own town's stop — that's a separate ask from where it lands on the bill.
export default function RingBoard({ routes, stops, bands, hotelsByCity = {} }: { routes: any[]; stops: any[]; bands: any[]; hotelsByCity?: Record<string, number> }) {
  const [me, setMe] = useState<any>(null);
  const [mine, setMine] = useState<Record<number, any>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)).catch(() => {}); }, []);

  const bandId = me?.band_id ? Number(me.band_id) : null;
  const myBand = bands.find(b => Number(b.id) === bandId);

  useEffect(() => {
    if (!bandId) return;
    fetch(`/api/stop-interest?band_id=${bandId}`).then(r => r.json()).then(d => {
      const m: Record<number, any> = {};
      (d.interest || []).forEach((i: any) => { m[Number(i.stop_id)] = i; });
      setMine(m);
    }).catch(() => {});
  }, [bandId]);

  async function claim(stop: any, patch: any) {
    if (!bandId) return;
    setBusy(stop.id); setErr("");
    const body = { stop_id: stop.id, band_id: bandId, ...mine[stop.id], ...patch };
    const r = await fetch("/api/stop-interest", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    setBusy(null);
    if (!r.ok) { setErr(d.error || "Could not save."); return; }
    setMine(m => ({ ...m, [stop.id]: { ...body } }));
  }

  const byRoute = routes.length
    ? routes.map(r => ({ route: r, list: stops.filter(s => Number(s.route_id) === Number(r.id)) }))
    : [{ route: null, list: stops }];

  return (
    <div className="space-y-8">
      {err && <div className="card p-3 text-sm" style={{ borderColor: "#e05c7a", color: "#e05c7a" }}>{err}</div>}

      {!me && (
        <div className="card p-4 text-sm text-muted">
          Sign in as a band to claim stops on the ring. Anyone can browse the route.
        </div>
      )}

      {byRoute.map(({ route, list }, i) => (
        <section key={route?.id ?? `all-${i}`}>
          {route && (
            <div className="mb-3">
              <h2 className="text-xl font-black">{route.name}</h2>
              <div className="text-sm text-muted">
                {route.arc ? `${route.arc} · ` : ""}{route.start_date} → {route.end_date} · {list.length} stops
              </div>
            </div>
          )}

          {!list.length && <div className="card p-4 text-sm text-muted">No stops announced on this route yet.</div>}

          <div className="grid md:grid-cols-2 gap-3">
            {list.map(s => {
              const claimed = mine[s.id];
              const isHome = myBand && String(myBand.home_city || "").toLowerCase() === String(s.city || "").toLowerCase();
              return (
                <div key={s.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-lg font-bold flex items-center gap-2">
                        <Tent size={16} className="text-amber" />{s.city}
                      </div>
                      <div className="text-sm text-muted flex flex-wrap gap-3 mt-1">
                        <span className="flex items-center gap-1"><MapPin size={13} />{s.site_name || String(s.site_kind || "").replace(/_/g, " ")}</span>
                        {!!s.capacity && <span className="flex items-center gap-1"><Users size={13} />{s.capacity}</span>}
                        {!!s.lot_spaces && <span className="flex items-center gap-1"><Car size={13} />{s.lot_spaces} lot</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="pill">{s.date}</span>
                      <div className="mt-1"><span className="pill">{SCALE_LABEL[s.site_scale] || s.site_scale}</span></div>
                    </div>
                  </div>

                  <div className="text-xs text-muted mt-2 flex flex-wrap gap-3">
                    <span>{s.acts_in || 0} acts in</span>
                    <span>{s.host_asks || 0} asking to host</span>
                    <span>{s.bids || 0} site bids</span>
                    {s.advance_status !== "cleared" && <span className="text-amber">advance: {s.advance_status}</span>}
                  </div>

                  {(s.pricing_model && s.pricing_model !== "ticketed") && (
                    <div className="text-xs mt-2 flex flex-wrap gap-2 items-center">
                      <span style={{ color: "#3df0ff" }}>
                        {s.pricing_model === "free" ? "Free entry" : "Free · suggested donation"}
                        {s.pricing_model === "by_donation" && s.suggested_donation
                          ? ` $${Math.round(s.suggested_donation / 100)}`
                          : ""}
                      </span>
                      {s.community_split > 0 && (
                        <span className="pill text-[10px]">{s.community_split}% of door to local community</span>
                      )}
                    </div>
                  )}
                  {hotelsByCity[(s.city || "").toLowerCase()] > 0 && (
                    <div className="text-xs text-muted mt-1">
                      {hotelsByCity[(s.city || "").toLowerCase()]} hotel option{hotelsByCity[(s.city || "").toLowerCase()] > 1 ? "s" : ""} nearby
                    </div>
                  )}
                  {(s.nearest_hospital || s.nearest_police || s.nearest_fire) && (
                    <div className="text-xs text-muted mt-2 flex flex-wrap gap-3">
                      {s.nearest_hospital && (
                        <span className="flex items-center gap-1"><Cross size={11} style={{ color: "#e05c7a" }} />{s.nearest_hospital}</span>
                      )}
                      {s.nearest_police && (
                        <span className="flex items-center gap-1"><Shield size={11} style={{ color: "#3df0ff" }} />{s.nearest_police}</span>
                      )}
                      {s.nearest_fire && (
                        <span className="flex items-center gap-1"><Flame size={11} style={{ color: "#ffb33d" }} />{s.nearest_fire}</span>
                      )}
                    </div>
                  )}

                  {bandId && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => claim(s, { interest: claimed?.interest === "in" ? "out" : "in" })}
                        disabled={busy === s.id}
                        className={`pill ${claimed?.interest === "in" ? "border-neon text-white" : ""}`}
                      >
                        {claimed?.interest === "in" ? <><Check size={12} className="inline mr-1" />We're in</> : "Count us in"}
                      </button>

                      <select
                        value={claimed?.wants_bill || "any"}
                        onChange={e => claim(s, { wants_bill: e.target.value })}
                        className="bg-ink border border-edge rounded-lg px-2 py-1 text-xs"
                      >
                        <option value="any">any slot</option>
                        <option value="opener">opener</option>
                        <option value="support">support</option>
                        <option value="direct_support">direct support</option>
                        <option value="headliner">headliner</option>
                      </select>

                      <input
                        type="number" min={0} placeholder="km we'll travel"
                        defaultValue={claimed?.travel_km ?? ""}
                        onBlur={e => claim(s, { travel_km: Number(e.target.value) || null })}
                        className="bg-ink border border-edge rounded-lg px-2 py-1 text-xs w-32"
                      />

                      {isHome && (
                        <button
                          onClick={() => claim(s, { wants_host: claimed?.wants_host ? 0 : 1, interest: "in" })}
                          disabled={busy === s.id}
                          className={`pill ${claimed?.wants_host ? "border-neon text-white" : ""}`}
                          title="This is our town — we want to host this stop"
                        >
                          <Star size={12} className="inline mr-1" />
                          {claimed?.wants_host ? "Hosting ask sent" : "Host our town"}
                        </button>
                      )}
                    </div>
                  )}

                  <a href={`/host?stop=${s.id}`} className="text-xs text-cyan mt-3 inline-flex items-center gap-1 hover:underline">
                    <Hammer size={12} /> Got the ground? Bid to host this stop
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
