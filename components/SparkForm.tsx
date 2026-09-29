"use client";
import { useState } from "react";
import { Star, Send, Check } from "lucide-react";

export default function SparkForm() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [link, setLink] = useState("");
  const [blurb, setBlurb] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !city.trim()) return;
    setBusy(true);
    const body = [blurb.trim(), link.trim()].filter(Boolean).join(" — ") || "(no description)";
    try {
      await fetch("/api/notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "spark", title: name.trim(), body,
          city: city.trim(), contact: link.trim() || null,
        }),
      });
      setSent(true);
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "#3ddc84" }}>
        <Check size={15} /> Spark posted — {name} is on the board.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
      <div className="label flex items-center gap-1"><Star size={12} /> Spotlight local talent</div>
      <div className="flex gap-2 flex-wrap">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Name or handle (e.g. Tommy D., the 6yr drummer)"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1 min-w-0" required />
        <input value={city} onChange={e => setCity(e.target.value)} placeholder="Their city"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon"
          style={{ width: 120 }} required />
      </div>
      <input value={link} onChange={e => setLink(e.target.value)}
        placeholder="Link — YouTube, Instagram, TikTok..."
        className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon w-full" />
      <div className="flex gap-2">
        <input value={blurb} onChange={e => setBlurb(e.target.value.slice(0, 200))}
          placeholder="What makes them stand out? (200 char)"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1" />
        <button type="submit" disabled={busy || !name.trim() || !city.trim()}
          className="btn btn-neon flex items-center gap-1 text-sm">
          <Send size={14} /> Post
        </button>
      </div>
    </form>
  );
}
