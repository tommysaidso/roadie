"use client";
import { useMemo, useState, useEffect } from "react";
import { Search, MapPin, Users, ChevronRight, Loader2, AlertTriangle, Film, DollarSign } from "lucide-react";
import { Tag } from "@/components/ui";
import VenueCalendarPanel from "@/components/VenueCalendarPanel";

// The rooms in ONE ring, browsable.
//
// This page used to render every venue in the database as an open card —
// hundreds of them, every ring at once, US fairgrounds sitting next to BC pubs
// because nothing was scoped to the selected hub. You couldn't find your own
// room without scrolling for a minute.
//
// Now: hub-scoped by the caller, collapsed by town, search-first.
export default function VenueBrowser({ venues, hubName, loopCities = [] }: { venues: any[]; hubName: string; loopCities?: string[] }) {
  const [q, setQ] = useState("");
  const [openTown, setOpenTown] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);

  const norm = (s: any) => String(s || "").toLowerCase().trim();

  // Small towns don't have two of the same room. A repeated name+town is a
  // scrape artefact, so collapse it to one card and mark it rather than
  // showing the operator the same pub three times.
  const deduped = useMemo(() => {
    const seen = new Map<string, any>();
    for (const v of venues) {
      const k = `${norm(v.name)}|${norm(v.city)}`;
      const prev = seen.get(k);
      if (!prev) { seen.set(k, { ...v, _dupes: 1 }); continue; }
      prev._dupes++;
      // keep the richest row — a claimed one, or one with a contact
      if ((v.user_id && !prev.user_id) || (v.contact && !prev.contact) || (v.capacity && !prev.capacity)) {
        seen.set(k, { ...v, _dupes: prev._dupes });
      }
    }
    return [...seen.values()];
  }, [venues]);

  const dupeCount = deduped.filter(v => v._dupes > 1).length;

  const hits = useMemo(() => {
    const term = norm(q);
    if (term.length < 2) return null;
    return deduped
      .filter(v => norm(v.name).includes(term) || norm(v.city).includes(term))
      .slice(0, 60);
  }, [q, deduped]);

  const towns = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const v of deduped) {
      const t = String(v.city || "—").trim();
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(v);
    }
    return [...m.entries()]
      .map(([town, list]) => ({
        town, list,
        claimed: list.filter(v => v.user_id).length,
      }))
      .sort((a, b) => b.list.length - a.list.length || a.town.localeCompare(b.town));
  }, [deduped]);

  // Map-first: clicking a pin on the map opens that town's list here.
  useEffect(() => {
    const onPick = (e: any) => {
      const city = String(e?.detail?.city || "").trim();
      if (!city) return;
      setOpenTown(city);
      if (!loopCities.some(c => norm(c) === norm(city))) setOthersOpen(true);
      setTimeout(() => document.getElementById("town-" + city)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    };
    window.addEventListener("roadie:venue-pick", onPick as any);
    return () => window.removeEventListener("roadie:venue-pick", onPick as any);
  }, [loopCities]);

  // The ring's loop_cities are the ~3-hour-apart tour stops — feature them and
  // fold the long tail so the page isn't 25 equal accordions. No loop → the six
  // biggest towns lead.
  const ringSet = new Set(loopCities.map(norm));
  const ringTowns = loopCities.length
    ? (loopCities.map(c => towns.find(t => norm(t.town) === norm(c))).filter(Boolean) as any[])
    : towns.slice(0, 6);
  const otherTowns = loopCities.length ? towns.filter(t => !ringSet.has(norm(t.town))) : towns.slice(6);

  const renderTown = ({ town, list, claimed }: any) => {
    const open = openTown === town;
    return (
      <div id={"town-" + town} key={town} className="card overflow-hidden">
        <button onClick={() => setOpenTown(open ? null : town)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-panel2">
          <span className="flex items-center gap-2 min-w-0">
            <ChevronRight size={13} className={`text-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
            <MapPin size={13} className="text-muted shrink-0" />
            <span className="font-semibold text-sm truncate">{town}</span>
          </span>
          <span className="text-[11px] text-muted shrink-0">
            {list.length} room{list.length === 1 ? "" : "s"}{claimed ? ` · ${claimed} claimed` : ""}
          </span>
        </button>
        {open && (
          <div className="grid md:grid-cols-2 gap-4 p-4 pt-0">
            {list.map((v: any) => <VenueCard key={v.id} v={v} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-ink border border-edge rounded-lg px-3">
            <Search size={15} className="text-muted shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder={`Search ${deduped.length} rooms in ${hubName} — name or town…`}
              className="flex-1 bg-transparent border-0 outline-none py-2 text-sm" />
            {q && <button onClick={() => setQ("")} className="text-muted text-xs hover:text-white">clear</button>}
          </div>
        </div>
        <div className="text-[11px] text-muted mt-2 flex flex-wrap gap-x-4">
          <span>{deduped.length} rooms · {towns.length} towns · {deduped.filter(v => v.user_id).length} claimed</span>
          {dupeCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#ffb33d" }}>
              <AlertTriangle size={11} />{dupeCount} name repeated in the same town — collapsed
            </span>
          )}
        </div>
      </div>

      {hits && (
        <div className="space-y-3">
          <div className="text-xs text-muted">{hits.length} match{hits.length === 1 ? "" : "es"}</div>
          <div className="grid md:grid-cols-2 gap-4">
            {hits.map(v => <VenueCard key={v.id} v={v} />)}
          </div>
          {!hits.length && <div className="card p-5 text-sm text-muted">Nothing by that name in this ring.</div>}
        </div>
      )}

      {!hits && (
        <>
          {ringTowns.length > 0 && (
            <div className="space-y-2">
              <div className="label px-1 pt-1">{loopCities.length ? `Ring stops · ${hubName}` : `Main towns · ${hubName}`}</div>
              {ringTowns.map(renderTown)}
            </div>
          )}
          {otherTowns.length > 0 && (
            <div className="space-y-2">
              <button onClick={() => setOthersOpen(o => !o)}
                className="w-full label px-1 pt-2 flex items-center gap-1 hover:text-white">
                <ChevronRight size={11} className="transition-transform" style={{ transform: othersOpen ? "rotate(90deg)" : "none" }} />
                Other towns nearby ({otherTowns.length})
              </button>
              {othersOpen && <div className="space-y-3">{otherTowns.map(renderTown)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ROLE_BADGE: Record<string, { label: string; color: string; icon: any }> = {
  film_location: { label: "film location",  color: "#ff3d6e", icon: Film },
  both:          { label: "film + revenue", color: "#3df0ff", icon: Film },
};

function VenueCard({ v }: { v: any }) {
  const role = ROLE_BADGE[v.site_role];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-lg font-bold min-w-0 truncate flex items-center gap-2">
          <span className="truncate">{v.name}</span>
          {(!v.user_id || v.member_status === "sample") && <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ border: "1px solid #ffb33d", color: "#ffb33d" }}>sample</span>}
        </div>
        <div className="shrink-0 flex flex-wrap gap-1 justify-end">
          {role && (
            <span className="pill flex items-center gap-1" style={{ borderColor: role.color, color: role.color }}>
              <role.icon size={11} />{role.label}
            </span>
          )}
          {(v.member_status === "sample" || !v.user_id) &&
            <span className="pill" style={{ borderColor: "#ffb33d", color: "#ffb33d" }}>⚑ claim this room</span>}
          {v.user_id && v.verification_status === "verified" &&
            <span className="pill" style={{ borderColor: "#3ddc84", color: "#3ddc84" }}>✓ verified</span>}
          {v.user_id && v.verification_status === "pending" &&
            <span className="pill" style={{ borderColor: "#3df0ff", color: "#3df0ff" }}>pending</span>}
        </div>
      </div>
      <div className="text-sm text-muted flex gap-3 mt-1 flex-wrap">
        <span className="flex items-center gap-1"><MapPin size={13} />{v.city}</span>
        {v.capacity ? <span className="flex items-center gap-1"><Users size={13} />cap {v.capacity}</span> : null}
        {v.pay_model && <span className="flex items-center gap-1"><DollarSign size={11} />{v.pay_model.replace("_"," ")}</span>}
        {v._dupes > 1 && <span style={{ color: "#ffb33d" }}>{v._dupes} listings merged</span>}
      </div>
      {v.genres ? <div className="mt-2">{String(v.genres).split(",").filter(Boolean).map((g: string) => <Tag key={g}>{g}</Tag>)}</div> : null}
      {v.notes ? <div className="text-xs text-muted mt-2 line-clamp-2">{v.notes}</div> : null}
      <VenueCalendarPanel venue={v} />
    </div>
  );
}
