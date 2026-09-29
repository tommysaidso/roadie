"use client";
import { useState } from "react";

// "Is this you?" — a real band claiming its seeded profile. Posts to the claim
// endpoint; if not signed in, bounces to sign-in (mymymy identity).
export default function ClaimButton({ bandId, bandName }: { bandId: number; bandName: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function claim() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/bands/${bandId}/claim`, { method: "POST" });
      const d = await r.json();
      if (r.ok) { setDone(true); setMsg("Claimed — this profile is yours now. Refresh to see it live."); }
      else if (d.error === "sign_in") { window.location.href = "/signin"; }
      else setMsg(d.message || d.error || "Couldn't claim right now.");
    } catch { setMsg("Couldn't claim right now."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
      <button onClick={claim} disabled={busy || done} className="btn btn-neon text-sm">
        {done ? "Claimed ✓" : busy ? "…" : `Is this you? Claim ${bandName}`}
      </button>
      {msg && <div className="text-[11px] text-muted mt-1">{msg}</div>}
      {!msg && <div className="text-[11px] text-muted mt-1">This is a real local act we&apos;ve listed. If it&apos;s yours, claim it and take over the page.</div>}
    </div>
  );
}
