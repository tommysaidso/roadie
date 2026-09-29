"use client";
import { useEffect, useState } from "react";
import Collapse from "./Collapse";
import {
  Route as RouteIcon, Tent, Gavel, Users, HardHat, ShieldAlert,
  Check, MapPin, Car, Star, Clapperboard, Truck, Tv,
} from "lucide-react";
import RingIntel from "./RingIntel";
import RoadieTVGrid from "./RoadieTVGrid";
import RouteBids from "./RouteBids";

const TABS = [
  { key: "ring",     label: "Ring intel",  icon: MapPin },
  { key: "routes",   label: "Routes",      icon: RouteIcon },
  { key: "stops",    label: "Stops",       icon: Tent },
  { key: "bids",     label: "Ground bids", icon: Gavel },
  { key: "ringbids", label: "Ring bids",   icon: Star },
  { key: "bill",     label: "The bill",    icon: Users },
  { key: "crew",     label: "Event crew",  icon: Clapperboard },
  { key: "roadietv", label: "RoadieTV",    icon: Tv },
  { key: "advance",  label: "Advance",     icon: HardHat },
];

// The crew that travels with the ring, grouped the way a call sheet reads.
const DEPARTMENTS = [
  ["film", "Film unit"], ["production", "Production"], ["transport", "Transport"],
  ["sound", "Sound"], ["lighting", "Lighting"], ["support", "Support"],
  ["medical", "Medical"], ["security", "Security"],
];

const SCALE: Record<string, string> = {
  popup: "Pop-up", small_ring: "Small ring", mid_ring: "Mid ring", full_ring: "Full ring",
};

