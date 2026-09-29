import { cookies } from "next/headers";
import Link from "next/link";
import { all } from "@/lib/db";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { isOperator } from "@/lib/roles";
import { ensureStudioSchema } from "@/lib/studio";
import { Page } from "@/components/ui";
import StudioApp from "@/components/studio/StudioApp";

export const dynamic = "force-dynamic";

export default async function Studio() {
  ensureStudioSchema();
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);

  // Gate the page as well as the routes. The routes are the real fence; this
  // just stops a signed-out operator staring at an editor that answers 401 to
  // everything it touches.
  if (!isOperator(user)) {
    return (
      <Page title="Promo studio" sub="Operator side only.">
        <div className="card p-6">
          <p className="text-sm text-muted mb-4">
            The studio makes sponsor material that hasn&apos;t been released yet, so it
            stays behind the curtain. Sign in with an operator account.
          </p>
          <Link href="/signin" className="btn btn-neon inline-block">Sign in</Link>
        </div>
      </Page>
    );
  }

  const sponsors = all<any>("SELECT id,name,city FROM sponsors ORDER BY name");

  return (
    <Page
      title="Promo studio"
      sub="Type a prompt, get pictures, cut them on a timeline, export a clip. For the promo you send a sponsor while you still have them on the phone."
      actions={<Link href="/admin/offers" className="btn">Sponsor offers →</Link>}
    >
      <StudioApp sponsors={sponsors} />
    </Page>
  );
}
