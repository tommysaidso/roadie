import { Page } from "@/components/ui";
import PitchEditor from "./PitchEditor";
export const dynamic = "force-dynamic";

export default function PitchPage() {
  return (
    <Page
      title="Film Commission Pitch"
      sub="BC Film Commission / Alberta Film Commission — show bible, episodic format, and permit spine. Admin only."
    >
      <PitchEditor />
    </Page>
  );
}
