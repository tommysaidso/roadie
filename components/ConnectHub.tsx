"use client";

import { useState } from "react";
import { BadgeCheck, Cloud, Link2, Music2, Ticket } from "lucide-react";

const PRESETS = [
  { key: "soundcloud", label: "SoundCloud", icon: Music2, placeholder: "https://soundcloud.com/..." },
  { key: "spotify", label: "Spotify", icon: Music2, placeholder: "https://open.spotify.com/artist/..." },
  { key: "youtube", label: "YouTube", icon: Music2, placeholder: "https://youtube.com/..." },
  { key: "bandcamp", label: "Bandcamp", icon: Music2, placeholder: "https://artist.bandcamp.com" },
  { key: "tickets", label: "Tickets", icon: Ticket, placeholder: "ticket / event link" },
  { key: "merch", label: "Merch", icon: Ticket, placeholder: "store / merch link" },
  { key: "storage", label: "Storage", icon: Cloud, placeholder: "drive, Dropbox, R2 public folder, EPK folder..." },
];

export default function ConnectHub({ band }: { band: any }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [links, setLinks] = useState<Record<string,string>>(() => {
    try { return JSON.parse(band.links || band.socials || "{}"); } catch { return {}; }
  });
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  async function save(extra?: Record<string,string>) {
    setBusy(true); setMsg("");
    const next = { ...links, ...(extra || {}) };
    try {
      const r = await fetch("/api/bands", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: band.id, links: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "connect failed");
      setLinks(d.links || next);
      setMsg("connected");
    } catch (e:any) {
      setMsg(e?.message || "connect failed");
    } finally { setBusy(false); }
  }

  function saveCustom() {
    const label = customLabel.trim() || "custom";
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "link"}`;
    if (!customUrl.trim()) return;
    save({ [key]: customUrl.trim() });
    setCustomLabel(""); setCustomUrl("");
  }

  return (
    <div className="mt-3 rounded-xl border border-edge bg-black/15 p-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold"><Link2 size={15} className="text-cyan" />Connect music, storage & links</span>
        <span className="text-xs text-muted">{open ? "hide" : "add"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map(({ key, label, icon: Icon, placeholder }) => (
              <label key={key} className="rounded-xl border border-edge bg-panel2/70 p-2">
                <span className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-[.12em] text-muted">
                  <Icon size={12} />{label}{links[key] ? <BadgeCheck size={12} className="text-moss" /> : null}
                </span>
                <input
                  value={links[key] || ""}
                  onChange={(e) => setLinks((l) => ({ ...l, [key]: e.target.value }))}
                  onBlur={() => save()}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[150px,1fr,auto]">
            <input value={customLabel} onChange={(e)=>setCustomLabel(e.target.value)} placeholder="custom name" className="btn bg-panel2 text-left" />
            <input value={customUrl} onChange={(e)=>setCustomUrl(e.target.value)} placeholder="paste any login/profile URL" className="btn bg-panel2 text-left" />
            <button disabled={busy || !customUrl.trim()} onClick={saveCustom} className="btn btn-neon">link</button>
          </div>
          <div className="text-[11px] text-muted">
            Custom URL is for anything we do not have a native connector for yet. Paste the service login/profile/storage URL and ROADIE keeps it attached to the band.
          </div>
          {msg && <div className="text-xs text-muted">{msg}</div>}
        </div>
      )}
    </div>
  );
}
