import { Page } from "@/components/ui";
import OffersConsole from "./OffersConsole";

export const dynamic = "force-dynamic";

export default function VendorOffersPage() {
  return (
    <Page
      title="Vendor offers"
      sub="Standing discounts from businesses on the platform. Any band or fan passing through can claim one, any day — not just on a ring night. Operator only."
    >
      <OffersConsole enabled={process.env.ROADIE_VENDOR_TOKENS === "1"} />
    </Page>
  );
}
