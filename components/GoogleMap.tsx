"use client";
import { useEffect, useRef, useState } from "react";

// Real Google Map — venue + band markers + runout route + nearby hotels/gas + driving directions.
// Loads the Maps JS API with marker + places + geometry libraries when a key is provided.
// /map falls back to the offline SVG (BCMap) when no key is set.

let mapsPromise: Promise<any> | null = null;

/**
 * Load the Maps JS API.
 *
 * The subtlety that was showing raw Google errors on the Hub: when a key is
 * rejected the script still loads with a 200, so `onload` fires and everything
 * downstream believes it succeeded. Google then reports the problem its own
 * way — a console error and a grey box with its text in it — which is what a
 * visitor was seeing instead of our fallback.
 *
 * Two guards: gm_authFailure, which Google calls specifically for key problems,
 * and a check that google.maps actually exists once the script has run.
 */
function loadMaps(key: string) {
  if ((globalThis as any).google?.maps) return Promise.resolve((globalThis as any).google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const fail = (why: string) => { mapsPromise = null; reject(new Error(why)); };
    (globalThis as any).gm_authFailure = () => fail("key-rejected");
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker,places,geometry`;
    s.async = true; s.defer = true;
    s.onload = () => {
      const g = (globalThis as any).google;
      if (g?.maps) resolve(g);
      else fail("key-rejected");     // loaded, but Google refused to hand us the API
    };
    s.onerror = () => fail("blocked");
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export default function GoogleMap({
  apiKey, venues, bands, stops, center, zoom,
}: { apiKey: string; venues: any[]; bands: any[]; stops: any[];
     center?: { lat: number; lng: number }; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState<string>("");      // bottom strip — directions ETA etc.
  const stateRef = useRef<any>({ amenityMarkers: [], directionsRenderer: null });

  // Follow the visitor's chosen location. Kept as a ref so the listener can
  // reach the live map without re-running the whole build effect.
  const mapRef = useRef<any>(null);
  useEffect(() => {
    const onOrigin = (e: any) => {
      const { lat, lng } = e?.detail || {};
      const m = mapRef.current;
      if (!m || typeof lat !== "number" || typeof lng !== "number") return;
      m.panTo({ lat, lng });
      // Close enough to see streets, which is the point of "near me".
      if (m.getZoom() < 11) m.setZoom(11);
    };
    window.addEventListener("roadie:origin", onOrigin as any);
    return () => window.removeEventListener("roadie:origin", onOrigin as any);
  }, []);

  useEffect(() => {
    let map: any;
    loadMaps(apiKey).catch((e: any) => {
      // A person should get a sentence, not Google's diagnostics.
      setErr(String(e?.message) === "key-rejected"
        ? "The map key isn't active for this site yet, so the map is off. Everything else on this page works — the list below is the same data."
        : "The map couldn't load (blocked or offline). The list below is the same data.");
      return null;
    }).then((google: any) => {
      if (!google) return;
      if (!el.current) return;
      map = mapRef.current = new google.maps.Map(el.current, {
        center: center ?? { lat: 49.9, lng: -119.5 }, zoom: zoom ?? 8, mapId: "ROADIE",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#14141c" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8a8aa0" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0f" }] },
          { featureType: "water", stylers: [{ color: "#0e1430" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#23232f" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#a4a4b8" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },        // hide native POIs
          { featureType: "poi.business", stylers: [{ visibility: "off" }] },
        ],
        disableDefaultUI: true, zoomControl: true,
      });

      const places = new google.maps.places.PlacesService(map);
      const directionsSvc = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
        polylineOptions: { strokeColor: "#3df0ff", strokeWeight: 4, strokeOpacity: 0.85 },
        map,
      });
      stateRef.current.directionsRenderer = directionsRenderer;

      const popup = new google.maps.InfoWindow();

      function clearAmenities() {
        stateRef.current.amenityMarkers.forEach((m: any) => m.setMap(null));
        stateRef.current.amenityMarkers = [];
      }

      function findAmenitiesNear(v: any, type: "lodging" | "gas_station") {
        clearAmenities();
        const isGas = type === "gas_station";
        places.nearbySearch(
          { location: { lat: v.lat, lng: v.lng }, radius: isGas ? 6000 : 2500, type: type as any, rankBy: undefined },
          (results: any[], status: any) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
              setInfo(`No ${isGas ? "gas station" : "hotel"} results near ${v.name} (Places API may not be enabled on this key).`);
              return;
            }
            const top = results
              .map((p: any) => {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(
                  p.geometry.location, new google.maps.LatLng(v.lat, v.lng)
                );
                return { ...p, _dist: dist };
              })
              .sort((a: any, b: any) => {
                const ar = a.rating || 0, br = b.rating || 0;
                if (isGas && a.price_level !== b.price_level) return (a.price_level ?? 9) - (b.price_level ?? 9);
                if (Math.abs(ar - br) > 0.2) return br - ar;
                return a._dist - b._dist;
              })
              .slice(0, 7);
            top.forEach((p: any) => {
              const m = new google.maps.Marker({
                position: p.geometry.location, map,
                title: p.name,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isGas ? 5 : 6, fillColor: isGas ? "#ffb33d" : "#7cf3a0", fillOpacity: 1,
                  strokeColor: "#0b0b0f", strokeWeight: 1.5,
                },
              });
              m.addListener("click", () => {
                const price = p.price_level ? `${"$".repeat(p.price_level)} price signal<br>` : "";
                popup.setContent(
                  `<div style="color:#111;max-width:220px">
                    <b>${p.name}</b><br>
                    ${p.vicinity || ""}<br>
                    ${p.rating ? `★ ${p.rating} (${p.user_ratings_total || 0})<br>` : ""}
                    ${price}
                    <span style="color:#0a7">${Math.round(p._dist)} m from ${v.name}</span><br>
                    <span style="color:#555">${isGas ? "Fuel prices need a live provider; this sorts by price signal/rating/distance." : "Accommodation appeal: rating, distance, and late-night load-out convenience."}</span>
                  </div>`
                );
                popup.open(map, m);
              });
              stateRef.current.amenityMarkers.push(m);
            });
            setInfo(
              isGas
                ? `${top.length} gas stops within 6 km of ${v.name}. Sorted by price signal when available, then rating and distance.`
                : `${top.length} places to stay within 2.5 km of ${v.name}. Tap a green pin for appeal and distance.`,
            );
          }
        );
      }

      function routeTo(v: any) {
        // Drive from the first stop in the runout to this venue
        const origin = stops?.[0] ? { lat: stops[0].lat, lng: stops[0].lng } : null;
        if (!origin) { setInfo("Set a starting city on the Hub map to compute directions."); return; }
        directionsSvc.route(
          { origin, destination: { lat: v.lat, lng: v.lng }, travelMode: google.maps.TravelMode.DRIVING },
          (res: any, status: any) => {
            if (status !== "OK" || !res) {
              setInfo(`Directions unavailable (status: ${status}). Enable the Directions API on this key.`);
              return;
            }
            directionsRenderer.setDirections(res);
            const leg = res.routes[0].legs[0];
            setInfo(`Drive: ${stops[0].city} → ${v.name} · ${leg.distance.text} · ${leg.duration.text}`);
          }
        );
      }

      // Venue markers
      venues.forEach((v: any) => {
        if (!v.lat) return;
        const m = new google.maps.Marker({
          position: { lat: v.lat, lng: v.lng }, map, title: v.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9, fillColor: "#3df0ff", fillOpacity: 1, strokeColor: "#0b0b0f", strokeWeight: 2,
          },
        });
        m.addListener("click", () => {
          const html = `
            <div style="color:#111;max-width:240px">
              <div style="font-size:14px"><b>${v.name}</b></div>
              <div style="color:#444">${v.city} · cap ${v.capacity || "?"}</div>
              <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                <button data-act="stay" data-id="${v.id}"
                  style="background:#7cf3a0;color:#0b0b0f;border:0;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">
                  places to stay
                </button>
                <button data-act="gas" data-id="${v.id}"
                  style="background:#ffb33d;color:#0b0b0f;border:0;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">
                  gas stops
                </button>
                <button data-act="route" data-id="${v.id}"
                  style="background:#3df0ff;color:#0b0b0f;border:0;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">
                  directions + ETA
                </button>
              </div>
            </div>`;
          popup.setContent(html);
          popup.open(map, m);
          // Map-first venues: tell the list to open this town (no-op elsewhere).
          try { window.dispatchEvent(new CustomEvent("roadie:venue-pick", { detail: { city: v.city } })); } catch {}
          // wire the buttons after the DOM lands
          google.maps.event.addListenerOnce(popup, "domready", () => {
            document.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
              btn.onclick = () => {
                const act = btn.getAttribute("data-act");
                if (act === "stay") findAmenitiesNear(v, "lodging");
                if (act === "gas") findAmenitiesNear(v, "gas_station");
                if (act === "route") routeTo(v);
              };
            });
          });
        });
      });

      // Band-home markers
      bands.forEach((b: any) => {
        if (!b.lat) return;
        const m = new google.maps.Marker({
          position: { lat: b.lat, lng: b.lng }, map, title: b.name,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 5, fillColor: "#ffb33d", fillOpacity: 1, strokeColor: "#0b0b0f", strokeWeight: 1,
          },
        });
        m.addListener("click", () => {
          popup.setContent(`<div style="color:#111"><b>${b.name}</b><br>${b.home_city} · ${b.genre || ""}</div>`);
          popup.open(map, m);
        });
      });

      // Runout dashed polyline (the suggested loop)
      if (stops?.length > 1) {
        new google.maps.Polyline({
          path: stops.map((s: any) => ({ lat: s.lat, lng: s.lng })), map,
          strokeColor: "#ff3d6e", strokeWeight: 3, strokeOpacity: 0.9,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }],
        });
      }

      // Auto-fit to venue bounds (first time only)
      if (venues.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        venues.forEach((v: any) => v.lat && bounds.extend({ lat: v.lat, lng: v.lng }));
        if (!bounds.isEmpty()) map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
      }
    }).catch(() => setErr("Couldn't load Google Maps — check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY + the key's referrer + which APIs are enabled."));

    return () => { map = null; };
  }, [apiKey, JSON.stringify(stops)]);

  return (
    <div className="card p-3">
      <div ref={el} className="w-full rounded-xl" style={{ height: "60vh", minHeight: 360, background: "#0e0e16" }} />
      {err && <div className="text-xs text-amber mt-2">{err}</div>}
      {info && (
        <div className="mt-2 text-xs px-3 py-2 rounded-xl bg-panel2 text-ink border border-edge">
          {info}
        </div>
      )}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted px-1 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#3df0ff" }} /> venue (tap for stay, gas + directions)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#7cf3a0" }} /> place to stay (within 2.5 km)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#ffb33d" }} /> gas stop</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5" style={{ background: "#ffb33d", transform: "rotate(45deg)" }} /> band home</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5" style={{ background: "#ff3d6e" }} /> runout loop</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5" style={{ background: "#3df0ff" }} /> driving route</span>
      </div>
    </div>
  );
}
