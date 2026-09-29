"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, MapPin, Users, Guitar, Building2, ChevronRight } from "lucide-react";

// The base: who is actually on ROADIE. Deliberately a rolodex of collapsed
// rows, not a wall of cards — 20 bands and 898 host sites as full cards is
// unusable, and nobody comes here to browse profiles. You come to find one
// name. Expand a row for the detail.
type Tab = "bands" | "sites";

export default function Directory({ bandCount, siteCount }: { bandCount: number; siteCount: number }) {
  const [tab, setTab] = useState<Tab>("bands");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const term = q.trim();
        const url = tab === "bands"
          ? `/api/bands${term ? `?q=${encodeURIComponent(term)}` : ""}`
          : `/api/venues?limit=60${term ? `&q=${encodeURIComponent(term)}` : ""}`;
        const r = await fetch(url);
        const d = await r.json();
        if (dead) return;
        setRows(tab === "bands" ? (d.bands || []) : (d.venues || []));
      } catch { if (!dead) setRows([]); }
      finally { if (!dead) setBusy(false); }
    }, 220);
    return () => { dead = true; clearTimeout(t); };
  }, [q, tab]);

  const Tabs = () => (
    <div className="flex gap-2">
      {([["bands", "Bands", bandCount, Guitar], ["sites", "Host sites", siteCount, Building2]] as const)
        .map(([k, label, n, Icon]) => (
          <button key={k} onClick={() => { setTab(k as Tab); setQ(""); setOpen(null); }}
            className={`btn text-sm flex items-center gap-1.5 ${tab === k ? "btn-neon" : ""}`}>
            <Icon size={14} />{label} <span className="text-muted">{n}</span>
          </button>
        ))}
    </div>
  );

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs />
        <div className="flex items-center gap-2 bg-ink border border-edge rounded-lg px-3 flex-1 min-w-[180px]">
          <Search size={15} className="text-muted shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder={tab === "bands" ? "Find a band…" : "Find a town or room…"}
            className="flex-1 bg-transparent border-0 outline-none py-2 text-sm min-w-0" />
          {busy && <Loader2 size={14} className="animate-spin text-muted shrink-0" />}
        </div>
      </div>

      <div className="mt-3 divide-y divide-edge">
        {rows.map((r: any) => {
          const isOpen = open === r.id;
          return (
            <div key={r.id}>
              <button onClick={() => setOpen(isOpen ? null : r.id)}
                className="w-full flex items-center gap-2 py-2 text-left hover:bg-panel2 rounded-lg px-2 -mx-2">
                <ChevronRight size={14}
                  className={`text-muted shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                <span className="text-sm font-medium truncate flex-1">{r.name}</span>
                <span className="text-xs text-muted truncate hidden sm:block">
                  {tab === "bands"
                    ? [r.home_city, String(r.genres || r.genre || "").split(",")[0]].filter(Boolean).join(" · ")
                    : [r.city, r.capacity ? `cap ${r.capacity}` : ""].filter(Boolean).join(" · ")}
                </span>
                {r.member_status === "member" && <span className="pill text-[11px] shrink-0">member</span>}
              </button>

              {isOpen && (
                <div className="px-6 pb-3 text-xs text-muted space-y-1.5">
                  <div className="flex flex-wrap gap-3">
                    {(r.home_city || r.city) &&
                      <span className="flex items-center gap-1"><MapPin size={12} />{r.home_city || r.city}, {r.home_region || r.region || "BC"}</span>}
                    {tab === "bands" && r.draw ? <span className="flex items-center gap-1"><Users size={12} />~{r.draw} draw</span> : null}
                    {tab === "sites" && r.capacity ? <span className="flex items-center gap-1"><Users size={12} />{r.capacity} capacity</span> : null}
                    {tab === "sites" && r.pay_model ? <span>{String(r.pay_model).replace(/_/g, " ")}</span> : null}
                  </div>
                  {tab === "bands" && r.bio_short && <p className="text-muted">{r.bio_short}</p>}
                  {tab === "sites" && r.backline && <p className="text-muted">Backline: {r.backline}</p>}
                  <a href={tab === "bands" ? `/garage?band=${r.id}` : `/venues?v=${r.id}`}
                    className="text-cyan hover:underline inline-block">
                    {tab === "bands" ? "Open their page →" : "Open this room →"}
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {!busy && !rows.length && (
          <div className="text-sm text-muted py-6 text-center">
            {q.trim() ? `Nothing matching “${q.trim()}”.` : "Nothing here yet."}
          </div>
        )}
      </div>

      {tab === "sites" && !q.trim() && siteCount > rows.length && (
        <div className="text-xs text-muted mt-3">
          Showing {rows.length} of {siteCount} — search to narrow it, or see them all on the{" "}
          <a href="/venues" className="text-cyan hover:underline">Host Sites</a> page.
        </div>
      )}
    </div>
  );
}
