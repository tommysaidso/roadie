"use client";
import { useEffect, useState } from "react";
import { Tent, Check, TriangleAlert } from "lucide-react";

const SITE_KINDS = [
  ["fairground", "Fairground"], ["rodeo_grounds", "Rodeo grounds"], ["arena_lot", "Arena lot"],
  ["park", "Park / rec ground"], ["reserve_grounds", "Reserve grounds"],
  ["community_hall", "Community hall"], ["venue", "Licensed room / venue"],
];

export default function HostBidForm({ stops }: { stops: any[] }) {
  const [me, setMe] = useState<any>(null);
  const [stopId, setStopId] = useState<string>("");
  const [f, setF] = useState<any>({
    applicant_kind: "venue", applicant_name: "", site_offered: "", site_kind: "fairground",
    capacity_offered: "", parking_spaces: "", local_crew_offered: "", guarantee_offered: "",
    ground_ready: false, power_onsite: false, permit_help: false, pitch: "", contact: "",
  });
  const [sent, setSent] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)).catch(() => {}); }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("stop");
    if (q) setStopId(q);
  }, []);

  const stop = stops.find(s => String(s.id) === String(stopId));
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  async function submit() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/host-bids", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, stop_id: Number(stopId) }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(d.error || "Could not submit the bid."); return; }
    setSent(d);
  }

  if (sent) {
    return (
      <div className="card p-6">
        <div className="text-lg font-black flex items-center gap-2"><Check className="text-neon" size={18} />Bid in.</div>
        <p className="text-sm text-muted mt-2">
          Your bid scored <b className="text-white">{Math.round((sent.score || 0) * 100)}</b> out of 100.
          Ground readiness, on-site power and handling the municipal permit move that number the most.
          We shortlist by score and confirm the ground before the route locks.
        </p>
        <a href="/ring" className="btn btn-neon mt-4 inline-block">Back to the ring</a>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 card p-5 space-y-3">
        <div>
          <div className="label mb-1">Which stop</div>
          <select value={stopId} onChange={e => setStopId(e.target.value)}
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm w-full">
            <option value="">choose a date the ring is rolling…</option>
            {stops.map(s => (
              <option key={s.id} value={s.id}>
                {s.date} — {s.city}, {s.region} ({s.bids} bid{s.bids === 1 ? "" : "s"} in)
              </option>
            ))}
          </select>
        </div>

        {stop && (
          <div className="rounded-xl border border-amber/40 bg-black/20 p-3 text-sm">
            <div className="flex items-start gap-2">
              <TriangleAlert size={16} className="text-amber shrink-0 mt-0.5" />
              <div>
                <b className="text-amber">This date is happening either way.</b>{" "}
                On {stop.date} the ring is in {stop.city}. If you host it, that crowd comes
                through your gate. If you don&rsquo;t, we are the show in town that night and
                you are competing with it — same crowd, someone else&rsquo;s gate.
                Bidding costs less than an empty room.
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Who&rsquo;s applying</div>
            <select value={f.applicant_kind} onChange={e => set("applicant_kind", e.target.value)}
              className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm w-full">
              <option value="venue">Venue / room</option>
              <option value="municipality">Municipality</option>
              <option value="fairground">Fairground / society</option>
              <option value="promoter">Promoter</option>
              <option value="band">Band (our hometown)</option>
              <option value="community">Community group</option>
            </select>
          </div>
          <input value={f.applicant_name} onChange={e => set("applicant_name", e.target.value)}
            placeholder="Your name / organization"
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <input value={f.site_offered} onChange={e => set("site_offered", e.target.value)}
            placeholder="Ground you're putting up"
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <select value={f.site_kind} onChange={e => set("site_kind", e.target.value)}
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm">
            {SITE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" value={f.capacity_offered} onChange={e => set("capacity_offered", e.target.value)}
            placeholder={stop?.capacity ? `capacity (we need ~${stop.capacity})` : "capacity you can hold"}
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={f.parking_spaces} onChange={e => set("parking_spaces", e.target.value)}
            placeholder={stop?.lot_spaces ? `parking (we need ~${stop.lot_spaces})` : "parking spaces"}
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={f.local_crew_offered} onChange={e => set("local_crew_offered", e.target.value)}
            placeholder="local crew you can staff"
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={f.guarantee_offered} onChange={e => set("guarantee_offered", e.target.value)}
            placeholder="guarantee to land the date (CAD)"
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <input value={f.contact} onChange={e => set("contact", e.target.value)}
            placeholder="contact email or phone"
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm md:col-span-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          {([["ground_ready", "Ground is flat, drained & truck-accessible"],
             ["power_onsite", "Power on site"],
             ["permit_help", "We handle the municipal permit"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => set(k, !f[k])}
              className={`pill ${f[k] ? "border-neon text-white" : ""}`}>
              {f[k] ? <Check size={12} className="inline mr-1" /> : null}{l}
            </button>
          ))}
        </div>

        <textarea value={f.pitch} onChange={e => set("pitch", e.target.value)} rows={3}
          placeholder="Why your town deserves the ring — draw, local acts, festival week, whatever you've got."
          className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm w-full" />

        {err && <div className="text-sm" style={{ color: "#e05c7a" }}>{err}</div>}
        {!me && <div className="text-sm text-muted">Sign in to submit a bid.</div>}

        <button onClick={submit} disabled={!me || !stopId || !f.applicant_name || busy}
          className="btn btn-neon w-full flex items-center justify-center gap-2 disabled:opacity-40">
          <Tent size={16} />{busy ? "Sending…" : "Submit bid to host"}
        </button>
      </div>

      <aside className="card p-5 space-y-3 h-fit">
        <div className="label">What we bring</div>
        <ul className="text-sm text-muted space-y-1.5">
          <li>Stage, roof and rigging</li>
          <li>PA, monitors, lighting, power</li>
          <li>The bill — touring acts plus your local hosts</li>
          <li>Route marketing and the gate</li>
          <li>Vendor midway and sponsor activation</li>
        </ul>
        <div className="label pt-2">What you bring</div>
        <ul className="text-sm text-muted space-y-1.5">
          <li>The ground and the parking</li>
          <li>Municipal permit help</li>
          <li>Local crew we hire and pay</li>
        </ul>
        <div className="text-xs text-muted pt-2 border-t border-edge">
          Every stop is all-ages and alcohol-free. Scoring is transparent: ground readiness,
          power, permit help and capacity fit carry the most weight.
        </div>
      </aside>
    </div>
  );
}
