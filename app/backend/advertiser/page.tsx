import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import AdvConsole from "./AdvConsole";
export const dynamic = "force-dynamic";
export default function AdvertiserBackend(){
  const sponsors = all<any>("SELECT * FROM sponsors ORDER BY name");
  const venues = all<any>("SELECT id,name,city FROM venues ORDER BY city,name");
  const bands = all<any>("SELECT id,name,home_city FROM bands ORDER BY name");
  return (
    <Page title="Sponsor / vendor console" sub="Set budgets, launch placements, drop coupons and run vendor-spot / merch / presale campaigns across the route.">
      <AdvConsole sponsors={sponsors} venues={venues} bands={bands}/>
    </Page>
  );
}
