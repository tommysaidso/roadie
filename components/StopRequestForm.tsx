"use client";
import { useState } from "react";
import { MapPin, Send, Check } from "lucide-react";

const REGIONS = ["BC","AB","SK","MB","ON","QC","NS","NB","PE","NL","YT","NT","NU","WA","ID","MT","OR"];

export default function StopRequestForm() {
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("BC");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/fan/stop-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ city: city.trim(), region, note }),
      });
      setSent(true);
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "#3ddc84" }}>
        <Check size={15} /> Request logged for {city}, {region} — the ring team tracks demand by city.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="label flex items-center gap-1"><MapPin size={12} /> Bring the Ring to my town</div>
      <div className="flex gap-2 flex-wrap">
        <input value={city} onChange={e => setCity(e.target.value)} placeholder="City"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1 min-w-0" required />
        <select value={region} onChange={e => setRegion(e.target.value)}
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon">
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Why your town? (optional)"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1" />
        <button type="submit" disabled={busy || !city.trim()} className="btn btn-neon flex items-center gap-1 text-sm">
          <Send size={14} /> Send
        </button>
      </div>
    </form>
  );
}
