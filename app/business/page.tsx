import { Page } from "@/components/ui";
import BusinessConsole from "@/components/BusinessConsole";
import { RoadieBusinessTour } from "@/components/RoadieTour";

export const dynamic = "force-dynamic";

export default function BusinessPage() {
  return (
    <Page
      title="Account Books"
      sub="Private account tracking for receipt photos, expenses, tax totals and client invoices."
    >
      <RoadieBusinessTour />
      <div data-tour="biz-console"><BusinessConsole /></div>
    </Page>
  );
}
