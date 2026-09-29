import { Page } from "@/components/ui";
import CrewSignup from "./CrewSignup";

export const dynamic = "force-dynamic";

/**
 * Public crew registration.
 *
 * Written for the person it is actually for: someone who did this work for a
 * living, does not live in a city any more, and has no idea the ring is coming
 * through. The copy leads with that rather than with a form.
 */
export default function CrewPage() {
  return (
    <Page
      title="Work the ring"
      sub="Crew, techs and specialists — in the towns the ring goes through."
    >
      <div className="card p-6 space-y-4 text-sm leading-relaxed max-w-3xl">
        <p>
          <b className="text-neon">We hire local.</b> When the ring rolls into a
          town we would rather call someone who lives there than import a crew
          from the city. Cheaper for us, better for the town, and the person who
          knows where the power is and which back road the truck fits down is
          usually the one who lives there.
        </p>
        <p>
          <b>You do not have to be working now.</b> Plenty of people who ran
          front-of-house, cut picture, drove trucks, ran a box office or wrangled
          hotels for touring parties are not in the industry any more — they
          moved home, or they retired, or the big-city work dried up. If you have
          the chops and you want one more run, put your name down. Tell us what
          you did. It counts.
        </p>
        <p>
          <b>Every department.</b> Audio, lighting, video, stage, rigging, power,
          transport, accommodation, catering, medical, security, box office,
          merch, production, camera, editorial, photo, site. Producers and
          editors too — the ring shoots as it goes.
        </p>
        <p className="text-muted">
          Registering does not put you on a call sheet. Someone from production
          reviews every registration, and we get in touch when a ring routes near
          you. There is no fee to be listed, ever.
        </p>
      </div>

      <div className="mt-6 max-w-3xl">
        <CrewSignup />
      </div>

      <div className="card p-6 mt-6 space-y-3 text-sm leading-relaxed max-w-3xl">
        <div className="text-neon font-medium">When you do get hired</div>
        <p>
          Ring crew are engaged as <b>independent contractors</b>. You invoice,
          you handle your own taxes, and you keep your own gear. What that means
          on paper depends on which side of the border the date is on — the form
          shows you the specifics once you pick your country.
        </p>
        <p className="text-muted">
          We never ask for a SIN, SSN or tax number through this site. That
          paperwork is handled properly by the production accountant when you are
          actually hired, not collected into a directory.
        </p>
      </div>
    </Page>
  );
}
