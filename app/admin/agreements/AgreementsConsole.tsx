"use client";
import { useEffect, useState } from "react";

/**
 * Ring paperwork + crew pool, in one console.
 *
 * The question an operator is actually asking is "can I run this ring" — which
 * splits into "are the bands papered" and "can I staff the towns". Those two
 * live together here rather than in separate screens, because the answer to one
 * changes what you do about the other.
 */
export default function AgreementsConsole({ routes }: { routes: any[] }) {
  const [tab, setTab] = useState<"bands" | "crew">("bands");
  const [routeId, setRouteId] = useState<number>(routes[0]?.id || 0);
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // crew side
  const [stops, setStops] = useState<any[]>([]);
  const [stopId, setStopId] = useState<number>(0);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [crew, setCrew] = useState<any>(null);

  async function loadBands() {
    if (!routeId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/agreements?route_id=${routeId}`);
      setD(await r.json());
    } finally { setBusy(false); }
  }

  async function loadCrew() {
    setBusy(true);
    try {
      const qs = stopId
        ? `stop_id=${stopId}${dept ? `&dept=${dept}` : ""}`
        : `q=${encodeURIComponent(q)}${dept ? `&dept=${dept}` : ""}`;
      const r = await fetch(`/api/admin/crew?${qs}`);
      setCrew(await r.json());
    } finally { setBusy(false); }
  }

  useEffect(() => { if (tab === "bands") loadBands(); }, [routeId, tab]);
  useEffect(() => {
    fetch(`/api/admin/ring?route_id=${routeId}`)
      .then(r => r.json())
      .then(x => setStops(x.stops || []))
      .catch(() => setStops([]));
  }, [routeId]);
  useEffect(() => { if (tab === "crew") loadCrew(); }, [tab, stopId, dept]);

  async function act(body: any, reload: "bands" | "crew" = "bands") {
    setMsg("");
    const url = reload === "bands" ? "/api/admin/agreements" : "/api/admin/crew";
    const r = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error || "failed"); return; }
    reload === "bands" ? loadBands() : loadCrew();
  }

  const s = d?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input" value={routeId}
                onChange={e => setRouteId(Number(e.target.value))}>
          {routes.map(r => (
            <option key={r.id} value={r.id}>{r.name} {r.season ? `· ${r.season}` : ""}</option>
          ))}
        </select>
        <button className={`pill ${tab === "bands" ? "bg-neon/20 text-neon" : ""}`}
                onClick={() => setTab("bands")}>Band paperwork</button>
        <button className={`pill ${tab === "crew" ? "bg-neon/20 text-neon" : ""}`}
                onClick={() => setTab("crew")}>Crew pool</button>
        {busy && <span className="text-muted text-xs">loading…</span>}
        {msg && <span className="text-xs" style={{ color: "#fca5a5" }}>{msg}</span>}
      </div>

      {tab === "bands" && d && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="pill">{s.total} agreements</span>
            <span className="pill bg-neon/20 text-neon">{s.good_to_go} good to go</span>
            <span className="pill">{s.awaiting} awaiting</span>
            {s.declined > 0 && <span className="pill">{s.declined} declined</span>}
            {s.stale_version > 0 && (
              <span className="pill" style={{ color: "#fbbf24" }}>
                {s.stale_version} on an old version
              </span>
            )}
            {s.unpapered_bands > 0 && (
              <span className="pill" style={{ color: "#fca5a5" }}>
                {s.unpapered_bands} booked with no agreement
              </span>
            )}
          </div>

          {/* The dangerous case: booked onto a stop, no paperwork opened. */}
          {d.missing?.length > 0 && (
            <div className="card p-4 space-y-2" style={{ borderColor: "rgba(255,120,120,0.4)" }}>
              <div className="text-sm" style={{ color: "#fca5a5" }}>
                Booked on this ring with no agreement started
              </div>
              <div className="flex flex-wrap gap-2">
                {d.missing.map((b: any) => (
                  <button key={b.id} className="pill"
                    onClick={() => act({ action: "open", route_id: routeId,
                                         band_id: b.id, band_name: b.name })}>
                    + {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {d.agreements.map((a: any) => (
              <div key={a.id} className="card p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neon font-medium">{a.band_name || `band ${a.band_id}`}</span>
                  <span className="pill">{a.status}</span>
                  {a.good_to_go && <span className="pill bg-neon/20 text-neon">good to go</span>}
                  {a.stale_version && (
                    <span className="pill" style={{ color: "#fbbf24" }}>
                      sent v{a.version}, now v{d.version}
                    </span>
                  )}
                  <span className="text-muted text-xs">
                    {a.members_ack}/{a.members} members confirmed
                  </span>
                  {a.open_feedback > 0 && (
                    <span className="pill" style={{ color: "#fbbf24" }}>
                      {a.open_feedback} recommendation{a.open_feedback > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {a.outstanding?.length > 0 && (
                  <div className="text-xs text-muted">
                    waiting on:{" "}
                    {a.outstanding.map((m: any) =>
                      `${m.name || m.email}${m.role === "controller" ? " (leads)" : ""}`).join(", ")}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {a.status === "draft" && (
                    <button className="pill" onClick={() => act({ action: "sent", agreement_id: a.id })}>
                      mark sent
                    </button>
                  )}
                  {a.outstanding?.map((m: any) => (
                    <button key={m.email} className="pill"
                      onClick={() => act({ action: "acknowledge", agreement_id: a.id, email: m.email })}>
                      ✓ {m.name || m.email} confirmed
                    </button>
                  ))}
                  {a.status !== "declined" && (
                    <button className="pill" style={{ color: "#fca5a5" }}
                      onClick={() => {
                        const why = prompt("Why did they pass?") ?? "";
                        act({ action: "decline", agreement_id: a.id, why });
                      }}>
                      passed
                    </button>
                  )}
                  <a className="pill" href="/api/legal/ring-contract" download>download terms</a>
                </div>
              </div>
            ))}
          </div>

          {d.feedback?.length > 0 && (
            <div className="card p-4 space-y-2">
              <div className="text-neon text-sm">
                Recommendations from bands — input for the terms review
              </div>
              {d.feedback.map((f: any) => (
                <div key={f.id} className="text-xs text-muted border-t border-white/5 pt-2">
                  <b className="text-cyan">{f.band_name || "band"}</b>
                  {f.section ? ` · ${f.section}` : ""} · v{f.version} · {f.status}
                  <div className="pt-1">{f.body}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "crew" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input" value={stopId}
                    onChange={e => setStopId(Number(e.target.value))}>
              <option value={0}>Whole directory</option>
              {stops.map((s: any) => (
                <option key={s.id} value={s.id}>{s.city} · {s.date}</option>
              ))}
            </select>
            <select className="input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">All departments</option>
              {(crew?.departments || []).map((x: string) => (
                <option key={x} value={x}>{x.replace(/_/g, " ")}</option>
              ))}
            </select>
            {!stopId && (
              <>
                <input className="input" placeholder="name, town, credits, gear"
                       value={q} onChange={e => setQ(e.target.value)}
                       onKeyDown={e => e.key === "Enter" && loadCrew()} />
                <button className="pill" onClick={loadCrew}>search</button>
              </>
            )}
          </div>

          {crew?.gaps?.length > 0 && (
            <div className="card p-3 text-xs" style={{ borderColor: "rgba(255,200,60,0.35)" }}>
              <b style={{ color: "#fbbf24" }}>No one in the pool for:</b>{" "}
              {crew.gaps.join(", ").replace(/_/g, " ")} — these get imported or go unfilled.
            </div>
          )}

          {crew?.counts && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="pill">{crew.counts.total} people</span>
              {crew.counts.local != null && (
                <span className="pill bg-neon/20 text-neon">{crew.counts.local} local</span>
              )}
              {crew.counts.runout != null && <span className="pill">{crew.counts.runout} runout</span>}
              {crew.counts.pending != null && <span className="pill">{crew.counts.pending} pending review</span>}
              {crew.counts.blocked > 0 && (
                <span className="pill" style={{ color: "#fca5a5" }}>
                  {crew.counts.blocked} cannot be paid yet
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            {(crew?.people || []).map((p: any) => (
              <div key={p.id} className="card p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neon font-medium">{p.name}</span>
                  <span className="text-muted text-xs">{p.city}, {p.region}</span>
                  {p.band && (
                    <span className={`pill ${p.band === "local" ? "bg-neon/20 text-neon" : ""}`}>
                      {p.band}{p.distance_km != null ? ` · ${p.distance_km}km` : ""}
                    </span>
                  )}
                  <span className="pill">{p.status}</span>
                  {p.career_stage && p.career_stage !== "working" && (
                    <span className="pill">{String(p.career_stage).replace(/_/g, " ")}</span>
                  )}
                  {p.years_exp ? <span className="text-muted text-xs">{p.years_exp}y</span> : null}
                </div>

                <div className="text-xs text-muted">
                  {String(p.departments || "").replace(/,/g, " · ").replace(/_/g, " ")}
                  {p.roles ? ` — ${p.roles}` : ""}
                </div>
                {p.prior_credits && (
                  <div className="text-xs text-muted italic">{p.prior_credits}</div>
                )}
                {(p.gear || p.vehicle || p.tickets) && (
                  <div className="text-xs text-muted">
                    {[p.gear, p.vehicle, p.tickets].filter(Boolean).join(" · ")}
                  </div>
                )}

                {p.readiness && !p.readiness.payable && (
                  <div className="text-xs" style={{ color: "#fca5a5" }}>
                    {p.readiness.blockers.join(" ")}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {p.status === "pending" && (
                    <button className="pill bg-neon/20 text-neon"
                      onClick={() => act({ action: "status", id: p.id, status: "active" }, "crew")}>
                      approve
                    </button>
                  )}
                  {p.status === "active" && (
                    <button className="pill"
                      onClick={() => act({ action: "status", id: p.id, status: "paused" }, "crew")}>
                      pause
                    </button>
                  )}
                  {stopId > 0 && p.status === "active" && (
                    <button className="pill"
                      onClick={() => act({ action: "invite", id: p.id, stop_id: stopId,
                                           route_id: routeId }, "crew")}>
                      invite to this stop
                    </button>
                  )}
                  {!p.tax_form_on_file && (
                    <button className="pill"
                      onClick={() => act({ action: "paperwork", id: p.id,
                                           tax_form: p.country === "US" ? "W-9" : "none",
                                           tax_form_on_file: 1,
                                           work_auth_ok: p.work_auth_ok ? 1 : 0 }, "crew")}>
                      mark paperwork on file
                    </button>
                  )}
                </div>
              </div>
            ))}
            {crew && (crew.people || []).length === 0 && (
              <div className="card p-4 text-sm text-muted">
                Nobody in the pool matches that yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
