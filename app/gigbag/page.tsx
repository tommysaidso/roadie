import { cookies } from "next/headers";
import Link from "next/link";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { ensureGigBagSchema } from "@/lib/gigbag";
import { Page } from "@/components/ui";
import GigBagView from "@/components/GigBag";
import { RoadieBandTour, WalkMeThrough } from "@/components/RoadieTour";

export const dynamic = "force-dynamic";

export default async function GigBagPage() {
  ensureGigBagSchema();
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <Page title="Gig Bag" sub="What you carry, and what you sell.">
        <div className="card p-6">
          <p className="text-sm text-muted mb-4">
            Your gig bag is yours — sign in and it&apos;s here.
          </p>
          <Link href="/signin" className="btn btn-neon inline-block">Sign in</Link>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Gig Bag"
      sub="What each of you carries, and what you sell. The kit list tells a host what the room has to hold; the merch shelf sends fans to your own shop."
    >
      <GigBagView />
      {/* Not auto-run: a band opening its own bag does not need a tour thrown
          at it. The pill is there for the first time, or a bad day. */}
      <RoadieBandTour />
      <WalkMeThrough label="? walk me through the bag" />
    </Page>
  );
}
