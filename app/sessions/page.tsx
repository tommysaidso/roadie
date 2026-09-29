import { Page } from "@/components/ui";
import FloorStudio from "@/components/FloorStudio";
export const dynamic = "force-dynamic";
export default function SessionsPage(){
  return (
    <Page title="Floor Sessions" sub="Record an idea, rehearsal, jam, or live set right off your phone, clean it up on-device, then keep it private or send it to the mymymy Deck.">
      <FloorStudio/>
    </Page>
  );
}
