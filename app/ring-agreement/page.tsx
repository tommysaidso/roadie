import { Page } from "@/components/ui";
import { RING_TERMS_VERSION } from "@/lib/agreements";

export const dynamic = "force-dynamic";

/**
 * The Ring Contractor Agreement, in the open.
 *
 * A band deciding whether to do a ring should be able to read the whole deal —
 * money, filming, sync, no-rider, buyouts — before anyone asks them for
 * anything, and download it for their own lawyer. Nothing here is behind a
 * login. The terms are the pitch.
 */
export default function RingAgreementPage() {
  return (
    <Page
      title="Ring Contractor Agreement"
      sub="The whole deal, in the open, before you say yes."
    >
      <div className="card p-6 space-y-4 text-sm leading-relaxed max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/legal/ring-contract" download className="btn">
            Download the agreement (.md)
          </a>
          <span className="text-muted text-xs">
            Version {RING_TERMS_VERSION} · draft, under legal review
          </span>
        </div>
        <p className="text-muted">
          Take this to your own lawyer. You do not need to ask us, and we would
          rather you did than have you sign something you had not checked.
        </p>
        <div className="card p-4 text-xs leading-relaxed"
             style={{ borderColor: "rgba(255,200,60,0.4)" }}>
          <b style={{ color: "#fbbf24" }}>In development.</b>{" "}
          The Ring is in build-out and these are the <b>base template terms</b>.
          They are real and we mean them, but they will change as the production
          takes shape. Every acceptance is recorded against a version number, so
          we can tell you exactly what you agreed to — and{" "}
          <b>you will be alerted when the terms change</b> and asked to look
          again, rather than being moved onto new words quietly. Nothing is
          changed retroactively on a date already agreed.
        </div>
      </div>

      <div className="card p-6 mt-6 space-y-4 text-sm leading-relaxed max-w-3xl">
        <div className="card p-4 space-y-3 text-sm leading-relaxed"
             style={{ borderColor: "rgba(61,240,255,0.4)" }}>
          <div className="text-cyan font-medium">Who you are contracting with</div>
          <p className="text-muted">
            Rings do not cross the border, and the contracting company is the one
            in the country the ring runs in. In this agreement{" "}
            <b>&ldquo;the Producer&rdquo;</b> means:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li><b>Canada</b> — UARX MIXEDREALITY CORP., Canadian federal
                corporation (CBCA) No. 1695020-5, South Hazelton, BC</li>
            <li><b>United States</b> — THE EV ENTERTAINMENT &amp; PRODUCTION
                GROUP, California Stock Corporation No. 3908519,
                West Hollywood, CA</li>
          </ul>
          <p className="text-muted">
            Your engagement letter names the Producer, the country and the dates.
            That entity hires you, pays you, indemnifies you, and signs. A
            Canadian ring is a Canadian company engaging people in Canada; a US
            ring is a US company engaging people in the United States. Neither
            contracts across the border.
          </p>
          <p className="text-muted">
            The mymymy and ROADIE platforms are operated by UARX regardless of
            which Producer engages you for a ring.
          </p>
          <p className="text-muted">
            <b>Production services.</b> The Producer may engage affiliates and
            subcontractors to deliver the production on the ground. In the USA
            that is <b>BLACKMUDD</b> (Mississippi), an affiliate of the Producer.
            Nothing changes for you — your agreement, payment, indemnity and
            signature are all with the Producer. The people you meet at the stop
            may work for an affiliate; the company that owes you is the Producer.
          </p>
        </div>

        <p>
          <b className="text-neon">This is a film production.</b> The Ring is a
          documentary, and you are engaged as a <b>paid performer on that
          production</b> — not a support act on a promoter&rsquo;s show. That
          distinction is the whole structure: the engagement, the paperwork and
          the rules we follow are film production rules, because that is what
          this is.
        </p>
        <p>
          You are hired as an <b>independent contractor</b> for a specific ring —
          a route, a set of dates, a number of stops. Not employment, not a
          partnership, not a record deal. The Producer is the general contractor and
          the ring is the Producer&rsquo;s production. You are the talent on it.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Non-union.</b> This production is not signatory to a performer or
              crew union agreement. If you are a member of one, check your own
              obligations before accepting — we would rather you raised it now</li>
          <li><b>Local hire.</b> Crew are engaged locally at each stop wherever the
              town can supply them, on the same film-production basis. Cheaper,
              better, and the reason for routing through these towns at all</li>
          <li><b>We pay the trip.</b> Travel, accommodation and per diem for the
              touring party are production costs carried by the Producer, on top of the
              performance fee — you are not funding the road out of your guarantee</li>
        </ul>

        <div className="text-neon font-medium pt-2">Who we take, and who we do not</div>
        <p className="text-muted">
          Neither of these is a judgement on the music — the economics here just
          assume a direct relationship with the act.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>No agented acts.</b> If a booking agent represents you for live
              work, this is not the right fit. There is no agent layer in these
              numbers</li>
          <li><b>No conflicts with the platform.</b> An exclusive that would bar
              the sync licence, or a commitment that competes with the platform.
              Tell us up front — far better found now than after a date is booked</li>
        </ul>
        <p className="text-muted">
          Either way you can still be on the platform. It is the ring that does
          not fit, not you.
        </p>

        <div className="text-neon font-medium pt-2">Where rings run</div>
        <p>
          <b>Rings do not cross the border.</b> A Canadian ring is crewed, billed
          and paid in Canada; a US ring in the USA. Acts are not moved across for
          dates, so artist visa classes do not arise. In the USA, engagement is{" "}
          <b>film production crew on a work-for-hire basis</b> — the ring is a
          documentary shoot and that is the framework it runs on.
        </p>

        <div className="text-neon font-medium pt-2">The money</div>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>$3,000 CAD guarantee per show</b>, escrowed before the ring starts,
              non-refundable, paid regardless of door, weather or turnout</li>
          <li><b>Per act, not per head.</b> A five-piece and a solo artist in the
              same slot get the same $3,000. You are paid to perform that night,
              not by how many people you bring — if one of you can hold a crowd
              the way five can, that is worth the same here. Meals, per diem and
              rooms are covered per touring member on top</li>
          <li><b>60% of the door</b> per stop, settled the same night</li>
          <li>Fuel, transport, accommodation and meals covered for all touring
              members — you do not pay road costs</li>
          <li>Paid gross with no deductions. You handle your own taxes; the
              year-end slip depends which side of the border the dates are on</li>
        </ul>

        <div className="text-neon font-medium pt-2">Your music stays yours</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>UARX acquires <b>no publishing, no masters, no copyright</b> in your catalogue</li>
          <li>Your performance royalties are yours, as always</li>
          <li>You grant a non-exclusive sync licence for the docu-series, music
              videos from ring footage, and platform promotion</li>
          <li><b>Advertiser commercials are excluded.</b> If your music goes in a
              commercial that is a separate deal with separate money. It will
              never be assumed or buried</li>
        </ul>

        <div className="text-neon font-medium pt-2">Filming</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Performances are filmed — that is the job</li>
          <li>Interviews are voluntary each time; you can decline any one of them</li>
          <li>If you are <b>identifiable</b> in an advertiser commercial, that is a
              separate one-time buyout, agreed before it is produced, never folded
              into the guarantee</li>
        </ul>

        <div className="text-neon font-medium pt-2">No rider</div>
        <p>
          There is no technical rider and no hospitality rider. UARX brings the
          stage, PA, lights, power, rooms and food. You bring backline and talent.
          The container deploys the same rig at every stop — the consistency is the
          point, so every town gets the same show. Merch table is provided free and
          you keep 100%.
        </p>

        <div className="text-neon font-medium pt-2">Conduct</div>
        <p>
          The production is dry — no alcohol or drugs on stage or in the container.
          Personal time is your own. Genuine emergencies are accommodated and you
          are paid for shows completed.
        </p>

        <div className="text-neon font-medium pt-2">Indemnity — it runs both ways</div>
        <p>
          Each side carries its own conduct. <b>You</b> cover your music&rsquo;s
          rights, your backline, your members&rsquo; conduct and your own tax
          filings. <b>We</b> cover the production — stage, PA, rigging, power,
          permits, site safety — and the footage within the licences here.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>We carry commercial general liability on the production and the site</li>
          <li>Workers&rsquo; comp per the province or state the show is in</li>
          <li>You insure your own instruments — production insurance does not
              cover a band&rsquo;s backline</li>
          <li>Neither side is liable to the other for indirect or consequential
              loss, and our total liability on a ring is capped at your total
              guarantee for it. That cap never applies to death, personal injury,
              gross negligence, wilful misconduct or fraud</li>
        </ul>

        <div className="text-neon font-medium pt-2">Neutral ground</div>
        <p>
          The ring is a music production, not a platform for a campaign. The stage
          is for the music — no partisan organising or advocacy from the stage or
          in production content, in any direction. We follow the law of the country
          and the bylaws of the town hosting the stop. Everyone is welcome and
          treated the same; we do not discriminate on any ground protected by the
          Canadian Human Rights Act, the BC Human Rights Code or applicable US law.
        </p>
        <p className="text-muted">
          Your songs are your artistic expression and this is not a content review
          of them. What anyone believes or says on their own time is their own
          business. This governs conduct on the production.
        </p>

        <div className="text-neon font-medium pt-2">Signing</div>
        <p>
          The band signs as an entity <b>and every touring member signs personally</b>.
          That is not bureaucracy: likeness and performance consent belong to each
          person, so if someone leaves the band afterwards their consent still
          covers footage already shot.
        </p>

        <p className="text-muted pt-2">
          Execution happens on paper or through a proper e-signature service after
          legal review — never by clicking a box on a website. If anything here
          reads wrong to you, say so. The terms are reviewed and we would rather
          hear it from you than have you sign around it.
        </p>
      </div>
    </Page>
  );
}
