import { Page } from "@/components/ui";
import TheWire from "@/components/TheWire";
import WireStations from "@/components/WireStations";

export const dynamic = "force-dynamic";

// The Wire is the ring's radio, so it gets its own front door rather than
// living only as a panel inside The PIT. It still appears there — the fan
// entrance should have the radio on it — but anyone sent straight to the
// station lands here.
export default function Wire() {
  return (
    <Page
      title="The Wire"
      sub="The ring's radio. Pick a genre, turn it up, leave it on. No skip and no playlist — whatever's playing is what's playing."
    >
      <TheWire />

      {/* The switch itself. Signed-out or unlinked users get the plain
          explanation instead; WireStations handles both states. */}
      <div className="mt-6"><WireStations /></div>
    </Page>
  );
}
