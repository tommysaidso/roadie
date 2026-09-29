"use client";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Check, Phone, DoorOpen, X, Ticket, Copy, TrendingUp } from "lucide-react";

type Row = {
  id?: number|null; hub_id?: number|null; business_name: string; city?: string|null;
  region?: string|null; venue_id?: number|null; email?: string|null; contact?: string|null;
  status: string; channel?: string|null; note?: string|null; offer_id?: number|null;
  lift?: { redemptions: number; last: string|null } | null;
};
type Hub = { slug: string; name: string; country: string; province: string; live: number };

const STATUS: Record<string, string> = {
  target: "#8a8aa0", contacted: "#3df0ff", interested: "#ffb33d", signed: "#3ddc84", declined: "#ff6a6a",
};

export default function CanvassBoard() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hub, setHub] = useState<string>("");
  const [logged, setLogged] = useState<Row[]>([]);
  const [targets, setTargets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load(slug?: string) {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/canvass" + (slug ? "?hub=" + encodeURIComponent(slug) : ""));
      if (r.status === 403) { setErr("Operator access only — sign in as an admin/dev-team account."); setLoading(false); return; }
      const d = await r.json();
      setHubs(d.hubs || []); setHub(d.hub?.slug || slug || "");
      setLogged(d.logged || []); setTargets(d.targets || []);
    } catch { setErr("Couldn't load."); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => [...logged, ...targets], [logged, targets]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { target: 0, contacted: 0, interested: 0, signed: 0, declined: 0 };
    rows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  async function save(row: Row, patch: Partial<Row>) {
    const body: any = { ...row, ...patch, hub_id: (hubs.find(h => h.slug === hub) ? undefined : undefined) };
    body.hub_id = row.hub_id ?? undefined;
    await fetch("/api/canvass", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load(hub);
  }
  async function signup(row: Row, pct: number) {
    if (!(pct >= 0)) return;
    await fetch("/api/canvass", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "signup", outreachId: row.id || undefined, hub_id: row.hub_id, business_name: row.business_name, city: row.city, region: row.region, discountPct: pct, email: row.email, contact: row.contact }) });
    load(hub);
  }
  function copyEmails() {
    const emails = rows.map(r => r.email).filter(Boolean).join(", ");
    try { navigator.clipboard.writeText(emails); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="label">Area</div>
          <select value={hub} onChange={e => load(e.target.value)}
            className="mt-1 bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon">
            {hubs.map(h => <option key={h.slug} value={h.slug}>{h.name} · {h.country}{h.live ? "" : " (mapped)"}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-3 text-xs ml-auto">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: STATUS[k] }} />{v} {k}</span>
          ))}
        </div>
        <button onClick={copyEmails} className="btn text-xs flex items-center gap-1"><Copy size={13} />Copy callout emails</button>
      </div>

      {err && <div className="card p-4 text-sm text-amber">{err}</div>}
      {loading && <div className="text-sm text-muted">Loading…</div>}

      <div className="space-y-2">
        {rows.map((r, i) => <CanvassRow key={(r.id ?? "t") + "-" + (r.venue_id ?? i)} row={r} onSave={save} onSignup={signup} />)}
        {!loading && rows.length === 0 && <div className="card p-5 text-sm text-muted">No rooms or businesses mapped in this area yet — seed some, or add one below.</div>}
      </div>

      <AddBusiness hub={hubs.find(h => h.slug === hub)} onAdd={(row) => save(row as Row, {})} />
    </div>
  );
}

function CanvassRow({ row, onSave, onSignup }: { row: Row; onSave: (r: Row, p: Partial<Row>) => void; onSignup: (r: Row, pct: number) => void; }) {
  const [note, setNote] = useState(row.note || "");
  const [pct, setPct] = useState<string>("10");
  const [open, setOpen] = useState(false);
  const color = STATUS[row.status] || "#8a8aa0";
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{row.business_name}</div>
          <div className="text-[11px] text-muted flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={11} />{row.city || "—"}</span>
            <span style={{ color }}>{row.status}</span>
            {row.offer_id && row.lift && <span className="flex items-center gap-1" style={{ color: "#3ddc84" }}><TrendingUp size={11} />{row.lift.redemptions} redemptions</span>}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)} className="btn text-[11px] shrink-0">{open ? "close" : "work it"}</button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-edge space-y-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onSave(row, { status: "contacted", channel: "door", note })} className="btn text-[11px] flex items-center gap-1"><DoorOpen size={12} />door</button>
            <button onClick={() => onSave(row, { status: "contacted", channel: "phone", note })} className="btn text-[11px] flex items-center gap-1"><Phone size={12} />called</button>
            <button onClick={() => onSave(row, { status: "interested", note })} className="btn text-[11px] flex items-center gap-1" style={{ color: "#ffb33d" }}><Check size={12} />interested</button>
            <button onClick={() => onSave(row, { status: "declined", note })} className="btn text-[11px] flex items-center gap-1" style={{ color: "#ff6a6a" }}><X size={12} />declined</button>
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} onBlur={() => onSave(row, { note })}
            placeholder="note — who you talked to, what they said…"
            className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
          <div className="flex items-center gap-2 pt-1">
            <Ticket size={14} className="text-neon" />
            <span className="text-[11px] text-muted">Sign up to JamPoints (free) — discount</span>
            <input value={pct} onChange={e => setPct(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-14 bg-ink border border-edge rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-neon" />
            <span className="text-[11px] text-muted">%</span>
            <button onClick={() => onSignup(row, Number(pct || "0"))} className="btn btn-neon text-[11px]">sign up</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddBusiness({ hub, onAdd }: { hub?: Hub; onAdd: (r: any) => void }) {
  const [name, setName] = useState(""); const [city, setCity] = useState(""); const [email, setEmail] = useState("");
  return (
    <div className="card p-4">
      <div className="label mb-2">Add a business to work</div>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="business name"
          className="flex-1 min-w-[140px] bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
        <input value={city} onChange={e => setCity(e.target.value)} placeholder="town"
          className="w-32 bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email (callout list)"
          className="w-52 bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
        <button disabled={!name.trim()} onClick={() => { onAdd({ business_name: name.trim(), city: city.trim() || null, email: email.trim() || null, region: hub?.province || null, status: "target" }); setName(""); setCity(""); setEmail(""); }}
          className="btn btn-neon text-sm">add</button>
      </div>
    </div>
  );
}