export default function AdminConsole({ routes, stops, bids, interest, crew, totals }: any) {
  const [me, setMe] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState("ring");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json())
      .then(d => { setMe(d.user); setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  // Must match lib/roles.ts isOperator. A local ["admin","operator"] list locked
  // out every real account: grantedRole() only ever issues "super_admin" or
  // "manager", so the platform owner failed his own admin check.
  const elevated = !!me && ["super_admin", "manager", "admin", "operator"].includes(String(me.role));

  if (!checked) return <div className="card p-6 text-sm text-muted">Checking access…</div>;
  if (!elevated) {
    return (
      <div className="card p-6">
        <div className="text-lg font-black flex items-center gap-2">
          <ShieldAlert size={18} style={{ color: "#e05c7a" }} />Operators only
        </div>
        <p className="text-sm text-muted mt-2">
          This console builds the route behind the scenes. If you&rsquo;re a band, everything
          you need is on <a href="/ring" className="text-cyan hover:underline">The Ring</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[200px_1fr] gap-4">
      {/* left-column tab rail — admin-only controls, kept out of the main nav */}
      <aside className="lg:sticky lg:top-4 h-fit">
        <div className="card p-2 space-y-1">
          {TABS.map(t => {
            const I = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left ${
                  tab === t.key ? "bg-panel2 text-white" : "text-muted hover:text-white hover:bg-panel2"}`}>
                <I size={16} />{t.label}
              </button>
            );
          })}
        </div>
        <div className="card p-3 mt-3 space-y-1.5 text-xs">
          <Row k="Stops" v={totals.stops ?? 0} />
          <Row k="Ground bids" v={totals.bids ?? 0} />
          <Row k="Acts in" v={totals.acts ?? 0} />
          <Row k="Event crew" v={totals.crew ?? 0} warn={!totals.crew} />
          <Row k="No advance" v={totals.unassigned ?? 0} warn={!!totals.unassigned} />
        </div>
      </aside>

      <section className="min-w-0">
        {tab === "ring" && <RingIntel />}
        {tab === "ringbids" && <RouteBids />}
        {tab === "routes" && <Routes routes={routes} />}
        {tab === "stops" && <Stops stops={stops} />}
        {tab === "bids" && <Bids bids={bids} />}
        {tab === "bill" && <Bill interest={interest} />}
        {tab === "crew" && <Crew crew={crew} />}
        {tab === "roadietv" && <RoadieTVGrid routes={routes} stops={stops} crew={crew} />}
        {tab === "advance" && <Advance stops={stops} />}
      </section>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: any; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{k}</span>
      <span className={warn ? "text-amber font-bold" : "text-white font-bold"}>{v}</span>
    </div>
  );
}

function Empty({ children }: any) { return <div className="card p-4 text-sm text-muted">{children}</div>; }

function Routes({ routes }: any) {
  if (!routes.length) return <Empty>No routes yet. A route is the tour the ring travels — sponsors buy it whole or by arc.</Empty>;
  return (
    <div className="space-y-3">
      {routes.map((r: any) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="text-lg font-bold">{r.name}</div>
              <div className="text-sm text-muted">{r.arc} · {r.season}</div>
            </div>
            <div className="text-right">
              <span className="pill">{r.status}</span>
              <div className="text-xs text-muted mt-1">{r.start_date} → {r.end_date}</div>
            </div>
          </div>
          <div className="text-sm mt-2">{r.stop_count} stops</div>
          {r.notes && <div className="text-xs text-muted mt-1">{r.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function Stops({ stops }: any) {
  if (!stops.length) return <Empty>No stops yet.</Empty>;
  return (
    <div className="space-y-2">
      {stops.map((s: any) => (
        <div key={s.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="font-bold flex items-center gap-2">
                <span className="text-muted text-xs">#{s.seq}</span>{s.city}
                <span className="pill">{SCALE[s.site_scale] || s.site_scale}</span>
              </div>
              <div className="text-sm text-muted flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1"><MapPin size={13} />{s.site_name || s.site_kind}</span>
                <span className="flex items-center gap-1"><Users size={13} />{s.capacity ?? "—"}</span>
                <span className="flex items-center gap-1"><Car size={13} />{s.lot_spaces ?? "—"}</span>
                {!!s.camping && <span>camping</span>}
              </div>
            </div>
            <div className="text-right">
              <span className="pill">{s.date}</span>
              <div className="mt-1"><span className="pill">{s.status}</span></div>
            </div>
          </div>
          <div className="text-xs text-muted mt-2 flex flex-wrap gap-3">
            <span>{s.bids} bids</span><span>{s.acts_in} acts</span>
            <span>{s.host_asks} host asks</span><span>{s.vendors} vendors</span>
            <span>{s.crew} crew</span>
            <span className={s.permit_status === "approved" ? "" : "text-amber"}>permit: {s.permit_status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Bids({ bids }: any) {
  if (!bids.length) return <Empty>No ground bids in yet. Sites apply from <a href="/host" className="text-cyan hover:underline">Host the Ring</a>.</Empty>;
  return (
    <div className="space-y-2">
      {bids.map((b: any) => (
        <div key={b.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="font-bold">{b.applicant_name}</div>
              <div className="text-sm text-muted">
                {String(b.applicant_kind).replace(/_/g, " ")} · {b.stop_city} · {b.stop_date}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-neon">{Math.round((b.score || 0) * 100)}</div>
              <span className="pill">{b.status}</span>
            </div>
          </div>
          <div className="text-xs text-muted mt-2 flex flex-wrap gap-3">
            <span>cap {b.capacity_offered ?? "—"}</span>
            <span>{b.parking_spaces ?? "—"} parking</span>
            <span>{b.local_crew_offered || 0} crew</span>
            {!!b.guarantee_offered && <span>CA${b.guarantee_offered}</span>}
            {!!b.ground_ready && <span className="text-neon"><Check size={11} className="inline" /> ground</span>}
            {!!b.power_onsite && <span className="text-neon"><Check size={11} className="inline" /> power</span>}
            {!!b.permit_help && <span className="text-neon"><Check size={11} className="inline" /> permit</span>}
          </div>
          {b.pitch && <div className="text-sm mt-2">{b.pitch}</div>}
        </div>
      ))}
    </div>
  );
}

function Bill({ interest }: any) {
  if (!interest.length) return <Empty>No bands have claimed a stop yet.</Empty>;
  return (
    <div className="space-y-2">
      {interest.map((i: any) => (
        <div key={i.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold flex items-center gap-2">
              {i.band}
              {!!i.wants_host && <span className="pill" style={{ borderColor: "#3ddc84", color: "#3ddc84" }}>
                <Star size={11} className="inline mr-1" />wants to host
              </span>}
            </div>
            <div className="text-xs text-muted">
              {i.genre} · {i.home_city} · draw {i.draw} → {i.stop_city} {i.stop_date}
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="pill">{String(i.wants_bill || "any").replace(/_/g, " ")}</span>
            <div className="text-muted mt-1">{i.travel_km ? `${i.travel_km} km` : "—"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Crew({ crew }: any) {
  if (!crew?.length) {
    return (
      <Empty>
        No event crew booked yet. This is the unit that travels <b>with</b> the ring —
        the film crew shooting the run, production, transport drivers and support.
        Town-by-town hires (load-in, gate, security) are tracked per stop under Advance.
      </Empty>
    );
  }
  return (
    <div className="space-y-4">
      {DEPARTMENTS.map(([key, label]) => {
        const list = crew.filter((c: any) => c.department === key);
        if (!list.length) return null;
        return (
          // Departments ship closed; the shut row still says how many are in it.
          <Collapse key={key} storageKey={`crew_${key}`} count={list.length}
            title={<span className="inline-flex items-center gap-1">
              {key === "film" ? <Clapperboard size={12} /> : key === "transport" ? <Truck size={12} /> : null}
              {label}
            </span>}>
            <div className="space-y-2">
              {list.map((c: any) => (
                <div key={c.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold">{c.name}{c.company ? <span className="text-muted font-normal"> · {c.company}</span> : null}</div>
                    <div className="text-xs text-muted">
                      {c.role || label}
                      {c.vehicle ? ` · ${c.vehicle}` : ""}
                      {c.travels_full_run
                        ? ` · full run${c.route_name ? ` (${c.route_name})` : ""}`
                        : c.stop_city ? ` · ${c.stop_city} ${c.stop_date}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="pill">{c.status}</span>
                    <div className="text-muted mt-1">{c.rate ? `CA$${c.rate}/${c.rate_unit || "day"}` : "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Collapse>
        );
      })}
    </div>
  );
}

// RoadieTV — the route is the season, each stop an episode. Nothing new has to
// be scheduled for it: the film unit already rides the run, every stop already
// has a date and a ground, and every band on the bill already generates branded
// art and clips. This view just reads the tour as a running order.
function RoadieTV({ routes, stops, crew }: any) {
  const film = (crew || []).filter((c: any) => c.department === "film");
  if (!routes.length) return <Empty>No routes yet — a season is a route, so build one first.</Empty>;

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="text-lg font-black flex items-center gap-2"><Tv size={18} className="text-neon" />RoadieTV — The Ring Tours</div>
        <p className="text-sm text-muted mt-1">
          A documentary rock &amp; music-culture series shot off the tour itself. The route
          is the season, each stop is an episode, and the hometown act that wins the host
          slot is that episode&rsquo;s story. Footage comes from the film unit riding the run;
          band art and clips already carry the mymymy.studio mark, so everything cut into
          an episode points home.
        </p>
        <div className="text-xs text-muted mt-2">
          {film.length
            ? <>Film unit booked: {film.map((c: any) => c.name).join(", ")}</>
            : <span className="text-amber">No film unit booked yet — add crew under Event crew, department “film”.</span>}
        </div>
      </div>

      {routes.map((r: any) => {
        const eps = stops.filter((s: any) => Number(s.route_id) === Number(r.id));
        return (
          <div key={r.id}>
            <div className="label mb-2">Season · {r.name} <span className="text-muted">· {eps.length} episodes</span></div>
            <div className="space-y-2">
              {eps.map((s: any, i: number) => (
                <div key={s.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-bold">
                      <span className="text-muted text-xs mr-2">EP{String(i + 1).padStart(2, "0")}</span>
                      {s.city}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {s.site_name || s.site_kind} · {s.date}
                      {s.host_asks ? ` · ${s.host_asks} hometown act${s.host_asks === 1 ? "" : "s"} want the slot` : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <span className="pill">{SCALE[s.site_scale] || s.site_scale}</span>
                    <div className={`mt-1 ${s.advance_status === "cleared" ? "text-muted" : "text-amber"}`}>
                      {s.acts_in || 0} acts · advance {s.advance_status}
                    </div>
                  </div>
                </div>
              ))}
              {!eps.length && <Empty>No stops on this route yet.</Empty>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Advance({ stops }: any) {
  const open = stops.filter((s: any) => s.advance_status !== "cleared");
  if (!open.length) return <Empty>Every stop is scouted and cleared.</Empty>;
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted mb-1">
        Every stop needs a location manager on the ground before the rig rolls.
      </div>
      {open.map((s: any) => (
        <div key={s.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold">{s.city} <span className="text-xs text-muted">{s.date}</span></div>
            <div className="text-xs text-muted">{s.site_name || s.site_kind}</div>
          </div>
          <div className="text-right text-xs">
            <span className="pill" style={
              s.advance_status === "unassigned" ? { borderColor: "#e05c7a", color: "#e05c7a" } : {}
            }>{s.advance_status}</span>
            <div className="text-muted mt-1">{s.location_manager || "no manager"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
