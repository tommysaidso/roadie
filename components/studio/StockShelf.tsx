"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Help from "./Help";

// The stock shelf — footage and stills already licensed and paid for.
//
// The point is that generating a plate is not always the right move. If a real
// shot of a mountain road exists in the Storyblocks credits, use the real one:
// it costs nothing extra, it looks right, and it never puts a 1970s van in the
// frame. Generate what only generation can give you.

export type StockItem = {
  id: string; name: string; folder: string;
  kind: "image" | "video"; bytes: number; url: string;
};

export default function StockShelf({
  onUse, brief,
}: {
  // Image -> a timeline plate or a start frame. Video -> straight on the timeline.
  onUse: (item: StockItem) => void;
  brief?: string;          // what the promo is, so the AI can write the list
}) {
  const [wants, setWants] = useState<any[]>([]);
  const [thinking, setThinking] = useState(false);
  // Which want the next dropped file should fill.
  const [fillTarget, setFillTarget] = useState<number | null>(null);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState<string>("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [dir, setDir] = useState("");
  const [dropping, setDropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lastId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/studio/stock").then(r => r.json()).catch(() => null);
    if (!r) { setErr("Couldn't read the shelf."); setItems([]); return; }
    setDir(r.dir || "");
    setErr(r.error || null);
    setFolders(r.folders || []);
    setItems(r.items || []);
  }, []);
  const loadWants = useCallback(async () => {
    const r = await fetch("/api/admin/studio/wants").then(r => r.json()).catch(() => null);
    setWants(r?.wants || []);
  }, []);
  useEffect(() => { load(); loadWants(); }, [load, loadWants]);

  async function askAi() {
    setThinking(true); setNote(null);
    const r = await fetch("/api/admin/studio/wants", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "suggest", brief: brief || "a sponsor promo for the ROADIE ring" }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setThinking(false);
    if (r?.error) setNote(r.error);
    setWants(r?.wants || []);
  }

  // The placement spot: log in wherever, grab the shot, drop it here. No NAS
  // mount needed and no API to wait on.
  async function put(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true); setNote(null);
    let ok = 0; const failed: string[] = [];
    for (const f of list) {
      const fd = new FormData();
      fd.append("file", f);
      if (folder) fd.append("folder", folder);
      const r = await fetch("/api/admin/studio/stock", { method: "POST", body: fd })
        .then(r => r.json()).catch(e => ({ error: String(e) }));
      if (r?.error) failed.push(`${f.name}: ${r.error}`);
      else { ok++; lastId.current = r.id; }
    }
    // If a want was armed, the first file that landed fills it.
    if (fillTarget && ok && lastId.current) {
      await fetch("/api/admin/studio/wants", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "fill", id: fillTarget, stock_id: lastId.current }),
      }).catch(() => {});
      setFillTarget(null);
      loadWants();
    }
    setBusy(false);
    setNote(failed.length
      ? `${ok} added. ${failed.join(" | ")}`
      : `${ok} added to the shelf${folder ? ` in ${folder}` : ""}.`);
    load();
  }

  if (items === null) return <div className="card p-4 text-sm text-muted">Reading the shelf…</div>;

  const shown = items.filter(i =>
    (!folder || i.folder === folder) &&
    (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="label flex items-center gap-1.5">
        Stock shelf
        <Help title="Stock shelf">
          Footage and stills you already pay for — Adobe, Storyblocks, anything else.
          Drop the files in the shelf folder on the NAS and they show up here, ready to
          drop on the timeline or use as a start frame.
          <br /><br />
          There is no login and nothing is downloaded for you: Storyblocks has no key we
          can hold, so the shelf is a folder you fill rather than an account we sign into.
        </Help>
        {items.length > 0 && <span className="pill text-[10px]">{items.length}</span>}
      </div>

      {/* What we still need. The AI writes it as search phrases you can paste
          straight into Storyblocks or Adobe — then "Fill this" arms the drop
          zone so the download lands in that exact slot. */}
      <div className="rounded-xl border border-[#2a2a3a] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label">What we still need</span>
          {wants.filter(w => w.status === "wanted").length > 0 &&
            <span className="pill text-[10px]">{wants.filter(w => w.status === "wanted").length}</span>}
          <button className="btn ml-auto" onClick={askAi} disabled={thinking}>
            {thinking ? "Thinking…" : wants.length ? "Ask again" : "What do I need?"}
          </button>
        </div>

        {!wants.length && !thinking && (
          <p className="text-xs text-muted mt-2">
            Ask and the AI reads the promo, checks what&apos;s already on the shelf, and lists
            the shots still missing — worded so you can paste them into a stock search.
          </p>
        )}

        {wants.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {wants.filter(w => w.status !== "skipped").map(w => (
              <div key={w.id}
                className="flex items-start gap-2 text-sm rounded-lg px-2 py-1.5"
                style={{ background: w.status === "filled" ? "rgba(61,220,132,0.06)" : "rgba(255,255,255,0.02)" }}>
                <span className="pill text-[9px] shrink-0 mt-0.5">{w.kind}</span>
                <div className="min-w-0 flex-1">
                  <div className={w.status === "filled" ? "line-through text-muted" : ""}>{w.description}</div>
                  {w.why && <div className="text-[11px] text-[#8a8aa0]">{w.why}</div>}
                </div>
                {w.status === "filled" ? (
                  <span className="text-[11px] shrink-0" style={{ color: "#3ddc84" }}>got it</span>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <button className="btn px-2 py-0.5 text-[10px]"
                      onClick={() => navigator.clipboard?.writeText(w.description).catch(() => {})}>
                      copy
                    </button>
                    <button className={"btn px-2 py-0.5 text-[10px] " + (fillTarget === w.id ? "btn-neon" : "")}
                      onClick={() => setFillTarget(fillTarget === w.id ? null : w.id)}>
                      {fillTarget === w.id ? "drop it below" : "fill this"}
                    </button>
                    <button className="btn px-2 py-0.5 text-[10px]"
                      onClick={async () => { await fetch(`/api/admin/studio/wants?id=${w.id}`, { method: "DELETE" }); loadWants(); }}>
                      x
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={e => { e.preventDefault(); setDropping(false); put(e.dataTransfer.files); }}
        className="rounded-xl border border-dashed px-4 py-3 text-center transition-colors"
        style={{
          borderColor: dropping ? "#ff3d6e" : "#2a2a3a",
          background: dropping ? "rgba(255,61,110,0.06)" : "rgba(255,255,255,0.02)",
        }}>
        <div className="text-sm text-muted">
          {busy ? "Putting it on the shelf…"
                : fillTarget ? "Drop it here to fill that shot"
                : "Drop a downloaded still or clip here"}
        </div>
        <div className="text-[11px] text-[#8a8aa0] mt-1">
          or <label className="text-cyan cursor-pointer underline">
            choose files
            <input type="file" multiple hidden accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={e => { if (e.target.files) put(e.target.files); e.currentTarget.value = ""; }} />
          </label>
          {folder ? ` — goes into ${folder}` : " — pick a folder above to file it"}
        </div>
      </div>
      {note && <div className="text-[11px] text-muted">{note}</div>}

      {err && (
        <div className="text-sm" style={{ color: "#e05c7a" }}>
          {err}
          <div className="text-[11px] text-muted mt-1">
            Expected at <code>{dir}</code> — create it and drop files in.
          </div>
        </div>
      )}

      {!err && !items.length && (
        <div className="text-sm text-muted">
          Shelf is empty. Drop licensed stills or clips into <code>{dir}</code> — subfolders
          become groups here.
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="filter by name"
              className="bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm
                         outline-none focus:border-[#ff3d6e] w-48" />
            {folders.length > 0 && (
              <select value={folder} onChange={e => setFolder(e.target.value)}
                className="bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm outline-none">
                <option value="">All folders</option>
                {folders.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
            <button className="btn ml-auto" onClick={load}>Refresh</button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-80 overflow-y-auto scroll">
            {shown.map(i => (
              <button key={i.id} onClick={() => onUse(i)} title={`${i.folder ? i.folder + "/" : ""}${i.name}`}
                className="rounded-lg overflow-hidden border border-[#2a2a3a] hover:border-[#ff3d6e] text-left">
                <div className="aspect-video bg-black grid place-items-center overflow-hidden">
                  {i.kind === "image"
                    ? <img src={i.url} alt={i.name} className="w-full h-full object-cover" />
                    /* muted+preload=metadata: a shelf of autoloading clips would
                       hammer the NAS on every open. */
                    : <video src={i.url} muted preload="metadata" className="w-full h-full object-cover" />}
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[10px] truncate">{i.name}</div>
                  <div className="text-[9px] text-[#8a8aa0]">
                    {i.kind}{i.bytes ? ` · ${(i.bytes / 1e6).toFixed(1)} MB` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {!shown.length && <div className="text-sm text-muted">Nothing matches that filter.</div>}
        </>
      )}
    </div>
  );
}
