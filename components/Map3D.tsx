"use client";
import { useEffect, useRef, useState } from "react";

// Cesium 3D map, the default ROADIE map since 2026-11-03.
//
// Why 3D is the default and not just a toggle: on a phone the flat Google map
// stacked into a long scroll (map, then legend, then the stop list) and the
// map itself read as one big province of grey. The 3D view is the whole story
// in one frame: the night globe, the corridors drawn as light, and the camera
// flying down from the province to the town and the room. It is also the same
// visual language as Location Scout in FIOS, so ROADIE and the production side
// look like one system. The flat map stays one tap away (the parent's toggle)
// for drive-time detail and for phones that cannot run WebGL.
//
// Display only: the parent computes the route (OSRM) and POIs (Overpass) and
// hands them in. Rendering is on demand (requestRenderMode) so an idle globe
// costs a phone nothing.

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
    css.rel = "stylesheet"; css.href = BASE + "Widgets/widgets.css"; document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = BASE + "Cesium.js"; s.async = true;
    s.onload = () => resolve((globalThis as any).Cesium);
    s.onerror = () => { cesiumPromise = null; reject(new Error("cesium failed")); };
    document.head.appendChild(s);
  });
  return cesiumPromise;
}

/** True when the browser can give us a WebGL context. Checked before Cesium loads. */
export function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

type V = { id: number; name: string; city: string; lat: number; lng: number; capacity?: number };
type Pt = { id: string | number; name: string; sub?: string; lat: number; lng: number };

const VENUE = "#7c8cff", ROUTE = "#3df0ff", GAS = "#ffb33d", STAY = "#7cf3a0", BAND = "#ff3d6e";

