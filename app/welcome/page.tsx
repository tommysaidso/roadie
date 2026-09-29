import { Page } from "@/components/ui";
import SetPassword from "@/components/SetPassword";
export const dynamic = "force-dynamic";

export default function Welcome() {
  return (
    <Page title="Set your password" sub="First time in — choose your own password. We never send one by email.">
      <SetPassword />
    </Page>
  );
}
