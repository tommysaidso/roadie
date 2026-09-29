"use client";
import { useEffect, useRef } from "react";

// Cesium 3D globe — display only (the 3D toggle). Route + POIs are computed by
// the parent and handed in; this just renders venue points, the route line on
// terrain, and amenity dots.

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
    s.onerror = () => reject(new Error("cesium failed"));
    document.head.appendChild(s);
  });
  return cesiumPromise;
}

type V = { id: number; name: string; city: string; lat: number; lng: number };

export default function Map3D({ token, venues, stops, routeLine, pois, onAddStop }: {
  token: string; venues: V[]; stops: V[];
  routeLine: [number, number][] | null;
  pois: { lat: number; lng: number; gas: boolean }[];
  onAddStop: (v: V) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const S = useRef<any>({ viewer: null, Cesium: null, routeEnt: null, poiEnts: [] });
  const readyRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    let viewer: any;
    loadCesium().then(async (Cesium: any) => {
      if (!el.current) return;
      Cesium.Ion.defaultAccessToken = token;
      viewer = new Cesium.Viewer(el.current, {
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
        homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        fullscreenButton: false, selectionIndicator: false, infoBox: false,
      });
      try { viewer.terrainProvider = await Cesium.createWorldTerrainAsync(); } catch {}
      venues.forEach((v) => {
        if (!v.lat) return;
        viewer.entities.add({
          id: "venue-" + v.id, position: Cesium.Cartesian3.fromDegrees(v.lng, v.lat),
          point: { pixelSize: 8, color: Cesium.Color.fromCssColorString("#7c8cff"), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7 },
          properties: { venue: v },
        });
      });
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        const v = picked?.id?.properties?.venue?.getValue?.();
        if (v) onAddStop(v);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-121, 52, 1_400_000), duration: 0 });
      S.current = { viewer, Cesium, routeEnt: null, poiEnts: [] };
      readyRef.current = true;
      draw();
    }).catch(() => {});
    return () => { try { viewer?.destroy(); } catch {} readyRef.current = false; };
  }, [token]);

  function draw() {
    if (!readyRef.current) return;
    const { viewer, Cesium } = S.current;
    if (S.current.routeEnt) { viewer.entities.remove(S.current.routeEnt); S.current.routeEnt = null; }
    S.current.poiEnts.forEach((e: any) => viewer.entities.remove(e)); S.current.poiEnts = [];
    if (routeLine && routeLine.length) {
      const flat: number[] = []; routeLine.forEach(([lng, lat]) => { flat.push(lng, lat); });
      S.current.routeEnt = viewer.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray(flat), width: 5, clampToGround: true, material: Cesium.Color.fromCssColorString("#3df0ff") } });
    }
    pois.forEach((p) => {
      const e = viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat), point: { pixelSize: 6, color: Cesium.Color.fromCssColorString(p.gas ? "#ffb33d" : "#7cf3a0"), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 1e7 } });
      S.current.poiEnts.push(e);
    });
  }

  useEffect(() => { draw(); }, [stops, routeLine, pois]);

  return <div ref={el} className="w-full rounded-xl overflow-hidden" style={{ height: "62vh", minHeight: 380, background: "#0e0e16" }} />;
}
