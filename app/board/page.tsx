import { all } from "@/lib/db";
import { Page, Tag } from "@/components/ui";
import { CalendarRange, MapPin, Phone } from "lucide-react";
import CarpoolForm from "@/components/CarpoolForm";
import ReactButton from "@/components/ReactButton";
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  touring: "Touring", gig_gap: "Gig gap", seeking_opener: "Opener wanted",
  seeking_band: "Band wanted", runout: "Runout", bill_swap: "Bill swap", gear: "Gear",
  carpool: "Catch a Ride", spark: "Local Spark",
};

export default async function Board({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "board" } = await searchParams;
  const isCarpool = tab === "carpool";

  const notices = isCarpool
    ? all<any>("SELECT * FROM notices WHERE kind='carpool' ORDER BY reactions DESC, created_at DESC")
    : all<any>("SELECT * FROM notices WHERE kind NOT IN ('carpool','spark') ORDER BY created_at DESC");

  const tabs = [
    { id: "board", label: "Notice Board" },
    { id: "carpool", label: "Catch a Ride" },
  ];

  return (
    <Page title="Notice Board" sub="The community wall. Bands say where they're touring and what they need; venues post gaps; bookers float runouts. No over-marketing — just the signal.">
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <a key={t.id} href={`/board?tab=${t.id}`}
            className={`pill text-sm ${tab === t.id ? "border-neon text-neon" : "hover:border-neon"}`}>
            {t.label}
          </a>
        ))}
      </div>

      {isCarpool && (
        <div className="mb-6">
          <CarpoolForm />
        </div>
      )}

      {!notices.length && (
        <div className="card p-4 text-sm text-muted">
          {isCarpool ? "No ride posts yet — be the first." : "Nothing posted yet."}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {notices.map((n: any) => (
          <div key={n.id} className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Tag>{KIND[n.kind] || n.kind}</Tag>
              {n.genre && <Tag>{n.genre}</Tag>}
            </div>
            <div className="text-lg font-bold">{n.title}</div>
            <p className="text-sm text-muted mt-1">{n.body}</p>
            <div className="text-xs text-muted mt-3 flex gap-3 flex-wrap items-center">
              <span className="flex items-center gap-1"><MapPin size={12} />{n.city}</span>
              {n.date_from && (
                <span className="flex items-center gap-1">
                  <CalendarRange size={12} />{n.date_from}{n.date_to && n.date_to !== n.date_from ? ` -> ${n.date_to}` : ""}
                </span>
              )}
              {n.contact && (
                <span className="flex items-center gap-1"><Phone size={12} />{n.contact}</span>
              )}
              {isCarpool && (
                <span className="ml-auto">
                  <ReactButton noticeId={n.id} initial={n.reactions || 0} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
