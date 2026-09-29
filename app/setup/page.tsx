import { Page } from "@/components/ui";
import SetupWizard from "@/components/SetupWizard";
export const dynamic = "force-dynamic";
export default function Setup(){
  return (
    <Page title="Get started" sub="ROADIE sets you up — answer a few questions and it builds your profile for you. Free, and signing up registers your content to you (your IP, protected). Bands, venues, fans and sponsors each get the right setup.">
      <SetupWizard/>
    </Page>
  );
}
