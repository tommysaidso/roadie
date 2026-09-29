import { NextRequest, NextResponse } from "next/server";
import { getDb, all } from "@/lib/db";
import { geocodeCity } from "@/lib/geocode";
import { haversineKm } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * CRM stamps live on the venue/band rows themselves. They are added lazily,
 * so any route that READS them has to be able to create them too — otherwise
 * whichever page loads first 500s on a column that does not exist yet.
 */
let crmReady = false;
function ensureCrmColumns() {
  if (crmReady) return;
  for (const t of ["venues", "bands"]) {
    for (const col of ["last_contacted_at TEXT", "last_contacted_by INTEGER", "assigned_to INTEGER"]) {
      try { getDb().exec(`ALTER TABLE ${t} ADD COLUMN ${col}`); } catch { /* already there */ }
    }
  }
  crmReady = true;
}

type Origin = { label: string; city?: string; region?: string; lat: number; lng: number };

function num(v: string | null) {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function originFrom(req: NextRequest): Origin | null {
  const p = req.nextUrl.searchParams;
  const lat = num(p.get("lat"));
  const lng = num(p.get("lng"));
  if (lat !== null && lng !== null) return { label: "your location", lat, lng };

  const city = String(p.get("city") || "").trim();
  if (!city) return null;
  const g = geocodeCity(city);
  if (g.lat === null || g.lng === null) return null;
  return {
    label: [g.city, g.region].filter(Boolean).join(", "),
    city: g.city,
    region: g.region,
    lat: g.lat,
    lng: g.lng,
  };
}

function nearby(rows: any[], origin: Origin, radiusKm: number) {
  return rows
    .filter((r) => r.lat && r.lng)
    .map((r) => ({ ...r, km: Math.round(haversineKm([origin.lat, origin.lng], [r.lat, r.lng])) }))
    .filter((r) => r.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

export async function GET(req: NextRequest) {
  const origin = originFrom(req);
  if (!origin) {
    return NextResponse.json(
      { error: "location_required", detail: "Send lat/lng or a known Canadian city." },
      { status: 400 },
    );
  }

  const radiusKm = Math.min(500, Math.max(25, num(req.nextUrl.searchParams.get("km")) || 120));
  const venues = nearby(
    (ensureCrmColumns(), all("SELECT id,name,city,lat,lng,capacity,genres,pay_model,verification_status,contact,user_id,last_contacted_at,assigned_to FROM venues WHERE lat IS NOT NULL")),
    origin,
    radiusKm,
  );
  const bands = nearby(
    all("SELECT id,name,home_city,genre,lat,lng,touring,verification_status,user_id,last_contacted_at,assigned_to FROM bands WHERE lat IS NOT NULL"),
    origin,
    radiusKm,
  );
  const slots = nearby(
    all(`SELECT s.id,s.date,s.genre_wanted,s.guarantee,v.name venue,v.city,v.lat,v.lng
         FROM venue_slots s JOIN venues v ON v.id=s.venue_id
         WHERE s.status='open' AND v.lat IS NOT NULL
         ORDER BY s.date`),
    origin,
    radiusKm,
  );

  return NextResponse.json({
    origin,
    radius_km: radiusKm,
    counts: { venues: venues.length, slots: slots.length, bands: bands.length },
    venues: venues.slice(0, 12),
    slots: slots.slice(0, 12),
    bands: bands.slice(0, 12),
  });
}
