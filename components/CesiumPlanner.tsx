"use client";
import { useEffect, useRef, useState } from "react";

// ROADIE Tour Planner on Cesium ion 3D terrain. Free stack, no Google billing:
//   Cesium  → the 3D map / terrain / venue points / route line
//   OSRM    → real road route + drive time (router.project-osrm.org, free)
//   Overpass→ fuel + hotels along the route (OSM, same source as the venues)

const CESIUM_VER = "1.121";
const BASE = `https://unpkg.com/cesium@${CESIUM_VER}/Build/Cesium/`;

let cesiumPromise: Promise<any> | null = null;
function loadCesium() {
  const g = globalThis as any;
  if (g.Cesium) return Promise.resolve(g.Cesium);
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise((resolve, reject) => {
    g.CESIUM_BASE_URL = BASE;
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = BASE + "Widgets/widgets.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = BASE + "Cesium.js"; s.async = true;
    s.onload = () => resolve((globalThis as any).Cesium);
    s.onerror = () => reject(new Error("Cesium failed to load"));
    document.head.appendChild(s);
  });
  return cesiumPromise;
}

const WINNIPEG_LNG = -97.14;
type V = { id: number; name: string; city: string; lat: number; lng: number; capacity?: number };

export default function CesiumPlanner({ token, venues, googleKey }: { token: string; venues: V[]; googleKey?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const S = useRef<any>({ viewer: null, Cesium: null, routeEnt: null, amenityEnts: [], photorealTiles: null });
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [stops, setStops] = useState<V[]>([]);
  const [info, setInfo] = useState("");
  const [showGas, setShowGas] = useState(false);
  const [showStay, setShowStay] = useState(false);
  const [photoreal, setPhotoreal] = useState(false);
  const [name, setName] = useState("");
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    if (!token) { setErr("No Cesium token (NEXT_PUBLIC_CESIUM_TOKEN)."); return; }
    let viewer: any;
    loadCesium().then(async (Cesium: any) => {
      if (!el.current) return;
      Cesium.Ion.defaultAccessToken = token;
      viewer = new Cesium.Viewer(el.current, {
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
        homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        fullscreenButton: false, selectionIndicator: false, infoBox: false,
      });
      viewer.scene.globe.enableLighting = true;
      try { viewer.terrainProvider = await Cesium.createWorldTerrainAsync(); } catch { /* ellipsoid fallback */ }
      // venue points
      venues.forEach((v) => {
        if (!v.lat) return;
        viewer.entities.add({
          id: "venue-" + v.id,
          position: Cesium.Cartesian3.fromDegrees(v.lng, v.lat),
          point: { pixelSize: 8, color: Cesium.Color.fromCssColorString("#7c8cff"),
                   outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
                   heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7 },
          properties: { venue: v },
        });
      });
      // click a venue → add stop
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        const v = picked?.id?.properties?.venue?.getValue?.();
        if (v) addStop(v);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      // frame BC/AB
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-121, 52, 1_400_000), duration: 0 });
      S.current = { viewer, Cesium, routeEnt: null, amenityEnts: [] };
      setReady(true);
    }).catch(() => setErr("Couldn't load Cesium — check the ion token."));
    return () => { try { viewer?.destroy(); } catch {} };
  }, [token]);

  const addStop = (v: V) => setStops((p) => (p.find((s) => s.id === v.id) ? p : [...p, v]));
  const removeStop = (id: number) => setStops((p) => p.filter((s) => s.id !== id));
  const reorder = (from: number, to: number) => setStops((p) => { const n = [...p]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });

  // recompute route on stop change
  useEffect(() => {
    if (!ready) return;
    const { viewer, Cesium } = S.current;
    if (S.current.routeEnt) { viewer.entities.remove(S.current.routeEnt); S.current.routeEnt = null; }
    clearAmenities();
    if (stops.length < 2) { setInfo(stops.length === 1 ? "Add another stop to draw the line." : "Click venue points to build your run."); return; }
    if (stops.length > 100) { setInfo("Trim the run — too many stops."); return; }
    const west = stops.some((s) => s.lng < WINNIPEG_LNG), east = stops.some((s) => s.lng > WINNIPEG_LNG);
    const wpg = west && east;
    const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
    setInfo("Routing…");
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((d) => {
        if (d.code !== "Ok" || !d.routes?.length) throw new Error("no route");
        const line = d.routes[0].geometry.coordinates as [number, number][];
        const flat: number[] = [];
        line.forEach(([lng, lat]) => { flat.push(lng, lat); });
        S.current.routeEnt = viewer.entities.add({
          polyline: { positions: Cesium.Cartesian3.fromDegreesArray(flat), width: 5, clampToGround: true,
                      material: Cesium.Color.fromCssColorString("#3df0ff") },
        });
        const km = Math.round(d.routes[0].distance / 1000);
        const mins = Math.round(d.routes[0].duration / 60);
        setInfo(`${stops.length} stops · ${km} km · ~${Math.floor(mins / 60)}h ${mins % 60}m drive${wpg ? " · ⚠ crosses Winnipeg — split into West + East lines" : ""}`);
        if (showGas || showStay) drawAmenities(line);
      })
      .catch(() => {
        // straight-line fallback so the map still shows the intent
        const flat: number[] = [];
        stops.forEach((s) => { flat.push(s.lng, s.lat); });
        S.current.routeEnt = viewer.entities.add({
          polyline: { positions: Cesium.Cartesian3.fromDegreesArray(flat), width: 4, clampToGround: true,
                      material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.fromCssColorString("#ff3d6e") }) },
        });
        setInfo(`${stops.length} stops · road routing unavailable (OSRM busy) — showing straight line${wpg ? " · ⚠ crosses Winnipeg" : ""}`);
      });
  }, [stops, ready]);

  useEffect(() => { if (ready && stops.length >= 2) { /* re-fetch amenities on toggle by re-running route */ setStops((p) => [...p]); } }, [showGas, showStay]);

  // Photoreal 3D cities — Google's photoreal tiles, opt-in so it only costs when
  // the user flips it on for the wow (Vancouver/Calgary etc.). Free Cesium
  // terrain+Bing is the base; this layers on top.
  useEffect(() => {
    if (!ready) return;
    const { viewer, Cesium } = S.current;
    (async () => {
      if (photoreal) {
        if (!googleKey) { setInfo("Photoreal cities need a Google Map Tiles key on the server."); setPhotoreal(false); return; }
        try {
          Cesium.GoogleMaps.defaultApiKey = googleKey;
          const t = await Cesium.createGooglePhotorealistic3DTilesetAsync();
          viewer.scene.primitives.add(t);
          S.current.photorealTiles = t;
          viewer.scene.globe.show = false;   // hide the base globe so tiles read cleanly
          setInfo("Photoreal 3D on — zoom into a city for textured buildings.");
        } catch {
          setInfo("Photoreal unavailable — enable the Google Map Tiles API on the key.");
          setPhotoreal(false);
        }
      } else if (S.current.photorealTiles) {
        try { viewer.scene.primitives.remove(S.current.photorealTiles); } catch {}
        S.current.photorealTiles = null;
        viewer.scene.globe.show = true;
      }
    })();
  }, [photoreal, ready]);

  function clearAmenities() { const { viewer } = S.current; S.current.amenityEnts.forEach((e: any) => viewer.entities.remove(e)); S.current.amenityEnts = []; }
  function drawAmenities(line: [number, number][]) {
    clearAmenities();
    if (!showGas && !showStay) return;
    const { viewer, Cesium } = S.current;
    // sample ~10 points along the route, one Overpass query per point cluster
    const step = Math.max(1, Math.floor(line.length / 10));
    const pts: [number, number][] = [];
    for (let i = 0; i < line.length; i += step) pts.push(line[i]);
    const around = pts.map(([lng, lat]) => {
      const parts: string[] = [];
      if (showGas) parts.push(`node["amenity"="fuel"](around:5000,${lat},${lng});`);
      if (showStay) parts.push(`node["tourism"~"hotel|motel"](around:8000,${lat},${lng});`);
      return parts.join("");
    }).join("");
    const q = `[out:json][timeout:25];(${around});out center 120;`;
    fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q))
      .then((r) => r.json())
      .then((d) => {
        const seen = new Set<string>();
        (d.elements || []).forEach((e: any) => {
          const lat = e.lat, lng = e.lon; if (!lat) return;
          const k = `${lat.toFixed(4)},${lng.toFixed(4)}`; if (seen.has(k)) return; seen.add(k);
          const gas = e.tags?.amenity === "fuel";
          const ent = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            point: { pixelSize: 6, color: Cesium.Color.fromCssColorString(gas ? "#ffb33d" : "#7cf3a0"),
                     outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
                     heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7 },
          });
          S.current.amenityEnts.push(ent);
        });
      }).catch(() => {});
  }

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
        <div ref={el} className="w-full rounded-xl overflow-hidden" style={{ height: "64vh", minHeight: 400, background: "#0e0e16" }} />
        {err && <div className="text-xs text-amber mt-2">{err}</div>}
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
        <div className="text-[11px] text-muted mb-2">Click venue points on the 3D map, then drag them into the order you&apos;ll drive. Skip any you don&apos;t want.</div>
        <div className="flex gap-2 mb-2 flex-wrap">
          <label className="pill text-[11px] cursor-pointer flex items-center gap-1"><input type="checkbox" checked={showGas} onChange={(e) => setShowGas(e.target.checked)} /> fuel</label>
          <label className="pill text-[11px] cursor-pointer flex items-center gap-1"><input type="checkbox" checked={showStay} onChange={(e) => setShowStay(e.target.checked)} /> hotels</label>
          <label className="pill text-[11px] cursor-pointer flex items-center gap-1" title="Google photoreal 3D — costs only when you turn it on"><input type="checkbox" checked={photoreal} onChange={(e) => setPhotoreal(e.target.checked)} /> 🏙 photoreal</label>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          {stops.length === 0 && <div className="text-xs text-muted py-6 text-center">No stops yet — click venue points on the map.</div>}
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
