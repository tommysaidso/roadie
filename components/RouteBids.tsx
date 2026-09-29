"use client";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, MapPin, DollarSign } from "lucide-react";

// Who wants the run. Operator decides: shortlist, accept, decline.
//
// The list carries two numbers that matter more than the bid itself — how many
// nights the bid actually reaches, and how many of those it FITS. An act can
// bid the whole ring and clash with the booked headliner on half of it; that
// should be visible before anyone shortlists them, not discovered at settlement.
const TONE: Record<string, string> = {
  submitted: "#8c90b0", shortlisted: "#3df0ff", accepted: "#3ddc84",
  declined: "#e05c7a", withdrawn: "#8c90b0",
};

export default function RouteBids() {
  const [d, setD] = useState<any>(null);
  const [routeId, setRouteId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function load(id?: number | null) {
    try {
      const r = await fetch(`/api/admin/route-bids${id ? `?routeId=${id}` : ""}`);
      const x = await r.json();
      if (!r.ok) { setErr(x.error || "Couldn't load bids."); return; }
      setD(x); setRouteId(x.route?.id ?? null);
    } catch { setErr("Couldn't load bids."); }
  }
  useEffect(() => { load(); }, []);

  async function decide(id: number, status: string) {
    setBusy(id);
    try {
      await fetch("/api/admin/route-bids", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await load(routeId);
    } finally { setBusy(null); }
  }

  if (err) return <div className="card p-5 text-sm" style={{ color: "#e05c7a" }}>{err}</div>;
  if (!d) return <div className="card p-5 text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Loading bids…</div>;

  return (
    <div className="space-y-3">
      <div className="card p-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted">Ring</span>
        <select value={routeId ?? ""} onChange={e => { setRouteId(Number(e.target.value)); load(Number(e.target.value)); }}
          className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon">
          {d.routes.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}{r.season ? ` · ${r.season}` : ""} ({r.status})</option>
          ))}
        </select>
        <span className="text-xs text-muted ml-auto">{d.stops} stops · {d.bids.length} bid{d.bids.length === 1 ? "" : "s"}</span>
      </div>

      {!d.bids.length && (
        <div className="card p-5 text-sm text-muted">
          No acts have bid this ring yet. Bands put their hand up from The Ring page —
          separate from the &ldquo;ready to play&rdquo; flag, which only offers them for stops near home.
        </div>
      )}

      {d.bids.map((b: any) => (
        <div key={b.id} className="card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-2">
                {b.band_name}
                <span className="pill text-[10px]" style={{ borderColor: TONE[b.status], color: TONE[b.status] }}>{b.status}</span>
              </div>
              <div className="text-xs text-muted flex flex-wrap gap-x-3 mt-0.5">
                <span className="flex items-center gap-1"><MapPin size={11} />{b.home_city || "—"}</span>
                <span>{b.genres || b.genre || "untagged"}</span>
                <span>wants: {String(b.wants_bill).replace("_", " ")}</span>
                {b.ask != null && <span className="flex items-center gap-1"><DollarSign size={11} />{Number(b.ask).toLocaleString()}/night</span>}
                <span>{b.scope === "dates" ? `${b.from_date || "…"} → ${b.to_date || "…"}` : "whole ring"}</span>
                {!b.travel_all && <span style={{ color: "#ffb33d" }}>won&rsquo;t ride the full run</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-black">{b.nights_fit}/{b.nights_covered}</div>
              <div className="text-[10px] text-muted">nights that fit</div>
            </div>
          </div>

          {b.genre_clashes?.length > 0 && (
            <div className="mt-2 text-[11px] flex items-start gap-1" style={{ color: "#ffb33d" }}>
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>Wrong lane on {b.genre_clashes.length} night{b.genre_clashes.length === 1 ? "" : "s"}: {b.genre_clashes.slice(0, 4).join(", ")}{b.genre_clashes.length > 4 ? "…" : ""}</span>
            </div>
          )}
          {b.note && <div className="text-xs text-muted mt-2">“{b.note}”</div>}

          <div className="flex gap-2 mt-3">
            {["shortlisted", "accepted", "declined"].map(s => (
              <button key={s} onClick={() => decide(b.id, s)} disabled={busy === b.id || b.status === s}
                className={`btn text-xs ${s === "accepted" ? "btn-neon" : ""}`}>
                {busy === b.id ? "…" : s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
