"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown, ChevronRight, RefreshCw, Layers, Wand2, Film, EyeOff, Check, Scissors, Play,
  Copy, QrCode, Link as LinkIcon,
} from "lucide-react";

// MULTICAM CONSOLE
//
// A set is one performance. Clips are what the room shot. Alignment is a job on
// a machine with ffmpeg, so pressing the button queues work rather than doing
// it — the status here reflects what the worker has reported back.

type ClipRow = {
  id: number; uploader_name: string | null; original_name: string;
  status: string; align_status: string; offset_ms: number | null;
  align_score: number | null; duration_ms: number | null;
  orientation: string | null; width: number | null; height: number | null;
  bytes: number | null; url: string | null; align_method: string | null;
};
type SetRow = {
  id: number; title: string; stop_id: number | null; status: string;
  clips: number; aligned: number; aligned_at: string | null;
  render_status: string | null; render_note: string | null;
  output_bytes: number | null; rendered_at: string | null;
};
type Stop = {
  id: number; city: string; date: string; venue: string | null; is_test: number;
  share_token: string | null;
};

const ms = (v: number | null) => v == null ? "—" : `${(v / 1000).toFixed(1)}s`;
const off = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(2)}s`;
const mb = (v: number | null) => v == null ? "" : `${(v / 1048576).toFixed(0)} MB`;

function Badge({ s }: { s: string }) {
  const map: Record<string, string> = {
    ok: "#3ddc84", aligned: "#3ddc84", weak: "#e8b04b",
    failed: "#e05c7a", pending: "#8a8aa0", aligning: "#3df0ff",
  };
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
      style={{ color: map[s] || "#8a8aa0", borderColor: (map[s] || "#8a8aa0") + "66" }}>
      {s}
    </span>
  );
}

export default function MulticamConsole({ ready }: { ready: boolean }) {
  const [data, setData] = useState<{ sets: SetRow[]; stops: Stop[] } | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [clips, setClips] = useState<Record<number, ClipRow[]>>({});
  const [watch, setWatch] = useState<Record<number, string | null>>({});
  const [seg, setSeg] = useState("4");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [stopId, setStopId] = useState("");
  const [linksOpen, setLinksOpen] = useState(false);
  const [copiedStop, setCopiedStop] = useState<number | null>(null);
  const [qrOpenStop, setQrOpenStop] = useState<number | null>(null);

  function shootUrl(s: Stop) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return s.share_token
      ? `${origin}/shoot?stop=${s.id}&k=${s.share_token}`
      : `${origin}/shoot?stop=${s.id}`;
  }

  async function copyLink(s: Stop) {
    const url = shootUrl(s);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be blocked (older browser, non-HTTPS, permissions).
      // A selectable text field carries the same link either way — see the
      // input below — so a failed copy isn't a dead end for the operator.
    }
    setCopiedStop(s.id);
    setTimeout(() => setCopiedStop(p => (p === s.id ? null : p)), 2000);
  }

  async function regenQr(s: Stop) {
    if (!window.confirm(
      `Regenerate the link for ${s.date} · ${s.city}?\n\n` +
      `The current QR and link stop working immediately. Anyone still using ` +
      `the old one will need the new QR/link instead — reprint or resend it ` +
      `before people try to use it again.`,
    )) return;
    await post({ action: "regen_qr", stop_id: s.id });
    setQrOpenStop(p => (p === s.id ? null : p));
  }

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/multicam").then(r => r.json()).catch(() => null);
    if (!r || r.error) { setErr(r?.error || "Couldn't load."); return; }
    setErr(null); setData({ sets: r.sets || [], stops: r.stops || [] });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function loadClips(setId: number) {
    const r = await fetch(`/api/admin/multicam?set=${setId}`).then(r => r.json()).catch(() => null);
    if (r?.clips) setClips(p => ({ ...p, [setId]: r.clips }));
    if (r) setWatch(p => ({ ...p, [setId]: r.watch || null }));
  }

  async function post(body: any) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/multicam", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()).catch(() => null);
      if (!r || r.error) { setErr(r?.error || "That didn't take."); return null; }
      setErr(null); await load();
      return r;
    } finally { setBusy(false); }
  }

  if (!data) return <div className="text-sm text-muted">Loading…</div>;

  return (
    <div className="flex flex-col gap-5">

      {!ready && (
        <div className="card p-4" style={{ borderColor: "rgba(224,92,122,0.45)" }}>
          <div className="font-bold mb-1" style={{ color: "#e05c7a" }}>Storage not configured</div>
          <p className="text-sm text-muted">
            R2 credentials are missing, so no upload URL can be issued and nothing can be stored.
            Set <code>R2_ENDPOINT</code>, <code>R2_ACCESS_KEY</code>, <code>R2_SECRET_KEY</code> and{" "}
            <code>R2_BUCKET</code> on the container.
          </p>
        </div>
      )}

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="label text-xs">New set</span>
          <input className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Trail, second set" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label text-xs">Show</span>
          <select className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"
            value={stopId} onChange={e => setStopId(e.target.value)}>
            <option value="">— pick a stop —</option>
            {data.stops.map(s => (
              <option key={s.id} value={s.id}>{s.date} · {s.city}{s.venue ? ` · ${s.venue}` : ""}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-neon flex items-center gap-1.5" disabled={busy || !title}
          onClick={async () => {
            const r = await post({ action: "create_set", title, stop_id: Number(stopId) || null });
            if (r) { setTitle(""); setStopId(""); }
          }}>
          <Layers size={15} /> Create
        </button>
        <button className="btn flex items-center gap-1.5" onClick={load} disabled={busy}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Every show already in the roster, with its own shoot link + QR ready
          to hand to whoever's in the room right now — a text you can send a
          friend is exactly as valid as printing the QR, so both are one tap
          away here instead of only existing as a file on the NAS. */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setLinksOpen(p => !p)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition">
          {linksOpen ? <ChevronDown size={16} className="shrink-0 text-muted" />
                     : <ChevronRight size={16} className="shrink-0 text-muted" />}
          <div className="font-black flex items-center gap-2">
            <LinkIcon size={15} /> Show links &amp; QR codes
          </div>
          <span className="ml-auto text-[11px] pill shrink-0">{data.stops.length}</span>
        </button>
        {linksOpen && (
          <div className="border-t border-edge">
            {data.stops.map(s => (
              <div key={s.id} className="px-5 py-3 border-b border-edge last:border-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">
                    {s.date} · {s.city}{s.venue ? ` · ${s.venue}` : ""}
                  </span>
                  {!!s.is_test && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                      style={{ color: "#8a8aff", borderColor: "#8a8aff66" }}>
                      test — always safe to send
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input readOnly value={shootUrl(s)}
                    onFocus={e => e.currentTarget.select()}
                    className="bg-ink border border-edge rounded-xl px-3 py-1.5 text-xs flex-1 min-w-[220px] outline-none focus:border-neon" />
                  <button className="btn px-3 py-1.5 text-xs flex items-center gap-1.5" onClick={() => copyLink(s)}>
                    {copiedStop === s.id ? <><Check size={13} /> copied</> : <><Copy size={13} /> copy link</>}
                  </button>
                  <button className="btn px-3 py-1.5 text-xs flex items-center gap-1.5"
                    onClick={() => setQrOpenStop(p => p === s.id ? null : s.id)}>
                    <QrCode size={13} /> {qrOpenStop === s.id ? "hide QR" : "show QR"}
                  </button>
                  <button className="btn px-3 py-1.5 text-xs flex items-center gap-1.5" disabled={busy}
                    title="Shuts off the current link/QR and issues a new one — use if it's been shared somewhere it shouldn't have been."
                    onClick={() => regenQr(s)}>
                    <RefreshCw size={13} /> regenerate
                  </button>
                </div>
                {qrOpenStop === s.id && (
                  <img src={`/crowdcam_qr/qr-stop-${s.id}.png?v=${s.share_token || "orig"}`}
                    alt={`QR for ${s.city}`} className="w-40 h-40 bg-white p-2 rounded-lg" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <div className="card p-3 text-sm" style={{ color: "#e05c7a" }}>{err}</div>}

      {!data.sets.length && (
        <div className="card p-6 text-sm text-muted">
          No sets yet. Create one, then fans can upload against that show.
        </div>
      )}

      {data.sets.map(s => {
        const isOpen = !!open[s.id];
        const rows = clips[s.id] || [];
        return (
          <div key={s.id} className="card overflow-hidden">
            <button
              onClick={() => {
                const next = !isOpen;
                setOpen(p => ({ ...p, [s.id]: next }));
                if (next && !clips[s.id]) loadClips(s.id);
              }}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition">
              {isOpen ? <ChevronDown size={16} className="shrink-0 text-muted" />
                      : <ChevronRight size={16} className="shrink-0 text-muted" />}
              <div className="min-w-0">
                <div className="font-black flex items-center gap-2">
                  {s.title} <Badge s={s.status} />
                </div>
                <div className="text-xs text-muted">
                  {s.clips} clip{s.clips === 1 ? "" : "s"} · {s.aligned} aligned
                  {s.aligned_at && ` · ${s.aligned_at}`}
                </div>
              </div>
              <span className="ml-auto text-[11px] pill shrink-0">{s.clips}</span>
            </button>

            {isOpen && (
              <div className="border-t border-edge">
                <div className="px-5 py-3 flex gap-2 flex-wrap border-b border-edge">
                  <button className="btn px-3 py-1.5 text-xs flex items-center gap-1.5"
                    disabled={busy || s.clips < 2}
                    onClick={() => post({ action: "align", set_id: s.id }).then(() => loadClips(s.id))}>
                    <Wand2 size={13} /> Align by audio
                  </button>
                  <a className="btn px-3 py-1.5 text-xs flex items-center gap-1.5"
                    href={`/api/admin/multicam?set=${s.id}&cutsheet=1`} target="_blank" rel="noreferrer">
                    <Film size={13} /> Cut sheet
                  </a>
                  <button
                    className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all"
                    disabled={busy || s.aligned < 2 || s.render_status === "rendering"}
                    style={{
                      background: s.render_status === "rendering" ? "#22222e" : "#ff3d6e",
                      color: s.render_status === "rendering" ? "#8a8aa0" : "#0b0b0f",
                      border: "1px solid #ff3d6e",
                      boxShadow: "0 3px 14px rgba(255,61,110,0.3)",
                      opacity: (s.aligned < 2 || s.render_status === "rendering") ? 0.45 : 1,
                    }}
                    onClick={() => post({ action: "render", set_id: s.id, segment_sec: Number(seg) || 4 })}>
                    <Scissors size={13} />
                    {s.render_status === "rendering" ? "Cutting…" : "Cut the video"}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    every
                    <input value={seg} onChange={e => setSeg(e.target.value)}
                      className="bg-ink border border-edge px-2 py-1 w-12 text-xs outline-none focus:border-neon" />
                    s
                  </label>
                  {watch[s.id] && (
                    <a className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                      style={{ border: "1px solid #3ddc84", color: "#3ddc84" }}
                      href={watch[s.id]!} target="_blank" rel="noreferrer">
                      <Play size={13} /> Watch the cut
                    </a>
                  )}
                  <button className="btn px-3 py-1.5 text-xs" onClick={() => loadClips(s.id)}>
                    reload clips
                  </button>
                  {s.clips < 2 && (
                    <span className="text-xs text-muted self-center">
                      Alignment needs at least two uploaded clips.
                    </span>
                  )}
                  {s.render_status === "failed" && s.render_note && (
                    <span className="text-xs self-center" style={{ color: "#e05c7a" }}>
                      Cut failed: {s.render_note}
                    </span>
                  )}
                </div>

                {!rows.length && (
                  <div className="px-5 py-4 text-sm text-muted">No clips in this set yet.</div>
                )}

                {rows.map(c => (
                  <div key={c.id} className="px-5 py-3 border-b border-edge last:border-0
                                             flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {c.uploader_name || "anonymous"}
                        <Badge s={c.align_status} />
                        {c.align_method === "clock" && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                            title="Placed by the phone's own clock, not confirmed against the room's audio — worth a listen before trusting the cut."
                            style={{ color: "#8a8aff", borderColor: "#8a8aff66" }}>
                            clock-placed
                          </span>
                        )}
                        {c.orientation && (
                          <span className="text-[10px] text-muted uppercase">
                            {c.orientation === "vertical" ? "punch-in" : "wide"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {c.original_name} · {mb(c.bytes)}
                        {c.width ? ` · ${c.width}x${c.height}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-20">
                      <div className="text-sm font-black tabular-nums">{off(c.offset_ms)}</div>
                      <div className="text-[10px] text-muted uppercase">offset</div>
                    </div>
                    <div className="text-right shrink-0 w-16">
                      <div className="text-sm tabular-nums">{ms(c.duration_ms)}</div>
                      <div className="text-[10px] text-muted uppercase">length</div>
                    </div>
                    <div className="text-right shrink-0 w-14">
                      <div className="text-sm tabular-nums">
                        {c.align_score == null ? "—" : c.align_score.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted uppercase">score</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {c.url && (
                        <a className="btn px-2 py-1 text-[11px]" href={c.url} target="_blank" rel="noreferrer">
                          watch
                        </a>
                      )}
                      {c.status !== "approved" ? (
                        <button className="btn px-2 py-1 text-[11px] flex items-center gap-1" disabled={busy}
                          onClick={() => post({ action: "clip_status", id: c.id, status: "approved" })
                            .then(() => loadClips(s.id))}>
                          <Check size={12} /> approve
                        </button>
                      ) : (
                        <button className="btn px-2 py-1 text-[11px] flex items-center gap-1" disabled={busy}
                          onClick={() => post({ action: "clip_status", id: c.id, status: "hidden" })
                            .then(() => loadClips(s.id))}>
                          <EyeOff size={12} /> hide
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
