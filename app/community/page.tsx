import { one, all } from "@/lib/db";
import { Page } from "@/components/ui";
import Community from "@/components/Community";
import Directory from "@/components/Directory";
import PromoBanner from "@/components/PromoBanner";
import SparkForm from "@/components/SparkForm";
import ReactButton from "@/components/ReactButton";
import { MapPin, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community: bands, rooms and pros",
  description: "Everyone on ROADIE: the bands, the rooms and grounds that host them, and the pros who keep them working. Post a need and get matched by skill and area.",
  alternates: { canonical: "/community" },
};

export default function CommunityPage() {
  const bandCount = Number((one<any>("SELECT COUNT(*) n FROM bands") || {}).n || 0);
  const siteCount = Number((one<any>("SELECT COUNT(*) n FROM venues") || {}).n || 0);
  const sparks = all<any>("SELECT * FROM notices WHERE kind='spark' ORDER BY reactions DESC, created_at DESC LIMIT 20");

  return (
    <Page
      title="Community"
      sub="Everyone on ROADIE: the bands, the rooms and grounds that host them, and the pros who keep them working. Flag a #need — producer, gig, gear, video — and ROADIE matches you by skill and area."
    >
      <Directory bandCount={bandCount} siteCount={siteCount} />

      <div className="label mt-8 mb-2">Lifeline — who needs what</div>
      <Community />

      <div className="mt-10">
        <div className="label mb-3">Local Sparks — unsigned talent worth watching</div>
        <p className="text-xs text-muted mb-4">
          Seen something local that should be on a bigger stage? Post them here. Fans vote. The ring team watches.
        </p>

        {sparks.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {sparks.map((s: any) => (
              <div key={s.id} className="card p-4">
                <div className="font-bold">{s.title}</div>
                <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                  <MapPin size={11} />{s.city}
                </div>
                <p className="text-sm text-muted mt-2">{s.body}</p>
                <div className="flex items-center gap-2 mt-3">
                  <ReactButton noticeId={s.id} initial={s.reactions || 0} />
                  {s.contact && (
                    <a href={s.contact} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs pill hover:border-neon">
                      <ExternalLink size={11} /> View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <SparkForm />
      </div>

      <div className="mt-6">
        <PromoBanner src="/promo/gear-swap.png" alt="Gear swap - do not haul your backline across four provinces" maxH={300} />
        <p className="text-sm text-muted -mt-2 px-1">
          Gear swap &amp; consignment between bands on the road — module in the works. Flag <b>#needgear</b> in
          the meantime and ROADIE will match by route.
        </p>
      </div>
    </Page>
  );
}
