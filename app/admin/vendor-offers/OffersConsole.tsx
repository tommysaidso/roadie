"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check, ChevronDown, ChevronRight, Plus, RefreshCw, Save, Ban, Undo2, Tag,
} from "lucide-react";

// VENDOR OFFERS CONSOLE
//
// A standing discount from a business on the platform, claimable by any band or
// fan passing through — not tied to a ring night and not bundled into an ad buy.
//
// Everything here ships collapsed. The operator opens the group they came for.

type Offer = {
  id: number;
  sponsor_id: number | null;
  business_name: string;
  city: string | null;
  region: string | null;
  scope: "city" | "region" | "anywhere";
  for_bands: number;
  for_fans: number;
  kind: "percent" | "amount" | "freebie";
  value: number | null;
  currency: string;
  title: string;
  terms: string | null;
  valid_from: string | null;
  valid_to: string | null;
  max_redemptions: number | null;
  per_fan_limit: number;
  active: number;
  suspended: number;
  redemptions?: number;
};

const BLANK: Partial<Offer> = {
  business_name: "", city: "", region: "", scope: "city",
  for_bands: 1, for_fans: 1, kind: "percent", value: 10,
  currency: "CAD", title: "", terms: "", per_fan_limit: 0, active: 1,
};

function money(o: Offer) {
  if (o.kind === "percent") return `${o.value}% off`;
  if (o.kind === "amount") {
    const sym = o.currency === "USD" ? "US$" : "CA$";
    return `${sym}${((o.value || 0) / 100).toFixed(2)} off`;
  }
  return "Freebie";
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label text-xs">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon";

export default function OffersConsole({ enabled }: { enabled: boolean }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Partial<Offer> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/vendor-offers").then(r => r.json()).catch(() => null);
    if (!r) { setErr("Couldn't reach the offers."); setOffers([]); return; }
    if (r.error) { setErr(r.error); setOffers([]); return; }
    setErr(null);
    setOffers(r.offers || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: any) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/vendor-offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()).catch(() => null);
      if (!r || r.error) { setErr(r?.error || "That didn't take."); return false; }
      setErr(null);
      await load();
      return true;
    } finally { setBusy(false); }
  }

  async function save() {
    if (!editing) return;
    const ok = await post({ action: "save", ...editing });
    if (ok) { setSaved(true); setEditing(null); setTimeout(() => setSaved(false), 2000); }
  }

  if (offers === null) return <div className="text-sm text-muted">Reading the offers…</div>;

  // Grouped the way an operator actually looks for them.
  const groups: { key: string; title: string; hint: string; rows: Offer[] }[] = [
    {
      key: "live", title: "Live",
      hint: "Claimable right now by anyone passing through.",
      rows: offers.filter(o => o.active && !o.suspended),
    },
    {
      key: "off", title: "Switched off by the business",
      hint: "The vendor turned these off themselves. Their call, not ours.",
      rows: offers.filter(o => !o.active && !o.suspended),
    },
    {
      key: "suspended", title: "Suspended by ROADIE",
      hint: "We pulled these. The business cannot turn them back on.",
      rows: offers.filter(o => !!o.suspended),
    },
  ];

  return (
    <div className="flex flex-col gap-5">

      {!enabled && (
        <div className="card p-4" style={{ borderColor: "rgba(232,176,75,0.4)" }}>
          <div className="font-bold mb-1" style={{ color: "#e8b04b" }}>Switched off platform-wide</div>
          <p className="text-sm text-muted">
            Offers are built and you can set them up here, but nothing is visible to bands or fans
            until <code>ROADIE_VENDOR_TOKENS=1</code> is set on the container. Until then the public
            API answers 404 and nobody can claim anything.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn btn-neon flex items-center gap-1.5"
          onClick={() => setEditing({ ...BLANK })}>
          <Plus size={15} /> New offer
        </button>
        <button className="btn flex items-center gap-1.5" onClick={load} disabled={busy}>
          <RefreshCw size={15} /> Refresh
        </button>
        {saved && <span className="text-sm flex items-center gap-1" style={{ color: "#3ddc84" }}>
          <Check size={15} /> Saved
        </span>}
        <span className="text-xs text-muted ml-auto">
          {offers.length} offer{offers.length === 1 ? "" : "s"} ·{" "}
          {offers.reduce((n, o) => n + (o.redemptions || 0), 0)} claim
          {offers.reduce((n, o) => n + (o.redemptions || 0), 0) === 1 ? "" : "s"}
        </span>
      </div>

      {err && <div className="card p-3 text-sm" style={{ color: "#e05c7a" }}>{err}</div>}

      {/* ---- editor ---- */}
      {editing && (
        <div className="card p-5 space-y-4" style={{ borderColor: "rgba(255,61,110,0.35)" }}>
          <div className="font-black text-lg">
            {editing.id ? "Edit offer" : "New offer"}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Business">
              <input className={inputCls} value={editing.business_name || ""}
                onChange={e => setEditing({ ...editing, business_name: e.target.value })}
                placeholder="Trail Auto Body" />
            </Field>
            <Field label="The offer, as a fan reads it">
              <input className={inputCls} value={editing.title || ""}
                onChange={e => setEditing({ ...editing, title: e.target.value })}
                placeholder="10% off any breakfast" />
            </Field>
            <Field label="Town">
              <input className={inputCls} value={editing.city || ""}
                onChange={e => setEditing({ ...editing, city: e.target.value })}
                placeholder="Nelson" />
            </Field>
            <Field label="Province / state">
              <input className={inputCls} value={editing.region || ""}
                onChange={e => setEditing({ ...editing, region: e.target.value })}
                placeholder="BC" />
            </Field>

            <Field label="Where it is honoured"
              hint="City is the normal one. Anywhere means every town on the platform.">
              <select className={inputCls} value={editing.scope || "city"}
                onChange={e => setEditing({ ...editing, scope: e.target.value as any })}>
                <option value="city">This town only</option>
                <option value="region">Anywhere in the province or state</option>
                <option value="anywhere">Anywhere we run</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount">
                <select className={inputCls} value={editing.kind || "percent"}
                  onChange={e => setEditing({ ...editing, kind: e.target.value as any })}>
                  <option value="percent">Percent off</option>
                  <option value="amount">Amount off</option>
                  <option value="freebie">Something free</option>
                </select>
              </Field>
              <Field label={editing.kind === "amount" ? "Cents off" : "Percent"}>
                <input className={inputCls} type="number" value={editing.value ?? 0}
                  disabled={editing.kind === "freebie"}
                  onChange={e => setEditing({ ...editing, value: Number(e.target.value) })} />
              </Field>
            </div>

            <Field label="Small print, in their words">
              <input className={inputCls} value={editing.terms || ""}
                onChange={e => setEditing({ ...editing, terms: e.target.value })}
                placeholder="Not on holidays. One per table." />
            </Field>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.for_bands}
                  onChange={e => setEditing({ ...editing, for_bands: e.target.checked ? 1 : 0 })} />
                Bands
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.for_fans}
                  onChange={e => setEditing({ ...editing, for_fans: e.target.checked ? 1 : 0 })} />
                Fans
              </label>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <input type="checkbox" checked={!!editing.active}
                  onChange={e => setEditing({ ...editing, active: e.target.checked ? 1 : 0 })} />
                Live
              </label>
            </div>

            <Field label="Starts (optional)">
              <input className={inputCls} type="date" value={editing.valid_from || ""}
                onChange={e => setEditing({ ...editing, valid_from: e.target.value })} />
            </Field>
            <Field label="Ends (optional)" hint="Leave both blank and it is a standing offer.">
              <input className={inputCls} type="date" value={editing.valid_to || ""}
                onChange={e => setEditing({ ...editing, valid_to: e.target.value })} />
            </Field>

            <Field label="Total claims allowed" hint="Blank means unlimited.">
              <input className={inputCls} type="number" value={editing.max_redemptions ?? ""}
                onChange={e => setEditing({
                  ...editing,
                  max_redemptions: e.target.value === "" ? null : Number(e.target.value),
                })} />
            </Field>
            <Field label="Per person" hint="0 means unlimited — the point of a standing discount.">
              <input className={inputCls} type="number" value={editing.per_fan_limit ?? 0}
                onChange={e => setEditing({ ...editing, per_fan_limit: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-neon flex items-center gap-1.5" onClick={save} disabled={busy}>
              <Save size={15} /> Save
            </button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ---- groups, closed by default ---- */}
      {groups.map(g => {
        const isOpen = !!open[g.key];
        return (
          <div key={g.key} className="card overflow-hidden">
            <button
              onClick={() => setOpen(p => ({ ...p, [g.key]: !p[g.key] }))}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition">
              {isOpen ? <ChevronDown size={16} className="shrink-0 text-muted" />
                      : <ChevronRight size={16} className="shrink-0 text-muted" />}
              <div className="min-w-0">
                <div className="font-black">{g.title}</div>
                <div className="text-xs text-muted truncate">{g.hint}</div>
              </div>
              <span className="ml-auto text-[11px] pill shrink-0">{g.rows.length}</span>
            </button>

            {isOpen && (
              <div className="border-t border-edge">
                {!g.rows.length && (
                  <div className="px-5 py-4 text-sm text-muted">Nothing here.</div>
                )}
                {g.rows.map(o => (
                  <div key={o.id} className="px-5 py-3 border-b border-edge last:border-0
                                             flex items-start gap-3 flex-wrap">
                    <Tag size={15} className="mt-1 shrink-0" style={{ color: "#ff3d6e" }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">
                        {o.business_name}
                        <span className="text-muted font-normal"> — {o.title}</span>
                      </div>
                      <div className="text-xs text-muted">
                        {money(o)} · {o.scope === "anywhere" ? "anywhere we run"
                          : o.scope === "region" ? (o.region || "region")
                          : (o.city || "town")}
                        {" · "}
                        {o.for_bands && o.for_fans ? "bands and fans"
                          : o.for_bands ? "bands only" : "fans only"}
                        {o.max_redemptions != null && ` · ${o.max_redemptions} max`}
                        {o.valid_to && ` · ends ${o.valid_to}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black">{o.redemptions ?? 0}</div>
                      <div className="text-[10px] text-muted uppercase tracking-wide">claims</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button className="btn px-2 py-1 text-[11px]"
                        onClick={() => setEditing(o)}>edit</button>
                      {o.suspended ? (
                        <button className="btn px-2 py-1 text-[11px] flex items-center gap-1"
                          disabled={busy}
                          onClick={() => post({ action: "suspend", id: o.id, suspended: false })}>
                          <Undo2 size={12} /> restore
                        </button>
                      ) : (
                        <button className="btn px-2 py-1 text-[11px] flex items-center gap-1"
                          disabled={busy}
                          onClick={() => post({ action: "suspend", id: o.id, suspended: true })}>
                          <Ban size={12} /> suspend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
