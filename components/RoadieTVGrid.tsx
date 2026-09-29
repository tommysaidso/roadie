"use client";
import { useEffect, useState } from "react";
import Collapse from "./Collapse";
import { Tv, MapPin, FileCheck, Users, Loader2, X, Save, AlertTriangle, Clapperboard } from "lucide-react";

// RoadieTV as a shelf, not a list.
//
// Episodes were full-width rows stacked down the page — one season ate the
// screen and you still couldn't see an episode's detail or change anything.
// This is the boxed/tile layout you actually browse a season in: newest season
// first, EP01 first inside it, click a tile to open the episode and edit the
// things a shoot needs — location, permits, call times, payroll.

const SCALE: Record<string, string> = {
  popup: "Pop-up", small_ring: "Small ring", mid_ring: "Mid ring", full_ring: "Full ring",
};
const PERMIT_TONE: Record<string, string> = {
  none: "#e05c7a", applied: "#ffb33d", pending: "#ffb33d", approved: "#3ddc84", cleared: "#3ddc84",
};

export default function RoadieTVGrid({ routes, stops, crew }: any) {
  const [openId, setOpenId] = useState<number | null>(null);
  const film = (crew || []).filter((c: any) => c.department === "film");

  if (!routes?.length) {
    return <div className="card p-6 text-sm text-muted">No routes yet — a season is a route, so build one first.</div>;
  }

  // Newest season at the top: you work on the one coming up, not the one from
  // two years ago. Episodes stay in running order inside it.
  const seasons = [...routes].sort((a: any, b: any) =>
    String(b.start_date || b.season || "").localeCompare(String(a.start_date || a.season || "")));

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="text-lg font-black flex items-center gap-2"><Tv size={18} className="text-neon" />RoadieTV — The Ring Tours</div>
        <p className="text-sm text-muted mt-1">
          The route is the season, each stop is an episode, and the hometown act that wins
          the host slot is that episode&rsquo;s story. Click an episode to open its shoot sheet.
        </p>
        <div className="text-xs mt-2">
          {film.length
            ? <span className="text-muted">Film unit booked: {film.map((c: any) => c.name).join(", ")}</span>
            : <span style={{ color: "#ffb33d" }}>No film unit booked yet — add crew under Event crew, department “film”.</span>}
        </div>
      </div>

      {seasons.map((r: any, idx: number) => {
        const eps = stops
          .filter((s: any) => Number(s.route_id) === Number(r.id))
          .sort((a: any, b: any) => (Number(a.seq || 0) - Number(b.seq || 0)) || String(a.date).localeCompare(String(b.date)));
        return (
          // Seasons ship closed. The newest one opens itself, because that's the
          // one being worked on — the rest are archive until asked for.
          <Collapse key={r.id} storageKey={`season_${r.id}`} defaultOpen={idx === 0}
            title={r.name} count={`${eps.length} episode${eps.length === 1 ? "" : "s"}`}
            meta={`${r.arc ? `${r.arc} · ` : ""}${r.season || ""}`}>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {eps.map((s: any, i: number) => (
                <button key={s.id} onClick={() => setOpenId(s.id)}
                  className="text-left rounded-xl overflow-hidden border border-edge bg-panel2 hover:border-neon transition-colors">
                  {/* poster block — the tile face */}
                  <div className="aspect-video relative flex items-end p-3"
                    style={{ background: "linear-gradient(135deg,#1b1b22 0%,#2a2233 60%,#111 100%)" }}>
                    <div className="absolute top-2 left-2 text-[10px] font-black tracking-widest text-muted">
                      EP{String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="pill text-[9px]">{SCALE[s.site_scale] || s.site_scale}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-black truncate">{s.city}</div>
                      <div className="text-[11px] text-muted truncate">{s.site_name || s.site_kind}</div>
                    </div>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">{s.date}</span>
                    <span className="flex items-center gap-1 text-[10px]"
                      style={{ color: PERMIT_TONE[String(s.permit_status || "none")] || "#8c90b0" }}>
                      <FileCheck size={11} />{s.permit_status || "none"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Collapse>
        );
      })}

      {openId != null && <EpisodeSheet id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function EpisodeSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/stop?id=${id}`).then(r => r.json()).then(x => {
      setD(x);
      setForm(x.stop || {});
    }).catch(() => setMsg("Couldn't load that episode."));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const body: any = { id };
      for (const k of ["date","city","site_name","site_scale","capacity","lot_spaces","gates_at","curfew","power",
                       "permit_status","permit_notes","location_manager","location_manager_contact","advance_status","notes"]) {
        body[k] = form[k] ?? "";
      }
      const r = await fetch("/api/admin/stop", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const x = await r.json();
      if (!r.ok) { setMsg(x.error || "Save failed."); return; }
      setMsg("Saved.");
    } catch { setMsg("Save failed."); }
    finally { setBusy(false); }
  }

  const F = ({ label, k, ph, wide }: any) => (
    <label className={wide ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-widest text-muted mb-1">{label}</div>
      <input value={form[k] ?? ""} onChange={e => set(k, e.target.value)} placeholder={ph}
        className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-3xl my-8 p-5" onClick={e => e.stopPropagation()}>
        {!d ? (
          <div className="text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Loading episode…</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black flex items-center gap-2"><Clapperboard size={17} className="text-neon" />{d.stop.city}</div>
                <div className="text-xs text-muted">{d.route?.name} · {d.stop.site_name || d.stop.site_kind} · {d.stop.date}</div>
              </div>
              <button onClick={onClose} className="btn px-2" aria-label="close"><X size={15} /></button>
            </div>

            <div className="label mt-4 mb-2 flex items-center gap-1"><MapPin size={12} />Location &amp; call</div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Shoot date" k="date" ph="2027-09-03" />
              <F label="Town" k="city" />
              <F label="Site" k="site_name" ph="fairgrounds, hall, field" wide />
              <F label="Location manager" k="location_manager" />
              <F label="LM contact" k="location_manager_contact" ph="phone / email" />
              <F label="Gates" k="gates_at" ph="17:00" />
              <F label="Curfew" k="curfew" ph="23:00" />
              <F label="Capacity" k="capacity" />
              <F label="Parking spaces" k="lot_spaces" />
              <F label="Power" k="power" ph="shore / genny 100A" wide />
            </div>

            <div className="label mt-4 mb-2 flex items-center gap-1"><FileCheck size={12} />Permits</div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Status</div>
                <select value={form.permit_status ?? "none"} onChange={e => set("permit_status", e.target.value)}
                  className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon">
                  {["none","applied","pending","approved","cleared","refused"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <F label="Advance" k="advance_status" ph="unassigned / working / cleared" />
              <F label="Permit notes" k="permit_notes" ph="noise variance, road closure, liquor, fire marshal" wide />
            </div>

            <div className="label mt-4 mb-2 flex items-center gap-1"><Users size={12} />Payroll</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["episode crew / day", d.totals.episode_crew_day],
                ["full-run crew / day", d.totals.full_run_crew_day],
                ["local crew / day", d.totals.local_day],
              ].map(([l, v]: any) => (
                <div key={l} className="bg-ink/60 border border-edge rounded-xl p-2">
                  <div className="text-base font-black">${Number(v || 0).toLocaleString()}</div>
                  <div className="text-[10px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            {d.totals.local_unfilled > 0 && (
              <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "#ffb33d" }}>
                <AlertTriangle size={11} />{d.totals.local_unfilled} local crew position{d.totals.local_unfilled === 1 ? "" : "s"} still unfilled
              </div>
            )}
            {(d.event_crew.length > 0 || d.local_crew.length > 0) ? (
              <div className="mt-2 text-xs space-y-1">
                {d.event_crew.map((c: any) => (
                  <div key={`e${c.id}`} className="flex justify-between gap-2 border-b border-edge py-1">
                    <span className="truncate">{c.name} <span className="text-muted">· {c.department}{c.role ? `/${c.role}` : ""}{c.full_run ? " · full run" : ""}</span></span>
                    <span className="text-muted shrink-0">${Number(c.rate || 0).toLocaleString()}/{c.rate_unit || "day"}</span>
                  </div>
                ))}
                {d.local_crew.map((c: any) => (
                  <div key={`l${c.id}`} className="flex justify-between gap-2 border-b border-edge py-1">
                    <span className="truncate">{c.headcount}× {c.role} <span className="text-muted">· local{c.filled ? "" : " · UNFILLED"}</span></span>
                    <span className="text-muted shrink-0">${Number(c.rate || 0).toLocaleString()} ea</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted mt-2">No crew attached to this episode yet — add them under Event crew.</div>
            )}

            <div className="label mt-4 mb-2 flex items-center gap-1"><Users size={12} />In the round for this night</div>
            {d.candidates_note ? (
              <div className="text-[11px]" style={{ color: "#ffb33d" }}>{d.candidates_note}</div>
            ) : d.candidates?.length ? (
              <div className="text-xs space-y-1">
                {d.candidates.map((c: any) => (
                  <div key={c.band_id} className="flex items-start justify-between gap-3 border-b border-edge py-1.5">
                    <div className="min-w-0">
                      <div className="truncate">
                        {c.name}
                        <span className="text-muted"> · {c.home_city} · {c.km}km</span>
                      </div>
                      <div className="text-[10px] text-muted truncate">{c.reasons.join(" · ")}</div>
                    </div>
                    <span className="pill text-[10px] shrink-0">{Math.round(c.score * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted">
                No flagged acts in range yet. Bands turn on “Ready to play” in their Garage —
                {d.headliner ? ` anything badly blended with ${d.headliner.name} is filtered out automatically.` : " genre gating applies once a headliner is set."}
              </div>
            )}

            <div className="label mt-4 mb-2">Notes</div>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={3}
              className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm outline-none focus:border-neon" />

            <div className="flex items-center gap-3 mt-4">
              <button onClick={save} disabled={busy} className="btn btn-neon text-sm flex items-center gap-1">
                <Save size={14} />{busy ? "saving…" : "Save episode"}
              </button>
              {msg && <span className="text-xs text-muted">{msg}</span>}
              <span className="text-[11px] text-muted ml-auto">{d.hometown_acts} hometown act{d.hometown_acts === 1 ? "" : "s"} want this slot</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
