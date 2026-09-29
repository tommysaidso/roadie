"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Tent, CalendarDays, ClipboardList, Star, PlaneTakeoff, Map as MapIcon,
  MapPin, Users, AlertTriangle, ChevronRight,
} from "lucide-react";
import BidThisRing from "./BidThisRing";

// The ring is the context. Every tab reads through it.
const TABS = [
  { key: "stops",  label: "Stops & bill", icon: Tent },
  { key: "cal",    label: "Calendar",     icon: CalendarDays },
  { key: "board",  label: "Notice board", icon: ClipboardList },
  { key: "bids",   label: "Get on it",    icon: Star },
  { key: "border", label: "Border",       icon: PlaneTakeoff },
];

const SCALE: Record<string, string> = {
  popup: "Pop-up", small_ring: "Small ring", mid_ring: "Mid ring", full_ring: "Full ring",
};

export default function TourWorkspace({ routes, stops, notices, hubs, hubName }: any) {
  const [routeId, setRouteId] = useState<number | null>(routes?.[0]?.id ?? null);
  const [tab, setTab] = useState("stops");

  const route = routes?.find((r: any) => Number(r.id) === Number(routeId)) || null;
  const mine = useMemo(
    () => (stops || []).filter((s: any) => Number(s.route_id) === Number(routeId)),
    [stops, routeId]);

  // Which hubs this ring actually touches — a run can cross several, and that's
  // what scopes the notice board and tells you if a border is even involved.
  const hubIds = useMemo(() => [...new Set(mine.map((s: any) => Number(s.hub_id)).filter(Boolean))], [mine]);
  const hubNames = hubIds.map(id => hubs?.find((h: any) => Number(h.id) === id)?.name).filter(Boolean);
  const countries = [...new Set(mine.map((s: any) => String(s.country || "CA")))];
  const crossesBorder = countries.length > 1;

  if (!routes?.length) {
    return <div className="card p-6 text-sm text-muted">No rings yet. Once a route is built it shows up here.</div>;
  }

  return (
    <div className="space-y-4">
      {/* the context bar — chosen once */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">Ring</span>
          <select value={routeId ?? ""} onChange={e => setRouteId(Number(e.target.value))}
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon">
            {routes.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}{r.season ? ` · ${r.season}` : ""} ({r.status})
              </option>
            ))}
          </select>
          <Link href="/map" className="btn text-xs flex items-center gap-1 ml-auto"><MapIcon size={13} />Map</Link>
          <Link href="/planner" className="btn text-xs">Plan a run</Link>
        </div>
        {route && (
          <div className="text-xs text-muted mt-2 flex flex-wrap gap-x-4">
            <span>{mine.length} stop{mine.length === 1 ? "" : "s"}</span>
            {route.start_date && <span>{route.start_date}{route.end_date ? ` → ${route.end_date}` : ""}</span>}
            {hubNames.length > 0 && <span>through {hubNames.join(" · ")}</span>}
            {route.theme && <span style={{ color: "#ff3d6e" }} className="font-semibold">"{route.theme}"</span>}
            {crossesBorder && <span style={{ color: "#ffb33d" }}>crosses a border</span>}
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto scroll">
        {TABS.map(t => {
          const I = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap flex items-center gap-1.5 ${
                tab === t.key ? "bg-panel2 text-white" : "text-muted hover:text-white hover:bg-panel2"}`}>
              <I size={14} />{t.label}
            </button>
          );
        })}
      </div>

      {tab === "stops" && <Stops stops={mine} />}
      {tab === "cal" && <Calendar stops={mine} />}
      {tab === "board" && <Board notices={notices} hubIds={hubIds} hubName={hubName} />}
      {tab === "bids" && <div><BidThisRing routes={routes} /></div>}
      {tab === "border" && <Border crosses={crossesBorder} countries={countries} />}
    </div>
  );
}

function Stops({ stops }: any) {
  if (!stops.length) return <div className="card p-5 text-sm text-muted">No stops on this ring yet.</div>;
  return (
    <div className="space-y-2">
      {stops.map((s: any, i: number) => (
        <div key={s.id} className="card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-2">
                <span className="text-muted text-xs">{String(i + 1).padStart(2, "0")}</span>
                {s.city}
                <span className="pill text-[10px]">{SCALE[s.site_scale] || s.site_scale}</span>
              </div>
              <div className="text-xs text-muted flex flex-wrap gap-x-3 mt-0.5">
                <span className="flex items-center gap-1"><MapPin size={11} />{s.site_name || s.site_kind}</span>
                <span>{s.date}</span>
                {s.gates_at && <span>gates {s.gates_at}</span>}
              </div>
            </div>
            <div className="text-right text-xs shrink-0">
              <div className="font-bold">{s.headliner || <span className="text-muted">no headliner yet</span>}</div>
              <div className="text-muted">
                {s.acts_in || 0} in · {s.host_asks || 0} want to host · {s.ground_bids || 0} ground bid{s.ground_bids === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          {(!s.lat || !s.lng) && (
            <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "#ffb33d" }}>
              <AlertTriangle size={11} />No coordinates — nothing can be matched to this stop.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Calendar({ stops }: any) {
  if (!stops.length) return <div className="card p-5 text-sm text-muted">Nothing scheduled on this ring.</div>;
  const byMonth: Record<string, any[]> = {};
  for (const s of stops) {
    const k = String(s.date || "").slice(0, 7) || "unscheduled";
    (byMonth[k] ||= []).push(s);
  }
  return (
    <div className="space-y-4">
      {Object.entries(byMonth).sort().map(([m, list]) => (
        <div key={m} className="card p-4">
          <div className="label mb-2">{m === "unscheduled" ? "No date yet" : m}</div>
          <div className="space-y-1">
            {list.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b border-edge last:border-0 py-1.5">
                <span className="text-sm">
                  <span className="text-muted text-xs mr-2">{String(s.date || "").slice(8) || "—"}</span>
                  {s.city}
                </span>
                <span className="text-xs text-muted truncate">{s.headliner || s.site_name || s.site_kind}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Board({ notices, hubIds, hubName }: any) {
  const scoped = (notices || []).filter((n: any) => !n.hub_id || hubIds.includes(Number(n.hub_id)));
  if (!scoped.length) {
    return (
      <div className="card p-5 text-sm text-muted">
        Nothing on the board for this ring{hubName ? ` (${hubName})` : ""} right now.{" "}
        <Link href="/board" className="text-cyan hover:underline">Open the full board</Link>.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {scoped.slice(0, 30).map((n: any) => (
        <div key={n.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold truncate">{n.title || n.kind || "Notice"}</div>
              <div className="text-xs text-muted">{n.body || n.note}</div>
            </div>
            <span className="text-[11px] text-muted shrink-0">{String(n.created_at || "").slice(0, 10)}</span>
          </div>
        </div>
      ))}
      <Link href="/board" className="text-xs text-cyan hover:underline inline-flex items-center gap-1">
        Full notice board <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function Border({ crosses, countries }: any) {
  return (
    <div className="card p-5">
      <div className="text-lg font-black flex items-center gap-2"><PlaneTakeoff size={17} className="text-neon" />Border &amp; visas</div>
      {crosses ? (
        <>
          <p className="text-sm text-muted mt-1">
            This ring runs through {countries.join(" and ")} — every act on the bill needs work
            authorisation for the crossing, and gear needs a carnet or a manifest.
          </p>
          <Link href="/crossing" className="btn btn-neon text-sm mt-3 inline-flex items-center gap-1">
            Open the crossing guide <ChevronRight size={13} />
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted mt-1">
          This ring stays inside {countries[0] || "one country"} — no border, no visas, no carnet.
          If a stop is added across the line this tab will say so.{" "}
          <Link href="/crossing" className="text-cyan hover:underline">Crossing guide</Link> is there anyway.
        </p>
      )}
    </div>
  );
}
