"use client";
import { useState } from "react";
import PhoneCamera from "@/app/shoot/PhoneCamera";

// Records with the same in-browser camera fans use for Crowd Cam (app/shoot/PhoneCamera),
// or takes a clip from the phone's camera roll, then uploads it to the vendor's showcase.
export default function VendorCapture({ slug, name, capKey }: { slug: string; name: string; capKey: string }) {
  const [cam, setCam] = useState(false);
  const [consent, setConsent] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string[]>([]);

  async function upload(blob: Blob, filename: string) {
    setBusy(true); setMsg("Uploading...");
    const f = new FormData();
    f.append("key", capKey);
    f.append("ad_consent", consent ? "1" : "0");
    f.append("file", new File([blob], filename, { type: blob.type || "video/mp4" }));
    try {
      const r = await fetch(`/api/vendors/${slug}/media`, { method: "POST", body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setSent(s => [j.url, ...s]); setMsg("Uploaded. It's on your page's showcase now.");
    } catch (e: any) { setMsg(e.message + ". Try again, or keep the clip shorter."); }
    setBusy(false);
  }

  if (!capKey) return <div className="card p-4 text-sm">This page needs your private capture link. Ask ROADIE for it.</div>;

  return (
    <div className="card p-4 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
        <span>ROADIE may use these clips to promote {name} and ROADIE (ads, RoadieTV, social). You keep your own copies.</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-neon" disabled={busy} onClick={() => setCam(true)}>Record now</button>
        <label className="btn cursor-pointer">
          Pick a clip from the phone
          <input type="file" accept="video/*" className="hidden" disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, f.name); e.target.value = ""; }} />
        </label>
        <a className="btn" href={`/vendors/${slug}`}>Open my page</a>
      </div>
      {msg && <div className="text-sm">{msg}</div>}
      {sent.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{sent.map(u => <video key={u} src={u} controls playsInline className="w-full rounded-lg" />)}</div>}
      <p className="text-sm text-muted">Tips: hold the phone sideways, keep clips under a minute, and let each guitar ring out once.</p>
      {cam && <PhoneCamera onClose={() => setCam(false)}
        onRecorded={r => { setCam(false); upload(r.blob, `floor-${Date.now()}.${r.ext}`); }} />}
    </div>
  );
}
