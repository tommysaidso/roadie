"use client";
import React, { useCallback, useEffect, useState } from "react";

// The picker behind "Insert here".
//
// One panel for two shelves — the Fairlight sound bank and the licensed stock
// shelf — because from the operator's side they are the same gesture: right
// click where you want it, find the thing, click it, it lands there. Keeping
// them in one component keeps that gesture identical.
//
// Everything here is a suggestion you can overrule. Nothing is placed until you
// click it, and what you place goes onto the timeline where it can be moved,
// trimmed or deleted like anything else.

type SfxRow = { id: string; name: string; label: string; url: string; bytes: number };
type StockRow = { id: string; name: string; kind: "image" | "video"; url: string; folder: string };

export default function InsertPicker({
  kind, at, onClose, onPickSound, onPickStock,
}: {
  kind: "sfx" | "stock";
  at: number;
  onClose: () => void;
  onPickSound: (url: string, name: string, dur: number) => void;
  onPickStock: (url: string, kind: "image" | "video", dur: number) => void;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const path = kind === "sfx" ? "/api/admin/studio/sfx" : "/api/admin/studio/stock";
    const r = await fetch(path).then(r => r.json()).catch(() => null);
    if (!r) { setErr("Couldn't reach that shelf."); setRows([]); return; }
    setErr(r.error || null);
    setRows(r.items || []);
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  // Escape closes, like every other dismissable thing here.
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // Stop the preview when the panel goes away, or it keeps playing into the mix.
  useEffect(() => () => { if (preview) { /* element is unmounted with us */ } }, [preview]);

  const needle = q.trim().toLowerCase();
  const shown = (rows || []).filter((r: any) =>
    !needle || (r.label || r.name || "").toLowerCase().includes(needle)).slice(0, 300);

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      className="fixed inset-x-0 bottom-0 z-[205] mx-auto"
      style={{
        maxWidth: 780, maxHeight: "58vh",
        background: "rgba(20,20,28,0.9)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: "1px solid #2a2a3a", borderBottom: "none",
        borderRadius: "14px 14px 0 0",
        boxShadow: "0 -18px 50px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
      }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a3a]">
        <span className="label">
          {kind === "sfx" ? "Sound bank" : "Stock shelf"}
        </span>
        <span className="text-[11px]" style={{ color: "#8a8aa0" }}>
          lands at {at.toFixed(2)}s
        </span>
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
          placeholder={kind === "sfx" ? "search 515 effects" : "search the shelf"}
          className="ml-auto bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm
                     outline-none focus:border-[#ff3d6e] w-56" />
        <button className="btn px-2 py-1 text-[11px]" onClick={onClose}>Close</button>
      </div>

      {rows === null && <div className="p-4 text-sm text-muted">Reading the shelf…</div>}
      {err && <div className="p-4 text-sm" style={{ color: "#e05c7a" }}>{err}</div>}
      {rows && !err && !rows.length && (
        <div className="p-4 text-sm text-muted">
          {kind === "sfx" ? "The sound bank is empty or unreachable."
                          : "Nothing on the shelf yet — drop licensed stills or clips in first."}
        </div>
      )}

      <div className="overflow-y-auto scroll p-2">
        {kind === "sfx" ? (
          <div className="flex flex-col gap-0.5">
            {(shown as SfxRow[]).map(r => (
              <div key={r.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.05]">
                {/* Audition before committing — the name of an effect tells you
                    less than two seconds of hearing it. */}
                <button className="btn px-2 py-0.5 text-[10px]"
                  onClick={() => setPreview(preview === r.url ? null : r.url)}>
                  {preview === r.url ? "stop" : "play"}
                </button>
                <span className="text-sm truncate flex-1">{r.label}</span>
                <button className="btn px-2 py-0.5 text-[10px] btn-neon"
                  onClick={() => { onPickSound(r.url, r.label, 2); onClose(); }}>
                  place here
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {(shown as StockRow[]).map(r => (
              <button key={r.id} title={r.name}
                onClick={() => { onPickStock(r.url, r.kind, r.kind === "video" ? 4.84 : 3); onClose(); }}
                className="rounded-lg overflow-hidden border border-[#2a2a3a] hover:border-[#ff3d6e] text-left">
                <div className="aspect-video bg-black grid place-items-center overflow-hidden">
                  {r.kind === "image"
                    ? <img src={r.url} alt="" className="w-full h-full object-cover" />
                    : <video src={r.url} muted preload="metadata" className="w-full h-full object-cover" />}
                </div>
                <div className="px-1 py-0.5 text-[9px] truncate">{r.name}</div>
              </button>
            ))}
          </div>
        )}
        {rows && !!rows.length && !shown.length && (
          <div className="p-3 text-sm text-muted">Nothing matches that.</div>
        )}
      </div>

      {preview && <audio src={preview} autoPlay onEnded={() => setPreview(null)} className="hidden" />}
    </div>
  );
}
