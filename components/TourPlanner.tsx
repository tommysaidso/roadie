"use client";
import { useEffect, useState } from "react";
import Map2D from "./Map2D";
import Map3D from "./Map3D";

// ROADIE Tour Planner. Default = the 3D map (Cesium): on a phone it keeps the
// whole run in one frame with the stop list as a sheet over the map, instead of
// a flat map stacked above a long list. The flat Google map is one tap away for
// drive-time detail, and is the automatic fallback when a device has no WebGL.
// The choice is remembered per browser. Routing (OSRM) + fuel/hotels (Overpass)
// are computed here once and handed to whichever map is showing.

const WINNIPEG_LNG = -97.14;
const MODE_KEY = "roadie_map_mode";
type V = { id: number; name: string; city: string; lat: number; lng: number; capacity?: number };

export default function TourPlanner({ venues, googleKey, cesiumToken }: {
  venues: V[]; googleKey?: string; cesiumToken?: string;
}) {
  const [mode, setMode] = useState<"2d" | "3d">(cesiumToken ? "3d" : "2d");
  const [stops, setStops] = useState<V[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [pois, setPois] = useState<{ lat: number; lng: number; gas: boolean }[]>([]);
  const [showGas, setShowGas] = useState(false);
  const [showStay, setShowStay] = useState(false);
  const [info, setInfo] = useState("");
  const [name, setName] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "2d" || (saved === "3d" && cesiumToken)) setMode(saved);
    } catch {}
  }, [cesiumToken]);
  const pick = (m: "2d" | "3d") => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch {} };

  const addStop = (v: V) => setStops((p) => (p.find((s) => s.id === v.id) ? p : [...p, v]));
  const removeStop = (id: number) => setStops((p) => p.filter((s) => s.id !== id));
  const reorder = (from: number, to: number) => setStops((p) => {
    if (to < 0 || to >= p.length) return p;
    const n = [...p]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n;
  });

  // route via OSRM whenever the stops change
  useEffect(() => {
    if (stops.length < 2) { setRouteLine(null); setInfo(stops.length === 1 ? "Add another stop to draw the line." : "Tap a venue on the map to start your run."); return; }
    if (stops.length > 100) { setInfo("Trim the run: too many stops."); return; }
    const west = stops.some((s) => s.lng < WINNIPEG_LNG), east = stops.some((s) => s.lng > WINNIPEG_LNG);
    const wpg = west && east;
    const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
    setInfo("Routing…");
    let cancelled = false;
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.code !== "Ok" || !d.routes?.length) throw new Error("no route");
        setRouteLine(d.routes[0].geometry.coordinates);
        const km = Math.round(d.routes[0].distance / 1000);
        const mins = Math.round(d.routes[0].duration / 60);
        setInfo(`${stops.length} stops · ${km} km · about ${Math.floor(mins / 60)}h ${mins % 60}m driving${wpg ? " · crosses Winnipeg: split into a West line and an East line" : ""}`);
      })
      .catch(() => { if (!cancelled) { setRouteLine(stops.map((s) => [s.lng, s.lat])); setInfo(`${stops.length} stops · road routing busy, straight line shown${wpg ? " · crosses Winnipeg" : ""}`); } });
    return () => { cancelled = true; };
  }, [stops]);

  // fuel/hotels via Overpass, sampled along the route
  useEffect(() => {
    if (!routeLine || (!showGas && !showStay)) { setPois([]); return; }
    const step = Math.max(1, Math.floor(routeLine.length / 10));
    const pts: [number, number][] = [];
    for (let i = 0; i < routeLine.length; i += step) pts.push(routeLine[i]);
    const around = pts.map(([lng, lat]) => {
      const parts: string[] = [];
      if (showGas) parts.push(`node["amenity"="fuel"](around:5000,${lat},${lng});`);
      if (showStay) parts.push(`node["tourism"~"hotel|motel"](around:8000,${lat},${lng});`);
      return parts.join("");
    }).join("");
    const q = `[out:json][timeout:25];(${around});out center 120;`;
    let cancelled = false;
    fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const seen = new Set<string>(); const out: any[] = [];
        (d.elements || []).forEach((e: any) => {
          if (!e.lat) return; const k = `${e.lat.toFixed(4)},${e.lon.toFixed(4)}`; if (seen.has(k)) return; seen.add(k);
          out.push({ lat: e.lat, lng: e.lon, gas: e.tags?.amenity === "fuel" });
        });
        setPois(out);
      }).catch(() => { if (!cancelled) setPois([]); });
    return () => { cancelled = true; };
  }, [routeLine, showGas, showStay]);

  const save = () => {
    if (stops.length < 2) return setInfo("Add at least 2 stops to save.");
    try {
      const list = JSON.parse(localStorage.getItem("roadie_tours") || "[]");
      list.unshift({ name: name.trim() || `Tour ${new Date().toISOString().slice(0, 10)}`, stops: stops.map((s) => ({ id: s.id, name: s.name, city: s.city })), saved_at: Date.now() });
      localStorage.setItem("roadie_tours", JSON.stringify(list.slice(0, 50)));
      setInfo(`Saved "${name.trim() || "tour"}": ${stops.length} stops.`);
    } catch { setInfo("Couldn't save on this device."); }
  };

  const mapH = "h-[64svh] min-h-[380px] lg:h-[72vh]";

  return (
    <div className="relative grid gap-3 lg:grid-cols-[1fr_340px]">
      <div className="card relative overflow-hidden p-2 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-1 text-sm">
            {cesiumToken && <button onClick={() => pick("3d")} className={`pill ${mode === "3d" ? "border-neon text-white" : "text-muted"}`}>3D map</button>}
            <button onClick={() => pick("2d")} className={`pill ${mode === "2d" ? "border-neon text-white" : "text-muted"}`}>Flat map</button>
          </div>
          <span className="hidden text-sm text-muted sm:inline">{mode === "3d" ? "drag to turn, pinch or scroll to fly in" : "flat and simple"}</span>
        </div>
        <div className="relative">
          {mode === "3d"
            ? <Map3D token={cesiumToken || ""} venues={venues} stops={stops} routeLine={routeLine} pois={pois} onAddStop={addStop}
                onFail={() => { setMode("2d"); setInfo("This device can't show the 3D map, so the flat map is on."); }} className={mapH} />
            : (googleKey
                ? <div className={mapH}><Map2D apiKey={googleKey} venues={venues} stops={stops} routeLine={routeLine} pois={pois} onAddStop={addStop} /></div>
                : <div className="p-6 text-sm text-muted">The flat map needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</div>)}
          {info && <div className="pointer-events-none absolute left-2 right-[132px] top-2 z-10 rounded-xl border border-edge bg-ink/85 px-3 py-2 text-sm text-white backdrop-blur sm:right-auto sm:max-w-[60%]">{info}</div>}
        </div>
        <div className="mt-2 hidden flex-wrap items-center gap-4 text-sm text-muted lg:flex">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#7c8cff" }} /> venue (tap to add)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5" style={{ background: "#3df0ff" }} /> your route</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#ffb33d" }} /> fuel</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#7cf3a0" }} /> hotel</span>
        </div>
      </div>

      {/* The run. A side panel on desktop; on a phone a sheet over the bottom of the map. */}
      <aside className={`card flex flex-col p-3 max-lg:absolute max-lg:left-3 max-lg:bottom-3 max-lg:z-20 max-lg:bg-ink/95 max-lg:backdrop-blur ${sheetOpen ? "max-lg:right-3 max-lg:max-h-[58svh]" : "max-lg:right-24 max-lg:overflow-hidden"}`}>
        <button onClick={() => setSheetOpen((o) => !o)} className="flex items-center justify-between text-left lg:pointer-events-none">
          <span className="label">Your run{stops.length ? ` · ${stops.length} stop${stops.length > 1 ? "s" : ""}` : ""}</span>
          <span className="text-base text-muted lg:hidden">{sheetOpen ? "▾" : "▴"}</span>
        </button>
        <div className={`flex min-h-0 flex-1 flex-col ${sheetOpen ? "" : "max-lg:hidden"}`}>
        <div className="mb-2 mt-1 text-sm text-muted">Tap venues on the map, then put them in the order you&apos;ll drive.</div>
        <div className="mb-2 flex flex-wrap gap-2">
          <label className="pill flex cursor-pointer items-center gap-1 text-sm"><input type="checkbox" checked={showGas} onChange={(e) => setShowGas(e.target.checked)} /> fuel</label>
          <label className="pill flex cursor-pointer items-center gap-1 text-sm"><input type="checkbox" checked={showStay} onChange={(e) => setShowStay(e.target.checked)} /> hotels</label>
        </div>
        <div className="min-h-[80px] flex-1 space-y-1 overflow-y-auto">
          {stops.length === 0 && <div className="py-6 text-center text-sm text-muted">No stops yet. Tap a venue on the map.</div>}
          {stops.map((s, i) => (
            <div key={s.id} draggable
              onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag !== null && drag !== i) reorder(drag, i); setDrag(null); }}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${drag === i ? "border-neon bg-white/5" : "border-edge bg-ink"}`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan/20 text-sm font-bold text-cyan">{i + 1}</span>
              <div className="min-w-0 flex-1"><div className="truncate text-white">{s.name}</div><div className="truncate text-sm text-muted">{s.city}</div></div>
              <button onClick={() => reorder(i, i - 1)} disabled={i === 0} className="px-1 text-base text-muted disabled:opacity-30" aria-label="Move up">↑</button>
              <button onClick={() => reorder(i, i + 1)} disabled={i === stops.length - 1} className="px-1 text-base text-muted disabled:opacity-30" aria-label="Move down">↓</button>
              <button onClick={() => removeStop(s.id)} className="px-1 text-base text-amber" aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name this tour (e.g. West Line, Spring)" className="w-full rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button onClick={save} className="btn btn-neon flex-1 text-sm">Save tour</button>
            <button onClick={() => setStops([])} className="btn text-sm">Clear</button>
          </div>
        </div>
        </div>
      </aside>
    </div>
  );
}
