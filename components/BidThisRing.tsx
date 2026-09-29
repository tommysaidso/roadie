"use client";
import { useEffect, useState } from "react";
import { Route as RouteIcon, Loader2, Check, X } from "lucide-react";

// Band-facing: put your hand up for the whole run.
//
// Deliberately separate from the "ready to play" flag. Readiness says "consider
// us when you're near"; this says "we'll ride the ring." An act can do both,
// and most will — the flag catches the nights nobody advertises, the bid says
// they want the tour itself.
const ASK_LABEL: Record<string, string> = {
  any: "Any slot on the bill",
  opener: "Opener",
  support: "Support",
  direct_support: "Direct support",
  headliner: "Headliner",
};
const STATUS_TONE: Record<string, string> = {
  submitted: "#8c90b0", shortlisted: "#3df0ff", accepted: "#3ddc84",
  declined: "#e05c7a", withdrawn: "#8c90b0",
};

export default function BidThisRing({ routes }: { routes: any[] }) {
  const [routeId, setRouteId] = useState<number | null>(routes?.[0]?.id ?? null);
  const [bid, setBid] = useState<any>(null);
  const [f, setF] = useState<any>({ scope: "whole_ring", wants_bill: "any", travel_all: 1, ask: "", note: "", from_date: "", to_date: "" });
  const [state, setState] = useState<"loading" | "ready" | "noband">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load(id: number | null) {
    if (!id) return;
    setState("loading");
    try {
      const r = await fetch(`/api/routes/bid?routeId=${id}`);
      const d = await r.json();
      if (!r.ok) { setState("noband"); setMsg(d.message || d.error || ""); return; }
      setBid(d.bid || null);
      if (d.bid) setF({ ...d.bid, ask: d.bid.ask ?? "", note: d.bid.note ?? "", from_date: d.bid.from_date ?? "", to_date: d.bid.to_date ?? "" });
      setState("ready");
    } catch { setState("noband"); }
  }
  useEffect(() => { load(routeId); /* eslint-disable-next-line */ }, [routeId]);

  if (!routes?.length) return null;
  if (state === "noband") {
    return (
      <div className="card p-5 text-sm text-muted">
        {msg || "Claim your band to bid on a ring."}{" "}
        <a href="/garage" className="text-cyan hover:underline">Go to the Garage</a>.
      </div>
    );
  }

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/routes/bid", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, routeId }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Couldn't submit."); return; }
      setBid(d.bid); setMsg("Your bid is in.");
    } catch { setMsg("Couldn't submit."); }
    finally { setBusy(false); }
  }

  async function withdraw() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/routes/bid?routeId=${routeId}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Couldn't withdraw."); return; }
      setBid(d.bid); setMsg("Withdrawn.");
    } catch { setMsg("Couldn't withdraw."); }
    finally { setBusy(false); }
  }

  const live = bid && bid.status !== "withdrawn";

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-black flex items-center gap-2"><RouteIcon size={17} className="text-neon" />Bid the ring</div>
          <p className="text-sm text-muted mt-1">
            Want the whole run, not just a night? Put your hand up here. Being &ldquo;ready to play&rdquo;
            already gets you considered for stops near you — this is different: it says you&rsquo;ll
            ride the ring.
          </p>
        </div>
        {live && (
          <span className="pill text-xs shrink-0" style={{ borderColor: STATUS_TONE[bid.status], color: STATUS_TONE[bid.status] }}>
            {bid.status}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        <label>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Which ring</div>
          <select value={routeId ?? ""} onChange={e => setRouteId(Number(e.target.value))}
            className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon">
            {routes.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}{r.season ? ` · ${r.season}` : ""}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">How much of it</div>
            <select value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon">
              <option value="whole_ring">The whole ring</option>
              <option value="dates">A stretch of dates</option>
            </select>
          </label>
          <label>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Slot you want</div>
            <select value={f.wants_bill} onChange={e => setF({ ...f, wants_bill: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon">
              {Object.keys(ASK_LABEL).map(k => <option key={k} value={k}>{ASK_LABEL[k]}</option>)}
            </select>
          </label>

          {f.scope === "dates" && (
            <>
              <label>
                <div className="text-[10px] uppercase tracking-widest text-muted mb-1">From</div>
                <input type="date" value={f.from_date || ""} onChange={e => setF({ ...f, from_date: e.target.value })}
                  className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
              </label>
              <label>
                <div className="text-[10px] uppercase tracking-widest text-muted mb-1">To</div>
                <input type="date" value={f.to_date || ""} onChange={e => setF({ ...f, to_date: e.target.value })}
                  className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
              </label>
            </>
          )}

          <label>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Your number, per night ($)</div>
            <input type="number" min={0} value={f.ask} placeholder="leave blank to talk"
              onChange={e => setF({ ...f, ask: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
          </label>
          <label className="flex items-end gap-2 text-sm pb-1.5">
            <input type="checkbox" checked={!!f.travel_all} onChange={e => setF({ ...f, travel_all: e.target.checked ? 1 : 0 })} />
            We&rsquo;ll ride the whole run
          </label>

          <label className="col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Anything they should know</div>
            <input value={f.note || ""} placeholder="five-piece · our own backline · we can open and close"
              onChange={e => setF({ ...f, note: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
          </label>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={submit} disabled={busy || state === "loading"} className="btn btn-neon text-sm flex items-center gap-1">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {live ? "Update our bid" : "Bid this ring"}
          </button>
          {live && (
            <button onClick={withdraw} disabled={busy} className="btn text-sm flex items-center gap-1">
              <X size={14} />Withdraw
            </button>
          )}
          {msg && <span className="text-xs text-muted">{msg}</span>}
        </div>

        {bid?.status === "declined" && bid.decision_note && (
          <div className="text-xs text-muted">Note from the booker: {bid.decision_note}</div>
        )}
      </div>
    </div>
  );
}
