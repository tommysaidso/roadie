"use client";
import { useEffect, useState } from "react";

/**
 * Terms acknowledgement prompt — bands and artists only.
 *
 * Deliberately NOT a blocking modal. Locking someone out of their own catalogue
 * until they click a box is how platforms train people to click without
 * reading, which produces a worthless acknowledgement and an annoyed band. This
 * sits at the top, stays until dealt with, and lets them go read the thing
 * first — the link opens in a new tab so they do not lose their place.
 *
 * It asks them to type their name. Not a signature and not claimed to be one:
 * it is a deliberate act rather than a reflex click, and it records who was at
 * the keyboard.
 */
export default function TermsAck() {
  const [state, setState] = useState<any>(null);
  const [kind, setKind] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/profiles").then(r => r.json())
      .then(d => setKind(d?.active?.kind ?? null)).catch(() => setKind(null));
  }, []);

  useEffect(() => {
    if (kind === undefined) return;
    fetch(`/api/terms/ack?kind=${encodeURIComponent(kind || "")}`)
      .then(r => r.json()).then(setState).catch(() => {});
  }, [kind]);

  if (done || !state?.signed_in || !state?.needs) return null;

  const outdated = state?.state?.outdated;

  async function ack() {
    if (!name.trim()) { setErr("Type your name to confirm."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/terms/ack", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ typed_name: name.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not record that."); return; }
      setDone(true);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-4 mb-4 space-y-3 text-sm leading-relaxed"
         style={{ borderColor: "rgba(255,200,60,0.4)" }}>
      <div className="text-neon font-medium">
        {outdated ? "The terms have changed" : "Please confirm you have read the terms"}
      </div>
      <p className="text-muted">
        {outdated
          ? <>You acknowledged version <b>{state.state.version}</b>. The current
              terms are <b>{state.version}</b> — different words, so we are asking
              again rather than carrying your old confirmation forward.</>
          : <>Your music stays yours, it is stream-only, and every play is tracked
              for you. Have a read, then confirm below. This is the platform terms —
              it does not commit you to a ring.</>}
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <a href="/terms" target="_blank" rel="noreferrer"
           className="pill hover:bg-white/5">Read the terms →</a>
        <a href="/api/legal/ring-contract" download
           className="pill hover:bg-white/5">Ring contract (.md)</a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input" placeholder="Type your name"
               value={name} onChange={e => setName(e.target.value)}
               onKeyDown={e => e.key === "Enter" && ack()} />
        <button className="btn" onClick={ack} disabled={busy}>
          {busy ? "Recording…" : "I have read the terms"}
        </button>
      </div>
      {err && <div className="text-xs" style={{ color: "#fca5a5" }}>{err}</div>}
      <div className="text-[11px] text-muted">
        We record your name, the date and which version — nothing else. You can
        read the terms any time from the Legal links in the menu, and download
        them for your own lawyer.
      </div>
    </div>
  );
}
