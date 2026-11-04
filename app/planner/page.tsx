import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import TourPlanner from "@/components/TourPlanner";
export const dynamic = "force-dynamic";

export default async function PlannerPage(){
  const venues = all<any>("SELECT id,name,city,lat,lng,capacity FROM venues WHERE lat IS NOT NULL");
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const cesiumToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN || "";
  return (
    <Page title="Plan a Tour" sub="Tap your stops on the 3D map, put them in the order you'll drive, and ROADIE draws the road route with drive times, fuel and hotels along the way. The flat map is one tap away. Hard stop at Winnipeg: run a West line and an East line.">
      <TourPlanner venues={venues} googleKey={googleKey} cesiumToken={cesiumToken}/>
    </Page>
  );
}
