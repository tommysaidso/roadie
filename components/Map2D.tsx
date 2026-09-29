"use client";
import { useEffect, useRef } from "react";

// Flat, easy-to-read Google map — display only. No Directions/Places API needed:
// the parent computes the route (OSRM) and POIs (Overpass) and hands them here;
// we just draw pins, a polyline, and amenity dots.

let mapsPromise: Promise<any> | null = null;
function loadMaps(key: string) {
  if ((globalThis as any).google?.maps) return Promise.resolve((globalThis as any).google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    s.async = true; s.defer = true;
    s.onload = () => resolve((globalThis as any).google);
    s.onerror = () => reject(new Error("maps failed"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

type V = { id: number; name: string; city: string; lat: number; lng: number };

export default function Map2D({ apiKey, venues, stops, routeLine, pois, onAddStop }: {
  apiKey: string; venues: V[]; stops: V[];
  routeLine: [number, number][] | null;   // [lng,lat] pairs from OSRM
  pois: { lat: number; lng: number; gas: boolean }[];
  onAddStop: (v: V) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const S = useRef<any>({ map: null, google: null, poly: null, venuePins: [], stopPins: [], poiPins: [] });

  // init once
  useEffect(() => {
    if (!apiKey) return;
    loadMaps(apiKey).then((google: any) => {
      if (!el.current) return;
      const map = new google.maps.Map(el.current, {
        center: { lat: 52, lng: -121 }, zoom: 5, mapId: "ROADIE_2D",
        disableDefaultUI: true, zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#14141c" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8a8aa0" }] },
          { featureType: "water", stylers: [{ color: "#0e1430" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#23232f" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      const popup = new google.maps.InfoWindow();
      const venuePins = venues.filter((v) => v.lat).map((v) => {
        const m = new google.maps.Marker({
          position: { lat: v.lat, lng: v.lng }, map, title: `${v.name} — ${v.city}`,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: "#7c8cff", fillOpacity: 0.9, strokeColor: "#0b0b0f", strokeWeight: 1 },
        });
        m.addListener("click", () => {
          popup.setContent(`<div style="color:#111"><b>${v.name}</b><br>${v.city}<br><button id="addstop" style="margin-top:6px;background:#3df0ff;color:#0b0b0f;border:0;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer">+ add to tour</button></div>`);
          popup.open(map, m);
          google.maps.event.addListenerOnce(popup, "domready", () => {
            const b = document.getElementById("addstop"); if (b) b.onclick = () => { onAddStop(v); popup.close(); };
          });
        });
        return m;
      });
      S.current = { map, google, poly: null, venuePins, stopPins: [], poiPins: [] };
    }).catch(() => {});
    return () => { S.current.map = null; };
  }, [apiKey]);

  // redraw route + numbered stop pins
  useEffect(() => {
    const { map, google } = S.current; if (!map) return;
    if (S.current.poly) { S.current.poly.setMap(null); S.current.poly = null; }
    S.current.stopPins.forEach((m: any) => m.setMap(null)); S.current.stopPins = [];
    if (routeLine && routeLine.length) {
      S.current.poly = new google.maps.Polyline({
        path: routeLine.map(([lng, lat]) => ({ lat, lng })), map,
        strokeColor: "#3df0ff", strokeWeight: 4, strokeOpacity: 0.9,
      });
    }
    S.current.stopPins = stops.filter((s) => s.lat).map((s, i) => new google.maps.Marker({
      position: { lat: s.lat, lng: s.lng }, map, label: { text: String(i + 1), color: "#0b0b0f", fontSize: "11px", fontWeight: "700" },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#3df0ff", fillOpacity: 1, strokeColor: "#0b0b0f", strokeWeight: 2 },
    }));
  }, [stops, routeLine]);

  // redraw amenity dots
  useEffect(() => {
    const { map, google } = S.current; if (!map) return;
    S.current.poiPins.forEach((m: any) => m.setMap(null)); S.current.poiPins = [];
    S.current.poiPins = pois.map((p) => new google.maps.Marker({
      position: { lat: p.lat, lng: p.lng }, map,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: p.gas ? 5 : 6, fillColor: p.gas ? "#ffb33d" : "#7cf3a0", fillOpacity: 1, strokeColor: "#0b0b0f", strokeWeight: 1 },
    }));
  }, [pois]);

  return <div ref={el} className="w-full rounded-xl" style={{ height: "62vh", minHeight: 380, background: "#0e0e16" }} />;
}
