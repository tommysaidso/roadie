import { Page } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ensureRingSchema } from "@/lib/ring";
import { ensureAgreementSchema } from "@/lib/agreements";
import { ensureCrewPoolSchema } from "@/lib/crewpool";
import AgreementsConsole from "./AgreementsConsole";

export const dynamic = "force-dynamic";

/**
 * "Can I run this ring?" — bands papered, towns staffable.
 *
 * Schema ensure calls run here because these tables are created at runtime
 * rather than by a migration; a fresh database reaching this page for the first
 * time must not 500.
 */
export default function AgreementsPage() {
  ensureRingSchema();
  ensureAgreementSchema();
  ensureCrewPoolSchema();

  const routes = getDb()
    .prepare(`SELECT id, name, season, status FROM routes ORDER BY id DESC`)
    .all() as any[];

  return (
    <Page
      title="Paperwork & crew"
      sub="Which bands are good to go, and who can work the towns."
    >
      {routes.length === 0 ? (
        <div className="card p-6 text-sm text-muted max-w-2xl">
          No rings yet. Create a route first and the paperwork view follows it.
        </div>
      ) : (
        <AgreementsConsole routes={routes} />
      )}

      <div className="card p-5 mt-6 text-xs text-muted leading-relaxed max-w-3xl">
        <b className="text-neon">What &ldquo;good to go&rdquo; means here.</b>{" "}
        Every touring member has read the agreement and confirmed they intend to
        proceed, and the version they were sent is still the current one. It is
        <b> not</b> a signature and it does not execute the contract — that
        happens on paper or through a proper e-signature service after legal
        review, signed by the band as an entity and by each member personally.
        This screen tells you who is ready to be asked.
      </div>
    </Page>
  );
}
