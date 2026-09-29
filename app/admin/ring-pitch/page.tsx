import { Page } from "@/components/ui";
import RingPitchAdmin from "./RingPitchAdmin";
export const dynamic = "force-dynamic";

export default function RingPitchPage() {
  return (
    <Page
      title="Ring Road — Business Plan"
      sub="Investor and sponsor pitch deck. Share the URL + password. Update content and password from here."
    >
      <RingPitchAdmin />
    </Page>
  );
}
