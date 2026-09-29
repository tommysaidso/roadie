import { Page } from "@/components/ui";
import BacklineEditor from "@/components/BacklineEditor";
export const dynamic = "force-dynamic";

export default function BacklineAdmin() {
  return (
    <Page
      title="Sponsored backline"
      sub="Declare the gear on a venue's stage — item, brand, buy link, sponsor. It becomes the shoppable 'what's that?' list: a QR in the room and on the town page, and (later) an eye-invisible tag that rides the video."
    >
      <BacklineEditor />
    </Page>
  );
}
