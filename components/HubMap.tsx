"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import BCMap from "./BCMap";
import GoogleMap from "./GoogleMap";

// Embedded tour map for the Hub. Lets the visitor pick the starting city
// from a dropdown — the dashed runout reorders to start from that city
// (rotation around the existing loop).
type Stop = { seq: number; city: string; lat: number; lng: number };

export default function HubMap({
  venues, bands, defaultLoop, googleKey, center, zoom, box,
}: {
  venues: any[];
  bands: any[];
  defaultLoop: string[];      // ordered city loop from the active hub record
  googleKey: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  box?: { minLng: number; maxLng: number; minLat: number; maxLat: number };
}) {
  const [start, setStart] = useState<string>(defaultLoop[0] ?? "");

  const stops: Stop[] = useMemo(() => {
    const i = Math.max(0, defaultLoop.indexOf(start));
    const order = [...defaultLoop.slice(i), ...defaultLoop.slice(0, i)];
    return order.map((city, seq) => {
      const v = venues.find((x: any) => x.city === city);
      return v ? { seq, city, lat: v.lat, lng: v.lng } : null;
    }).filter(Boolean) as Stop[];
  }, [venues, defaultLoop, start]);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="label">Tour Map</div>
          <div className="text-sm text-muted">Start where you live; the loop reorders. Tap a pin for venue / band info.</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Start from</label>
          <select
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-full border border-edge bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-neon"
          >
            {defaultLoop.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Link href="/map" className="text-xs text-neon hover:underline">Full map →</Link>
        </div>
      </div>

      {googleKey
        ? <GoogleMap apiKey={googleKey} venues={venues} bands={bands} stops={stops as any} center={center} zoom={zoom} />
        : <BCMap venues={venues} bands={bands} stops={stops as any} box={box} />}

      <div className="mt-3 text-sm text-muted">
        {stops.map((s) => s.city).join("  →  ")}
        {googleKey ? "" : "  ·  add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the live Google map."}
      </div>
    </section>
  );
}
