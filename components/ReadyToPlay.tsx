"use client";
import { useEffect, useState } from "react";
import { Radio, Loader2, MapPin, AlertTriangle, Check } from "lucide-react";

// The band-side switch: "we're ready to play."
//
// Not an application. The act flips this on once and the ring considers them
// every time it comes within their radius — including nights nobody has
// advertised, because the rest of the bill is assembled, not posted.
const POSITION_LABEL: Record<string, string> = {
  local_host: "Hometown host",
  opener: "Opener",
  support: "Support",
  direct_support: "Direct support",
  headliner: "Headliner",
};

export default function ReadyToPlay() {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [terms,setTerms]=useState<any>(null);
  const [showTerms,setShowTerms]=useState(false);
  const [typedName,setTypedName]=useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/bands/readiness").then(async r => {
      const x = await r.json();
      if (!r.ok) { setErr(x.message || x.error || "Couldn't load."); setD({ none: true }); return; }
      setD(x); if(x?.tour_terms) setTerms(x.tour_terms);
      setF(x.readiness || {
        active: 0, radius_km: x.defaults.radius_km, positions: "local_host,opener,support",
        min_notice_days: 14, gig_ready: 1, travel_overnight: 0, blackout: "", rate_min: "", note: "",
      });
    }).catch(() => { setErr("Couldn't load."); setD({ none: true }); });
  }, []);

  if (!d) return <div className="card p-5 text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Loading…</div>;
  if (d.none) return <div className="card p-5 text-sm text-muted">{err}</div>;

  const positions: string[] = String(f.positions || "").split(",").filter(Boolean);
  const togglePos = (p: string) =>
    setF((x: any) => {
      const cur = String(x.positions || "").split(",").filter(Boolean);
      const next = cur.includes(p) ? cur.filter(c => c !== p) : [...cur, p];
      return { ...x, positions: next.join(",") };
    });

  async function save(patch?: any) {
    setBusy(true); setMsg(""); setErr("");
    try {
      const body = { ...f, ...patch, positions: (patch?.positions ?? f.positions) };
      const r = await fetch("/api/bands/readiness", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const x = await r.json();
      if (!r.ok) {
        // 409 = the tour contract has not been accepted (or has moved on).
        if (x.needs_tour_terms) { setTerms(x.tour_terms); setShowTerms(true); setErr(x.error); return; }
        setErr(x.error || x.message || "Save failed."); return;
      }
      setF(x.readiness); if(x.tour_terms) setTerms(x.tour_terms); setMsg("Saved.");
    } catch { setErr("Save failed."); }
    finally { setBusy(false); }
  }

  const on = !!f.active;
  const needsTerms = !!terms && (!terms.accepted || terms.outdated);

  // Accepting the tour contract and going available are one action from the
  // act's side — they tick "we're in", read, confirm, and they are in the round.
  async function acceptAndGo() {
    if (!typedName.trim()) { setErr("Type your name to confirm."); return; }
    setErr("");
    await save({ active: 1, accept_tour_terms: true, typed_name: typedName.trim() });
    setShowTerms(false);
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-lg font-black flex items-center gap-2">
            <Radio size={17} className={on ? "text-neon" : "text-muted"} />Ready to play
          </div>
          <p className="text-sm text-muted mt-1">
            Flip this on and {d.band?.name || "your band"} goes in the round. When the ring comes
            within your range we&rsquo;ll consider you for the bill — including nights that never
            get posted, because the rest of the bill is built, not advertised.
          </p>
        </div>
        <button
          onClick={() => {
            // Turning OFF is never gated — an act that wants out gets out.
            if (on) { save({ active: 0 }); return; }
            if (needsTerms) { setShowTerms(true); return; }
            save({ active: 1 });
          }}
          disabled={busy}
          className={`btn text-sm shrink-0 ${on ? "btn-neon" : ""}`}>
          {busy ? "…" : on ? "We're in the round" : "Put us in the round"}
        </button>
      </div>

      {!d.locatable && (
        <div className="mt-3 text-xs flex items-start gap-2" style={{ color: "#ffb33d" }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Your band has no location on file, so nothing can match you no matter what you set here.
            Add your home town in the Garage first.
          </span>
        </div>
      )}

      {showTerms && needsTerms && (
        <div className="card p-4 mt-3 space-y-3 text-sm leading-relaxed"
             style={{ borderColor: "rgba(255,200,60,0.45)" }}>
          <div className="text-neon font-medium">
            {terms?.outdated ? "The tour terms have changed" : "Read the tour contract first"}
          </div>
          <p className="text-muted">
            {terms?.outdated
              ? <>You accepted version <b>{terms.version}</b>; the current terms are{" "}
                  <b>{terms.current_version}</b>. Different words, so we are asking again
                  rather than carrying your old acceptance forward.</>
              : <>Going in the round means the ring can offer you dates, so you should see
                  the deal first: <b>${terms?.base_guarantee_cad ?? 3000} CAD guaranteed per
                  show</b> — per act, not per head — plus 60% of the door, with travel, rooms
                  and food covered. Your music stays yours.</>}
          </p>
          <div className="text-xs" style={{ color: "#fbbf24" }}>
            In development — these are base template terms and they will change.
            You will be alerted and asked to look again, never moved quietly.
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <a href="/ring-agreement" target="_blank" rel="noreferrer" className="pill hover:bg-white/5">
              Read the contract →
            </a>
            <a href="/api/legal/ring-contract" download className="pill hover:bg-white/5">
              Download (.md)
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input" placeholder="Type your name"
                   value={typedName} onChange={e=>setTypedName(e.target.value)}
                   onKeyDown={e=>e.key==="Enter"&&acceptAndGo()} />
            <button className="btn btn-neon" onClick={acceptAndGo} disabled={busy}>
              {busy ? "…" : "Accept & go in the round"}
            </button>
            <button className="pill" onClick={()=>setShowTerms(false)}>Not yet</button>
          </div>
          <div className="text-[11px] text-muted">
            This records that you read the terms — it is not a signature and does not
            book you on anything. The contract is signed by the act and every touring
            member before any ring, on paper.
          </div>
        </div>
      )}

      <div className={`mt-4 space-y-4 ${on ? "" : "opacity-50 pointer-events-none"}`}>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
            <MapPin size={11} />How far you&rsquo;ll go — {f.radius_km}km
          </div>
          <input type="range" min={25} max={600} step={25} value={f.radius_km || 150}
            onChange={e => setF({ ...f, radius_km: Number(e.target.value) })}
            onMouseUp={() => save()} onTouchEnd={() => save()}
            className="w-full accent-neon" />
          <div className="text-[11px] text-muted">
            {f.radius_km <= 60 ? "Your own town and next door."
              : f.radius_km <= 150 ? "About two hours — a gig you can drive home from."
              : f.radius_km <= 300 ? "Half a province. Expect some overnights."
              : "Wide open — you'll show up on stops a long way out."}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Where you&rsquo;ll sit on the bill</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(POSITION_LABEL).map(p => (
              <button key={p} onClick={() => togglePos(p)}
                className={`pill text-xs ${positions.includes(p) ? "border-neon text-neon" : "text-muted"}`}>
                {positions.includes(p) && <Check size={11} className="inline mr-1" />}{POSITION_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Notice you need (days)</div>
            <input type="number" min={0} max={180} value={f.min_notice_days ?? 14}
              onChange={e => setF({ ...f, min_notice_days: Number(e.target.value) })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
          </label>
          <label>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Least you&rsquo;ll take ($)</div>
            <input type="number" min={0} value={f.rate_min ?? ""} placeholder="leave blank for open"
              onChange={e => setF({ ...f, rate_min: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
          </label>
          <label className="col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Dates you can&rsquo;t do</div>
            <input value={f.blackout ?? ""} placeholder="2027-09-03, 2027-09-14"
              onChange={e => setF({ ...f, blackout: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.travel_overnight}
              onChange={e => setF({ ...f, travel_overnight: e.target.checked ? 1 : 0 })} />
            We&rsquo;ll stay over — don&rsquo;t limit us to same-night-home gigs
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.gig_ready}
              onChange={e => setF({ ...f, gig_ready: e.target.checked ? 1 : 0 })} />
            We play real, paid shows — set, gear and people ready to go
          </label>
          <label className="col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Anything the booker should know</div>
            <input value={f.note ?? ""} placeholder="six-piece, need 20A · we bring our own PA"
              onChange={e => setF({ ...f, note: e.target.value })}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => save()} disabled={busy} className="btn text-sm">{busy ? "saving…" : "Save"}</button>
          {msg && <span className="text-xs text-muted">{msg}</span>}
          {err && <span className="text-xs" style={{ color: "#e05c7a" }}>{err}</span>}
        </div>
      </div>
    </div>
  );
}
