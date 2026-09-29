"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, BadgeCheck, Phone } from "lucide-react";
import Collapse from "./Collapse";
import { hubLabel } from "@/lib/hub-groups";

// The US corridor, all rings at once.
//
// Canada runs through the ring selector one at a time because you're working
// it. The US rings aren't engaged yet, so they're a shelf: every ring on screen
// as a shut, greyed row you can open when you want to look.
//
// Greyed does NOT mean disabled. A room in Bellingham that wants to host is a
// sale whether or not the ring around it has started, so every site stays
// openable and claimable. Locking these behind "coming soon" would throw away
// the business that walks in early.

type Site = {
  id: number; name: string; kind?: string; capacity?: number;
  contact?: string; claimed?: boolean; why?: string[];
};

export default function UsRings({ rings }: { rings: any[] }) {
  const us = (rings || []).filter(r => String(r.country || "CA").toUpperCase() === "US");
  const [availOnly, setAvailOnly] = useState(false);

  if (!us.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-black">United States</h3>
        <span className="pill text-[10px]" style={{ borderColor: "#8a8aa0", color: "#8a8aa0" }}>
          coming soon
        </span>
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer ml-auto">
          <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)} />
          Available only
        </label>
      </div>
      <p className="text-xs text-muted -mt-1">
        Not engaged yet — but open any of them. A room that wants in can still be claimed,
        and an early one is still a sale.
      </p>

      {us.map(r => <UsRing key={r.slug} ring={r} availOnly={availOnly} />)}
    </div>
  );
}

function UsRing({ ring, availOnly }: { ring: any; availOnly: boolean }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Lazy: six rings' worth of towns fetched up front would be a lot of work
  // for a shelf nobody has opened yet.
  const load = useCallback(async () => {
    if (loaded || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/admin/ring?hub=${encodeURIComponent(ring.slug)}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't load that ring."); return; }
      setData(d); setLoaded(true);
    } catch { setErr("Couldn't load that ring."); }
    finally { setBusy(false); }
  }, [ring.slug, loaded, busy]);

  const towns = (data?.towns || []).filter((t: any) => t.on_loop || t.site_count);
  const avail = (list: Site[]) => availOnly ? list.filter(v => !v.claimed) : list;

  return (
    <div className="opacity-70 hover:opacity-100 transition-opacity">
      <Collapse
        storageKey={`usring_${ring.slug}`}
        title={<span className="inline-flex items-center gap-2">
          <MapPin size={14} className="text-muted" />{hubLabel(ring)}
        </span>}
        pills={<span className="pill text-[10px] shrink-0"
                     style={{ borderColor: "#8a8aa0", color: "#8a8aa0" }}>coming soon</span>}
        meta={ring.tagline || ""}
      >
        <div onMouseEnter={load}>
          {!loaded && !busy && !err && (
            <button className="btn text-sm" onClick={load}>Look inside</button>
          )}
          {busy && <div className="text-sm text-muted flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />Loading…
          </div>}
          {err && <div className="text-sm" style={{ color: "#e05c7a" }}>{err}</div>}

          {loaded && !towns.length && (
            <div className="text-sm text-muted">
              Nothing on file for this ring yet.
            </div>
          )}

          {loaded && towns.map((t: any) => {
            const sites: Site[] = avail(t.all_sites || t.best || []);
            if (availOnly && !sites.length) return null;
            return (
              <Collapse key={t.town} storageKey={`usring_${ring.slug}_${t.town}`}
                title={t.town}
                count={`${sites.length} site${sites.length === 1 ? "" : "s"}`}
                meta={`${t.contactable} contactable · ${t.claimed} claimed`}>
                <div className="space-y-1">
                  {sites.map((v, i) => (
                    <div key={v.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-edge last:border-0">
                      <div className="min-w-0">
                        <div className="text-sm flex items-center gap-2">
                          <span className="text-muted text-[11px] w-4 shrink-0">{i + 1}.</span>
                          <span className="truncate">{v.name}</span>
                          {v.claimed && <BadgeCheck size={12} style={{ color: "#3ddc84" }} />}
                        </div>
                        <div className="text-[11px] text-muted ml-6">
                          {v.kind || "site"}{v.capacity ? ` · cap ${v.capacity}` : ""}
                          {v.why?.length ? ` — ${v.why.join(" · ")}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        {v.contact
                          ? <a href={/^https?:/i.test(v.contact) ? v.contact : `tel:${v.contact}`}
                               target="_blank" rel="noreferrer"
                               className="text-cyan hover:underline text-xs break-all">{v.contact}</a>
                          : <span className="text-[11px] flex items-center gap-1" style={{ color: "#e05c7a" }}>
                              <Phone size={10} />no contact
                            </span>}
                        {/* Claimable even while the ring is dark — an early
                            host is still business we do not want to turn away. */}
                        {!v.claimed && (
                          <Link href="/backend/venue" className="btn text-[11px] px-2 py-1 shrink-0">
                            Claim
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Collapse>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}
