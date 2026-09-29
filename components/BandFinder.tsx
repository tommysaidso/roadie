"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, Plus } from "lucide-react";

// Shown when we don't know which band is yours. The old Garage answered that by
// listing every act on the platform, which is somebody else's business — you
// come here for your own kit. So: find yours, claim it, or start it.
export default function BandFinder({ signedIn }: { signedIn: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setHits([]); return; }
      setBusy(true);
      try {
        const r = await fetch(`/api/bands?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setHits((Array.isArray(d) ? d : d.bands || []).slice(0, 8));
      } catch { setHits([]); }
      finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function claim(id: number, name: string) {
    if (!signedIn) { window.location.href = "/signin"; return; }
    setMsg("");
    const r = await fetch(`/api/bands/${id}/claim`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d.message || "Couldn't claim that one — it may already be taken."); return; }
    window.location.reload();
  }

  return (
    <div className="card p-5 mb-4">
      <div className="text-lg font-black">Which one is yours?</div>
      <p className="text-sm text-muted mt-1">
        Search for your act. If it's already listed, claim it and the page becomes yours.
        {!signedIn && <> You'll need to <a href="/signin" className="text-cyan hover:underline">sign in</a> to claim.</>}
      </p>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 flex items-center gap-2 bg-ink border border-edge rounded-lg px-3">
          <Search size={15} className="text-muted shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Your band name…"
            className="flex-1 bg-transparent border-0 outline-none py-2 text-sm" />
          {busy && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
        <a href="/setup" className="btn btn-neon text-sm flex items-center gap-1 shrink-0">
          <Plus size={14} />New
        </a>
      </div>

      {hits.length > 0 && (
        <div className="mt-3 space-y-1">
          {hits.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between gap-2 py-2 border-b border-edge last:border-0">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className="text-xs text-muted truncate">
                  {b.home_city}{b.genres ? ` · ${String(b.genres).split(",")[0]}` : ""}
                </div>
              </div>
              {b.user_id
                ? <span className="pill text-[11px] shrink-0">claimed</span>
                : <button onClick={() => claim(b.id, b.name)} className="btn text-xs shrink-0">that&rsquo;s us</button>}
            </div>
          ))}
        </div>
      )}

      {q.trim().length >= 2 && !busy && !hits.length && (
        <div className="text-sm text-muted mt-3">
          Nothing by that name — <a href="/setup" className="text-cyan hover:underline">start your page</a>.
        </div>
      )}
      {msg && <div className="text-xs mt-2" style={{ color: "#e05c7a" }}>{msg}</div>}
    </div>
  );
}
