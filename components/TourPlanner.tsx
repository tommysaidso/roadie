"use client";
import { useEffect, useState } from "react";
import Map2D from "./Map2D";
import Map3D from "./Map3D";

// ROADIE Tour Planner. Default = flat, easy-to-read Google 2D map. Toggle for
// the Cesium 3D globe. Routing (OSRM) + fuel/hotels (Overpass) are computed here
// once and handed to whichever map is showing — both are free, no paid APIs.

const WINNIPEG_LNG = -97.14;
type V = { id: number; name: string; city: string; lat: number; lng: number; capacity?: number };

export default function TourPlanner({ venues, googleKey, cesiumToken }: {
  venues: V[]; googleKey?: string; cesiumToken?: string;
}) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [stops, setStops] = useState<V[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [pois, setPois] = useState<{ lat: number; lng: number; gas: boolean }[]>([]);
  const [showGas, setShowGas] = useState(false);
  const [showStay, setShowStay] = useState(false);
  const [info, setInfo] = useState("");
  const [name, setName] = useState("");
  const [drag, setDrag] = useState<number | null>(null);

  const addStop = (v: V) => setStops((p) => (p.find((s) => s.id === v.id) ? p : [...p, v]));
  const removeStop = (id: number) => setStops((p) => p.filter((s) => s.id !== id));
  const reorder = (from: number, to: number) => setStops((p) => { const n = [...p]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });

  // route via OSRM whenever the stops change
  useEffect(() => {
    if (stops.length < 2) { setRouteLine(null); setInfo(stops.length === 1 ? "Add another stop to draw the line." : "Click venue pins to build your run."); return; }
    if (stops.length > 100) { setInfo("Trim the run — too many stops."); return; }
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
        setInfo(`${stops.length} stops · ${km} km · ~${Math.floor(mins / 60)}h ${mins % 60}m drive${wpg ? " · ⚠ crosses Winnipeg — split into West + East lines" : ""}`);
      })
      .catch(() => { if (!cancelled) { setRouteLine(stops.map((s) => [s.lng, s.lat])); setInfo(`${stops.length} stops · road routing busy — straight line shown${wpg ? " · ⚠ crosses Winnipeg" : ""}`); } });
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
      setInfo(`Saved "${name.trim() || "tour"}" — ${stops.length} stops.`);
    } catch { setInfo("Couldn't save locally."); }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1 text-[11px]">
            <button onClick={() => setMode("2d")} className={`pill ${mode === "2d" ? "border-neon text-white" : "text-muted"}`}>2D map</button>
            {cesiumToken && <button onClick={() => setMode("3d")} className={`pill ${mode === "3d" ? "border-neon text-white" : "text-muted"}`}>3D globe</button>}
          </div>
          <span className="text-[10px] text-muted">{mode === "2d" ? "flat & easy" : "Cesium terrain"}</span>
        </div>
        {mode === "2d"
          ? (googleKey
              ? <Map2D apiKey={googleKey} venues={venues} stops={stops} routeLine={routeLine} pois={pois} onAddStop={addStop} />
              : <div className="text-sm text-muted p-6">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the 2D map.</div>)
          : <Map3D token={cesiumToken || ""} venues={venues} stops={stops} routeLine={routeLine} pois={pois} onAddStop={addStop} />}
        {info && <div className="mt-2 text-xs px-3 py-2 rounded-xl bg-panel2 text-ink border border-edge">{info}</div>}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#7c8cff" }} /> venue (click → add)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5" style={{ background: "#3df0ff" }} /> your route</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#ffb33d" }} /> fuel</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#7cf3a0" }} /> hotel</span>
        </div>
      </div>

      <div className="card p-3 flex flex-col">
        <div className="label mb-1">Your run — drag to reorder</div>
        <div className="text-[11px] text-muted mb-2">Click venue pins on the map, then drag them into the order you&apos;ll drive. Skip any you don&apos;t want.</div>
        <div className="flex gap-2 mb-2 flex-wrap">
          <label className="pill text-[11px] cursor-pointer flex items-center gap-1"><input type="checkbox" checked={showGas} onChange={(e) => setShowGas(e.target.checked)} /> fuel</label>
          <label className="pill text-[11px] cursor-pointer flex items-center gap-1"><input type="checkbox" checked={showStay} onChange={(e) => setShowStay(e.target.checked)} /> hotels</label>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          {stops.length === 0 && <div className="text-xs text-muted py-6 text-center">No stops yet — click venue pins on the map.</div>}
          {stops.map((s, i) => (
            <div key={s.id} draggable
              onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag !== null && drag !== i) reorder(drag, i); setDrag(null); }}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing ${drag === i ? "border-neon bg-white/5" : "border-edge bg-ink"}`}>
              <span className="text-muted w-5 text-center">⠿</span>
              <span className="w-5 h-5 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1"><div className="truncate text-white">{s.name}</div><div className="truncate text-[10px] text-muted">{s.city}</div></div>
              <button onClick={() => removeStop(s.id)} className="text-amber text-[11px] px-1" title="skip / remove">✕</button>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name this tour (e.g. West Line — Spring)" className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 text-xs" />
          <div className="flex gap-2">
            <button onClick={save} className="btn btn-neon flex-1 text-sm">Save tour</button>
            <button onClick={() => setStops([])} className="btn text-sm">Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}
