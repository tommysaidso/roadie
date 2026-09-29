import { Page } from "@/components/ui";
import CanvassBoard from "@/components/CanvassBoard";
export const dynamic = "force-dynamic";

export default function CanvassPage() {
  return (
    <Page
      title="Canvassing"
      sub="Work an area: reach out, track it, and sign local businesses up to JamPoints — free, they just set a discount. One list feeds LocalJams and ROADIE; the fine print says we measure the lift and may offer a paid tier later."
    >
      <CanvassBoard />
    </Page>
  );
}
