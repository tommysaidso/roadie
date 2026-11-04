"use client";
import { useEffect, useState } from "react";
import Map3D from "./Map3D";
import GoogleMap from "./GoogleMap";
import BCMap from "./BCMap";

// /map: 3D by default (same reasons as the tour planner: one frame on a phone,
// the same look as Location Scout), with the flat Google map one tap away for
// hotels, gas and drive-time directions. Shares the remembered choice with /planner.

const MODE_KEY = "roadie_map_mode";
type Box = { minLng: number; maxLng: number; minLat: number; maxLat: number };

export default function MapModes({ cesiumToken, googleKey, venues, bands, stops, center, zoom, box }: {
  cesiumToken: string; googleKey: string; venues: any[]; bands: any[]; stops: any[];
  center: { lat: number; lng: number }; zoom: number; box: Box;
}) {
  const [mode, setMode] = useState<"2d" | "3d">(cesiumToken ? "3d" : "2d");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "2d" || (saved === "3d" && cesiumToken)) setMode(saved);
    } catch {}
  }, [cesiumToken]);
  const pick = (m: "2d" | "3d") => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch {} };
  const runout: [number, number][] = stops.filter((s) => s?.lat).map((s) => [s.lng, s.lat]);
  const extra = bands.filter((b) => b.lat).map((b) => ({ id: b.id, name: b.name, sub: b.home_city || b.genre, lat: b.lat, lng: b.lng }));

  return (
    <div className="card p-2 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1 text-sm">
          {cesiumToken && <button onClick={() => pick("3d")} className={`pill ${mode === "3d" ? "border-neon text-white" : "text-muted"}`}>3D map</button>}
          <button onClick={() => pick("2d")} className={`pill ${mode === "2d" ? "border-neon text-white" : "text-muted"}`}>Flat map</button>
        </div>
        <span className="hidden text-sm text-muted sm:inline">{mode === "3d" ? "venues in blue, bands in pink" : "tap a venue for hotels, gas and drive times"}</span>
      </div>
      {mode === "3d"
        ? <Map3D token={cesiumToken} venues={venues} routeLine={runout.length > 1 ? runout : null} extra={extra} center={center}
            onFail={() => pick("2d")} className="h-[64svh] min-h-[380px] lg:h-[72vh]" />
        : googleKey
          ? <GoogleMap apiKey={googleKey} venues={venues} bands={bands} stops={stops} center={center} zoom={zoom} />
          : <BCMap venues={venues} bands={bands} stops={stops} box={box} />}
    </div>
  );
}
