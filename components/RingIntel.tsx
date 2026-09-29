"use client";
import { useEffect, useState } from "react";
import { Phone, Globe, MapPin, AlertTriangle, Building2, Loader2, BadgeCheck } from "lucide-react";
import Collapse from "./Collapse";
import UsRings from "./UsRings";
import PostalAssist from "./PostalAssist";
import { hubsByCountry, hubLabel, isUsHub } from "@/lib/hub-groups";

// Operator's booking sheet for a ring: pick the loop, get every town in route
// order with the sites that could actually hold the night, ranked by how
// bookable they are — and the towns that have nothing, which are the legs that
// break the tour. Chamber of Commerce sits beside each town as the way in when
// no room answers the phone.
export default function RingIntel() {
  const [rings, setRings] = useState<any[]>([]);
  const [slug, setSlug] = useState("");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  async function load(s?: string) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/admin/ring${s ? `?hub=${encodeURIComponent(s)}` : ""}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't load the ring."); return; }
      setData(d); setRings(d.rings || []); setSlug(d.hub.slug);
    } catch { setErr("Couldn't load the ring."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  if (busy && !data) return <div className="card p-6 text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Loading the ring…</div>;
  if (err) return <div className="card p-6 text-sm" style={{ color: "#e05c7a" }}>{err}</div>;
  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">Ring</span>
          <select value={slug} onChange={e => { setSlug(e.target.value); load(e.target.value); }}
            className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon">
            {/* Canada and the USA are separate groups. The rules change at the
                line, so a flat list would imply they're interchangeable. */}
            {hubsByCountry(rings).map(g => (
              <optgroup key={g.country} label={g.label}>
                {g.hubs.map((r: any) => (
                  <option key={r.slug} value={r.slug}>{hubLabel(r)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {busy && <Loader2 size={14} className="animate-spin text-muted" />}
          <div className="text-xs text-muted ml-auto">{data.hub.tagline}</div>
        </div>

        <div className="mt-3"><PostalAssist defaultCountry={isUsHub(data.hub) ? "US" : "CA"} /></div>

        {/* A US ring is not a Canadian ring with a different postcode. Work
            permits, withholding and carnets all change at the line, and the
            reason a US act is on ROADIE at all is usually that they want to
            come north — so the route north is one click from here, never
            something they have to know to go looking for. */}
        {isUsHub(data.hub) && (
          <div className="mt-3 rounded-xl border p-3 text-xs"
               style={{ borderColor: "#ffb33d", background: "rgba(255,179,61,0.06)" }}>
            <div className="font-bold mb-1" style={{ color: "#ffb33d" }}>
              United States ring — different rules
            </div>
            <p className="text-muted">
              Work permits, tax withholding and gear carnets are not the same as they are in
              Canada. Coming north is the easier direction: a US act playing Canada is
              work-permit exempt under R186(g). We can help you set it up.
            </p>
            <a href="/crossing?from=US&to=CA" className="btn btn-neon mt-2 inline-block">
              Touring north — border &amp; visas
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
          {[
            ["towns on loop", `${s.towns_with_rooms}/${s.towns_on_loop}`, "with rooms"],
            ["host sites", s.total_sites, `${s.contactable} contactable`],
            ["claimed", s.claimed, "by a real operator"],
            ["chambers", s.chambers, "town contacts"],
            ["broken legs", s.broken_legs.length, "towns with nothing"],
          ].map(([lbl, val, sub]: any) => (
            <div key={lbl} className="bg-ink/60 border border-edge rounded-xl p-3">
              <div className="text-lg font-black">{val}</div>
              <div className="text-[11px] text-muted">{lbl}</div>
              <div className="text-[10px] text-muted">{sub}</div>
            </div>
          ))}
        </div>

        {s.broken_legs.length > 0 && (
          <div className="mt-3 text-xs flex items-start gap-2" style={{ color: "#ffb33d" }}>
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              No room on file in <b>{s.broken_legs.join(", ")}</b> — the ring can&rsquo;t book those stops
              until something is imported or claimed there.
            </span>
          </div>
        )}
      </div>

      {data.towns.filter((t: any) => t.on_loop || t.site_count).map((t: any) => (
        // Closed by default: twenty-six towns with their rooms open at once is a
        // dump, not a page. The shut row still carries the counts and warnings,
        // so you can pick the town you want without opening any of them.
        <Collapse key={t.town} storageKey={`town_${t.town}`}
          tone={t.gap ? "#ffb33d" : undefined}
          title={<span className="inline-flex items-center gap-2"><MapPin size={14} className="text-muted" />{t.town}</span>}
          count={`${t.site_count} site${t.site_count === 1 ? "" : "s"}`}
          pills={<>
            {!t.on_loop && <span className="pill text-[10px] shrink-0">in ring, off the named loop</span>}
            {t.gap && <span className="pill text-[10px] shrink-0" style={{ borderColor: "#ffb33d", color: "#ffb33d" }}>no rooms</span>}
          </>}
          meta={`${t.contactable} contactable · ${t.claimed} claimed`}>

          {t.chamber.length > 0 && (
            <div className="mt-2 text-xs bg-ink/60 border border-edge rounded-lg p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1">town contact</div>
              {t.chamber.map((c: any) => (
                <div key={c.name} className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1"><Building2 size={12} className="text-neon" />{c.name}</span>
                  {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-cyan hover:underline"><Phone size={11} />{c.phone}</a>}
                  {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan hover:underline"><Globe size={11} />site</a>}
                </div>
              ))}
            </div>
          )}

          {t.site_count > 0 ? (
            <div className="mt-2 space-y-1">
              {(open === t.town ? t.all_sites : t.best).map((v: any, i: number) => (
                <div key={v.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-edge last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm flex items-center gap-2">
                      <span className="text-muted text-[11px] w-4 shrink-0">{i + 1}.</span>
                      <span className="truncate">{v.name}</span>
                      {v.claimed && <BadgeCheck size={12} style={{ color: "#3ddc84" }} />}
                    </div>
                    <div className="text-[11px] text-muted ml-6">
                      {v.kind || "site"}{v.capacity ? ` · cap ${v.capacity}` : ""} — {v.why.join(" · ")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {v.contact
                      ? <a href={/^https?:/i.test(v.contact) ? v.contact : `tel:${v.contact}`}
                           target="_blank" rel="noreferrer"
                           className="text-cyan hover:underline text-xs break-all">{v.contact}</a>
                      : <span className="text-[11px]" style={{ color: "#e05c7a" }}>no contact</span>}
                  </div>
                </div>
              ))}
              {t.all_sites.length > t.best.length && (
                <button onClick={() => setOpen(open === t.town ? null : t.town)}
                  className="text-[11px] text-cyan hover:underline">
                  {open === t.town ? "show top 5 only" : `show all ${t.all_sites.length}`}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted">
              Nothing on file. Import the corridor
              (<code className="text-[11px]">import-osm-venues.mjs</code>) or claim a room here.
            </div>
          )}
        </Collapse>
      ))}

      {/* Every US ring at once, shut and greyed. Not a dropdown you have to
          work through one at a time — a shelf you can see the whole of. */}
      <UsRings rings={rings} />
    </div>
  );
}
