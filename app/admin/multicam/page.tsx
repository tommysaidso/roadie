import { Page } from "@/components/ui";
import MulticamConsole from "./MulticamConsole";
import { storageReady } from "@/lib/fanclips";

export const dynamic = "force-dynamic";

export default function MulticamPage() {
  return (
    <Page
      title="Fan multicam"
      sub="Every phone in the room is a camera. Fans upload what they shot, the audio lines it all up, and the night can be cut as a real multi-camera shoot. Operator only."
    >
      <MulticamConsole ready={storageReady()} />
    </Page>
  );
}
