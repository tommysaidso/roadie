import Link from "next/link";
import { readClaim } from "@/lib/claim";
import { Page } from "@/components/ui";
import RoadieTvEmbed from "@/components/RoadieTvEmbed";

export const dynamic = "force-dynamic";

// The page a prospect lands on from an outreach email.
//
// Ben's rule: a direct claim link or don't send at all. So this is THEIR page —
// their name at the top, the video, the packages, and one button. No signup
// wall in front of it: someone deciding whether we're worth ten minutes must be
// able to see the thing before they hand over an email address.

const TIERS = [
  { name: "Local", line: "One stop, one night",
    body: "Your name on the night's poster, said from the stage, a table at the door, and a clip you can post yourself." },
  { name: "Route", line: "A run of stops",
    body: "A string of dates through your area. Same crowd, night after night, in front of people who already drive past your door." },
  { name: "Ring", line: "The whole loop, one season",
    body: "Every poster, every stage, every stop. Footage all season, and first call on next year." },
  { name: "Title", line: "Your name in the name",
    body: "Everything the ring does for a season goes out with you on the front of it. One per season." },
];

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = readClaim(token);

  // An expired or tampered link shouldn't dead-end someone who wants in.
  if (!claim) {
    return (
      <Page title="That link has expired" sub="It happens — the link in the email only lasts so long.">
        <div className="card p-6">
          <p className="text-sm text-muted mb-4">
            Nothing is lost. Start here and we&apos;ll find your listing, or reply to the email
            we sent and we&apos;ll send a fresh link.
          </p>
          <Link href="/setup" className="btn btn-neon inline-block">Get started</Link>
        </div>
      </Page>
    );
  }

  const where = [claim.city, claim.region].filter(Boolean).join(", ");
  const isSponsor = String(claim.kind || "").toLowerCase() === "sponsor";

  return (
    <Page
      title={claim.name}
      sub={where ? `${where} — this page is yours.` : "This page is yours."}
    >
      {/* Watch first. Reading about a touring circuit is not the same as
          seeing one, and the video is the whole argument. */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 pt-4 pb-2">
          <div className="label">See it before you read anything</div>
          <p className="text-sm text-muted mt-1">
            This is the ring — the towns, the rooms, the bands. It runs on its own.
          </p>
        </div>
        {/* Direct render, not an iframe of /roadietv — that would pull the
            whole app shell into the panel. */}
        <div className="px-5 pb-4"><RoadieTvEmbed /></div>
      </div>

      {isSponsor ? (
        <>
          <h2 className="text-xl font-black mb-1">What you&apos;d be funding</h2>
          <p className="text-sm text-muted mb-4 max-w-3xl">
            You&apos;re not buying a banner. Your money runs the circuit, and we make the
            content — shot in your region, about the place your guests already live. It is
            advertising you can use all year, and it keeps musicians working in BC and
            Alberta instead of leaving for somewhere else.
          </p>
          <p className="text-sm text-muted mb-4 max-w-3xl">
            Want the bands playing your room as well? That happens too — it&apos;s part of the
            conversation, not a checkbox. We sit down with each sponsor and build the package
            around your rooms, your calendar and your crowd.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {TIERS.map(t => (
              <div key={t.name} className="card p-4">
                <div className="text-lg font-black">{t.name}</div>
                <div className="label mb-2">{t.line}</div>
                <p className="text-sm text-muted">{t.body}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-black mb-1">Your listing, free</h2>
          <p className="text-sm text-muted mb-4 max-w-3xl">
            {claim.name} is already on the venue map. Claiming it costs nothing and never
            will — you get the page, the calendar and the contact details, and bands routing
            a tour through {claim.city || "your area"} can find you and pitch you directly.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {[
              ["Free, forever", "The listing, your page, your calendar, your contact details."],
              ["Bands come to you", "Acts routing through your area pitch you directly — no agency in between."],
              ["Paid tools if you want them", "Licensed music from real artists who get paid per play, booking, posters."],
            ].map(([h, b]) => (
              <div key={h} className="card p-4">
                <div className="font-bold mb-1">{h}</div>
                <p className="text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card p-6">
        <div className="text-lg font-black mb-1">Claim {claim.name}</div>
        <p className="text-sm text-muted mb-4">
          Two minutes. We already know who you are — you just confirm it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/setup?claim=${encodeURIComponent(token)}`} className="btn btn-neon">
            Claim it
          </Link>
          <Link href={isSponsor ? "/pitch" : "/venues"} className="btn">
            {isSponsor ? "See the full deck" : "See the map first"}
          </Link>
        </div>
        <p className="text-[11px] text-muted mt-3">
          Rather talk to a person? Reply to the email — it reaches Ben and Dewey directly.
        </p>
      </div>
    </Page>
  );
}
