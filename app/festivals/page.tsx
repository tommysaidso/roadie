import { Page } from "@/components/ui";
import Festivals from "@/components/Festivals";
export const dynamic="force-dynamic";
export default function FestivalsPage(){
  return (
    <Page title="Festivals" sub="Festivals across BC — where they are and when. Open any one to auto-find the local bars, open gigs and bands in that area, so you can route a run around a festival weekend. Traveling festivals track their whole route.">
      <Festivals/>
    </Page>
  );
}