export default function Map3D({
  token, venues, stops = [], routeLine = null, pois = [], extra = [], center, onAddStop, actionLabel = "+ Add to run",
  onFail, className = "",
}: {
  token: string; venues: V[]; stops?: V[];
  routeLine?: [number, number][] | null;
  pois?: { lat: number; lng: number; gas: boolean }[];
  extra?: Pt[];                                 // secondary points (bands on /map)
  center?: { lat: number; lng: number };
  onAddStop?: (v: V) => void;                   // the card's action; omitted = info only
  actionLabel?: string;
  onFail?: () => void;                          // no WebGL / Cesium blocked: parent falls back to 2D
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const S = useRef<any>({ viewer: null, Cesium: null, routeEnt: null, stopEnts: [], poiEnts: [], buildings: null });
  const readyRef = useRef(false);
  const lastStops = useRef(0);
  const lastRoute = useRef<[number, number][] | null>(null);
  const [picked, setPicked] = useState<V | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; t: string } | null>(null);
  const [buildings, setBuildings] = useState(true);
  const [loading, setLoading] = useState(true);

  const fly = (lng: number, lat: number, height: number, pitchDeg = -38, duration = 1.6) => {
    const { viewer, Cesium } = S.current; if (!viewer) return;
    // Stand the camera back south of the target so the pitch looks north at it.
    const back = (height * Math.tan(Cesium.Math.toRadians(90 + pitchDeg))) / 111_000;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat - back, height),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(pitchDeg), roll: 0 },
      duration,
    });
  };

  useEffect(() => {
    if (!token || !webglOk()) { onFail?.(); return; }
    let viewer: any; let alive = true;
    loadCesium().then(async (Cesium: any) => {
      if (!alive || !el.current) return;
      Cesium.Ion.defaultAccessToken = token;
      try {
        viewer = new Cesium.Viewer(el.current, {
          animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
          homeButton: false, sceneModePicker: false, navigationHelpButton: false,
          fullscreenButton: false, selectionIndicator: false, infoBox: false,
          requestRenderMode: true, maximumRenderTimeChange: Infinity,
        });
      } catch { onFail?.(); return; }
      const scene = viewer.scene;
      // Night look: dimmed, desaturated imagery under a dark sky, so the venues
      // and the route carry the colour.
      scene.backgroundColor = Cesium.Color.fromCssColorString("#05060d");
      scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b0d18");
      const base = viewer.imageryLayers.get(0);
      if (base) { base.brightness = 0.5; base.contrast = 1.2; base.saturation = 0.35; base.gamma = 1.15; }
      scene.globe.showGroundAtmosphere = true;
      if (scene.skyAtmosphere) scene.skyAtmosphere.brightnessShift = -0.35;
      scene.fog.enabled = true;
      scene.screenSpaceCameraController.minimumZoomDistance = 400;
      try { scene.globe.terrainProvider = viewer.terrainProvider = await Cesium.createWorldTerrainAsync(); } catch {}
      if (!alive) return;

      venues.forEach((v) => {
        if (!v.lat) return;
        viewer.entities.add({
          id: "venue-" + v.id, position: Cesium.Cartesian3.fromDegrees(v.lng, v.lat),
          point: {
            pixelSize: 9, color: Cesium.Color.fromCssColorString(VENUE), outlineColor: Cesium.Color.fromCssColorString("#0b0b0f"), outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7,
            scaleByDistance: new Cesium.NearFarScalar(2e4, 1.6, 4e6, 0.7),
          },
          properties: { venue: v },
        });
      });
      extra.forEach((p) => {
        if (!p.lat) return;
        viewer.entities.add({
          id: "extra-" + p.id, position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
          point: {
            pixelSize: 7, color: Cesium.Color.fromCssColorString(BAND).withAlpha(0.9), outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7,
            scaleByDistance: new Cesium.NearFarScalar(2e4, 1.4, 4e6, 0.6),
          },
          properties: { extra: p },
        });
      });

      const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((click: any) => {
        const hit = scene.pick(click.position);
        const v = hit?.id?.properties?.venue?.getValue?.();
        if (v) { setPicked(v); fly(v.lng, v.lat, 18_000, -35, 1.4); }
        else setPicked(null);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction((m: any) => {
        const hit = scene.pick(m.endPosition);
        const v = hit?.id?.properties?.venue?.getValue?.();
        const p = hit?.id?.properties?.extra?.getValue?.();
        const t = v ? `${v.name} · ${v.city}` : p ? `${p.name}${p.sub ? " · " + p.sub : ""}` : "";
        setHover(t ? { x: m.endPosition.x, y: m.endPosition.y, t } : null);
        scene.canvas.style.cursor = t ? "pointer" : "";
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // Arrive from space: top-down over the region, then tilt down into it.
      const c = center || { lat: 52, lng: -121 };
      viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, 5_500_000) });
      S.current = { ...S.current, viewer, Cesium };
      readyRef.current = true;
      setLoading(false);
      fly(c.lng, c.lat, 650_000, -45, 2.6);
      draw();
    }).catch(() => { onFail?.(); });
    return () => { alive = false; try { viewer?.destroy(); } catch {} readyRef.current = false; };
  }, [token]);

  // 3D buildings: Cesium OSM Buildings, free with the ion token. Tiles only
  // stream when the camera is down at town level, so leaving it on is cheap.
  useEffect(() => {
    const { viewer, Cesium } = S.current; if (!readyRef.current || !viewer) return;
    let cancelled = false;
    (async () => {
      if (buildings && !S.current.buildings) {
        try {
          const t = await Cesium.createOsmBuildingsAsync();
          if (cancelled) return;
          t.style = new Cesium.Cesium3DTileStyle({ color: "color('#9fb0ff', 0.55)" });
          viewer.scene.primitives.add(t); S.current.buildings = t;
        } catch {}
      } else if (!buildings && S.current.buildings) {
        try { viewer.scene.primitives.remove(S.current.buildings); } catch {}
        S.current.buildings = null;
      }
      viewer.scene.requestRender();
    })();
    return () => { cancelled = true; };
  }, [buildings, loading]);

  function draw() {
    if (!readyRef.current) return;
    const { viewer, Cesium } = S.current;
    if (S.current.routeEnt) { viewer.entities.remove(S.current.routeEnt); S.current.routeEnt = null; }
    S.current.stopEnts.forEach((e: any) => viewer.entities.remove(e)); S.current.stopEnts = [];
    S.current.poiEnts.forEach((e: any) => viewer.entities.remove(e)); S.current.poiEnts = [];
    if (routeLine && routeLine.length) {
      const flat: number[] = []; routeLine.forEach(([lng, lat]) => { flat.push(lng, lat); });
      S.current.routeEnt = viewer.entities.add({
        polyline: { positions: Cesium.Cartesian3.fromDegreesArray(flat), width: 6, clampToGround: true, material: Cesium.Color.fromCssColorString(ROUTE) },
      });
    }
    stops.forEach((s, i) => {
      if (!s.lat) return;
      S.current.stopEnts.push(viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(s.lng, s.lat),
        point: { pixelSize: 16, color: Cesium.Color.fromCssColorString(ROUTE), outlineColor: Cesium.Color.fromCssColorString("#0b0b0f"), outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7 },
        label: {
          text: `${i + 1}  ${s.city || s.name}`, font: "600 14px system-ui, sans-serif",
          fillColor: Cesium.Color.fromCssColorString("#0b0b0f"), showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(ROUTE).withAlpha(0.92), backgroundPadding: new Cesium.Cartesian2(8, 5),
          pixelOffset: new Cesium.Cartesian2(0, -24), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7,
          translucencyByDistance: new Cesium.NearFarScalar(3e6, 1, 8e6, 0),
        },
      }));
    });
    pois.forEach((p) => {
      S.current.poiEnts.push(viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
        point: { pixelSize: 7, color: Cesium.Color.fromCssColorString(p.gas ? GAS : STAY), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7 },
      }));
    });
    viewer.scene.requestRender();
  }

  useEffect(() => {
    draw();
    // A new road line frames the whole run at an angle; the first stop gets a fly-in.
    // The route arrives after the stop (OSRM is async), so it is keyed on the line itself.
    const { viewer, Cesium } = S.current;
    if (!readyRef.current || !viewer) return;
    if (routeLine && routeLine.length > 1 && routeLine !== lastRoute.current && S.current.routeEnt) {
      // Ground-clamped lines have no ready bounding sphere, so frame the points themselves.
      const pts = routeLine.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat));
      const sphere = Cesium.BoundingSphere.fromPoints(pts);
      viewer.camera.flyToBoundingSphere(sphere, {
        duration: 1.6, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-50), Math.max(sphere.radius * 3.2, 30_000)),
      });
      lastRoute.current = routeLine;
    } else if (stops.length === 1 && lastStops.current !== 1) {
      fly(stops[0].lng, stops[0].lat, 60_000, -40);
    }
    lastStops.current = stops.length;
  }, [stops, routeLine, pois, loading]);

  return (
    <div className={`relative w-full overflow-hidden rounded-xl ${className}`} style={{ background: "#05060d" }}>
      <div ref={el} className="absolute inset-0" />
      {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Loading the 3D map…</div>}
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-edge bg-ink/90 px-2 py-1 text-sm text-white"
          style={{ left: hover.x + 12, top: hover.y + 12 }}>{hover.t}</div>
      )}
      <button onClick={() => setBuildings((b) => !b)}
        className={`absolute right-2 top-2 z-10 rounded-full border px-3 py-1 text-sm backdrop-blur ${buildings ? "border-cyan text-white bg-ink/70" : "border-edge text-muted bg-ink/60"}`}
        title="3D buildings appear when you zoom into a town">Buildings {buildings ? "on" : "off"}</button>
      {picked && (
        <div className="absolute left-2 right-2 top-[76px] z-10 rounded-xl border border-edge bg-ink/90 p-3 backdrop-blur sm:left-auto sm:right-2 sm:w-72">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-white">{picked.name}</div>
              <div className="text-sm text-muted">{picked.city}{picked.capacity ? ` · cap ${picked.capacity}` : ""}</div>
            </div>
            <button onClick={() => setPicked(null)} className="px-1 text-base text-muted" aria-label="Close">✕</button>
          </div>
          {onAddStop && (
            <button onClick={() => { onAddStop(picked); setPicked(null); }} className="btn btn-neon mt-2 w-full text-sm">{actionLabel}</button>
          )}
        </div>
      )}
    </div>
  );
}
