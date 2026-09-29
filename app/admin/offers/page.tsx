import { cookies } from "next/headers";
import Link from "next/link";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import { isOperator } from "@/lib/roles";
import { ensureStudioSchema } from "@/lib/studio";
import { Page } from "@/components/ui";
import OfferBuilder from "@/components/studio/OfferBuilder";

export const dynamic = "force-dynamic";

export default async function Offers() {
  ensureStudioSchema();
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);

  if (!isOperator(user)) {
    return (
      <Page title="Sponsor offers" sub="Operator side only.">
        <div className="card p-6">
          <p className="text-sm text-muted mb-4">
            Pricing and pitch notes stay behind the curtain. Sign in with an operator account.
          </p>
          <Link href="/signin" className="btn btn-neon inline-block">Sign in</Link>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Sponsor offers"
      sub="Build the package, attach the promo, copy it into your own email. Nothing here is sent for you and nothing is visible to sponsors until you send it."
      actions={<Link href="/admin/studio" className="btn">Promo studio →</Link>}
    >
      <OfferBuilder />
    </Page>
  );
}
