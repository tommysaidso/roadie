import { Page } from "@/components/ui";
import BetaConsole from "./BetaConsole";

export const dynamic = "force-dynamic";

export default function BetaTeamPage() {
  return (
    <Page
      title="Beta team"
      sub="Your own testers — who's in, what they were promised, what you told them, and whether it landed."
    >
      <BetaConsole />
    </Page>
  );
}
