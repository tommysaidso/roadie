"use client";
import { useEffect, useState } from "react";
import { Search, Plus, Trash2, ExternalLink, Guitar } from "lucide-react";

type Venue = { id: number; name: string; city: string };
type Item = { id?: number; venue_id?: number; category?: string; item: string; brand?: string; buy_url?: string; price?: string; sponsor_name?: string };

export default function BacklineEditor() {
  const [q, setQ] = useState(""); const [hits, setHits] = useState<Venue[]>([]);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [items, setItems] = useState<Item[]>([]); const [cats, setCats] = useState<string[]>([]);
  const [err, setErr] = useState(""); const [draft, setDraft] = useState<Item>({ item: "" });

  async function search(term: string) {
    setQ(term); if (term.trim().length < 2) { setHits([]); return; }
    const r = await fetch("/api/backline?venues=" + encodeURIComponent(term));
    if (r.status === 403) { setErr("Operator access only."); return; }
    const d = await r.json(); setHits(d.venues || []); setCats(d.categories || []);
  }
  async function pick(v: Venue) { setVenue(v); setHits([]); setQ(""); await load(v.id); }
  async function load(vid: number) {
    const d = await fetch("/api/backline?venue=" + vid).then(r => r.json());
    setItems(d.items || []); if (d.categories) setCats(d.categories);
  }
  async function save(it: Item) {
    if (!venue || !it.item.trim()) return;
    await fetch("/api/backline", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...it, venue_id: venue.id }) });
    setDraft({ item: "" }); load(venue.id);
  }
  async function del(id?: number) {
    if (!id || !venue) return;
    await fetch("/api/backline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load(venue.id);
  }

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 text-sm text-amber">{err}</div>}

      {!venue ? (
        <div className="card p-4">
          <div className="label mb-2">Pick the venue / stage</div>
          <div className="flex items-center gap-2 bg-ink border border-edge rounded-lg px-3">
            <Search size={15} className="text-muted" />
            <input value={q} onChange={e => search(e.target.value)} placeholder="venue name or town…"
              className="flex-1 bg-transparent border-0 outline-none py-2 text-sm" />
          </div>
          {hits.map(v => (
            <button key={v.id} onClick={() => pick(v)} className="w-full text-left px-2 py-2 mt-1 rounded hover:bg-panel2 text-sm flex justify-between">
              <span className="font-medium">{v.name}</span><span className="text-muted text-xs">{v.city}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
            <div><div className="font-bold">{venue.name}</div><div className="text-xs text-muted">{venue.city} · backline</div></div>
            <div className="flex gap-3 items-center">
              <a href={`/backline/${venue.id}`} target="_blank" rel="noreferrer" className="text-xs text-neon flex items-center gap-1">public page <ExternalLink size={12} /></a>
              <button onClick={() => { setVenue(null); setItems([]); }} className="btn text-xs">change venue</button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map(b => (
              <div key={b.id} className="card p-3 flex items-center gap-3">
                <Guitar size={16} className="text-neon shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{b.item}</div>
                  <div className="text-[11px] text-muted">{[b.brand, b.category, b.price].filter(Boolean).join(" · ")}{b.buy_url ? " · has buy link" : " · no link yet"}</div>
                </div>
                <button onClick={() => del(b.id)} className="text-muted hover:text-white shrink-0"><Trash2 size={15} /></button>
              </div>
            ))}
            {items.length === 0 && <div className="text-sm text-muted px-1">No gear listed yet — add the backline below.</div>}
          </div>

          <div className="card p-4 space-y-2">
            <div className="label">Add gear</div>
            <div className="flex flex-wrap gap-2">
              <input value={draft.item} onChange={e => setDraft({ ...draft, item: e.target.value })} placeholder='item e.g. Zildjian A Custom 18" crash'
                className="flex-1 min-w-[200px] bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
              <input value={draft.brand || ""} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="brand"
                className="w-32 bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
              <select value={draft.category || ""} onChange={e => setDraft({ ...draft, category: e.target.value })}
                className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon">
                <option value="">category</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={draft.buy_url || ""} onChange={e => setDraft({ ...draft, buy_url: e.target.value })} placeholder="buy link (https://…)"
                className="flex-1 min-w-[220px] bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
              <input value={draft.price || ""} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="price (optional)"
                className="w-32 bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon" />
              <button disabled={!draft.item.trim()} onClick={() => save(draft)} className="btn btn-neon text-sm flex items-center gap-1"><Plus size={14} />add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
