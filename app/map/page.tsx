import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import PromoBanner from "@/components/PromoBanner";
import { cookies } from "next/headers";
import { getHub, hubLoop } from "@/lib/hubs";
import MapModes from "@/components/MapModes";
export const metadata = { title: "Tour Map", alternates: { canonical: "/map" } };
export const dynamic = "force-dynamic";
export default async function MapPage(){
  const c = await cookies();
  const hub = getHub(c.get("roadie_hub")?.value);
  const venues = all<any>("SELECT id,name,city,lat,lng,capacity,genres FROM venues");
  const bands = all<any>("SELECT id,name,home_city,genre,lat,lng FROM bands");
  const order = hubLoop(hub);
  const stops = order.map((c,i)=>{ const v=venues.find((x:any)=>x.city===c); return v?{seq:i,city:c,lat:v.lat,lng:v.lng}:null; }).filter(Boolean);
  const gkey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  return (
    <Page title="Tour Map" sub={`Plot the run. The dashed line is ROADIE's suggested ${hub.name} runout. The 3D map shows the whole region at once; switch to the flat map for hotels, gas and drive times.`}>
      <MapModes cesiumToken={process.env.NEXT_PUBLIC_CESIUM_TOKEN || ""} googleKey={gkey} venues={venues} bands={bands} stops={stops as any}
        center={{lat:hub.center_lat,lng:hub.center_lng}} zoom={hub.default_zoom}
        box={{minLng:hub.bbox_min_lng,maxLng:hub.bbox_max_lng,minLat:hub.bbox_min_lat,maxLat:hub.bbox_max_lat}}/>
      <div className="card p-4 mt-4">
        <div className="label mb-2">Suggested runout — {hub.name}</div>
        <div className="text-sm text-muted">{(stops as any).map((s:any)=>s.city).join("  →  ")} — tap venue pins on the map for real drive times.{gkey?"":" Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the live Google map + drive-time routing."}</div>
      </div>
      <section className="grid gap-3 mt-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="label mb-2">Route expansion targets</div>
          <div className="text-sm text-muted">
            Vancouver / Lower Mainland, Whistler, Williams Lake, Vancouver Island, then the 49th-parallel coast-to-coast bar run.
            ROADIE should treat each as a route corridor: gigs, gas, lodging, ferries, border notes, receipts and invoices.
          </div>
        </div>
        <div className="card p-4">
          <div className="label mb-2">Survival mode</div>
          <div className="text-sm text-muted">
            Tap a venue pin for hotels, gas stops and ETA. Hotels show distance and accommodation appeal; gas sorts by price signal when Google has it, then rating and distance.
          </div>
        </div>
      </section>
          <div className="mt-4"><PromoBanner src="/promo/route-intel.png" alt="Know where you&#39;ll be loved before you drive 4,000 km" maxH={280}/></div>
    </Page>
  );
}
