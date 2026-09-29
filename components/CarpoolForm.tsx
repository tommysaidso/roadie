"use client";
import { useState } from "react";
import { Car, Send, Check } from "lucide-react";

export default function CarpoolForm() {
  const [dir, setDir] = useState<"offer" | "need">("offer");
  const [fromCity, setFromCity] = useState("");
  const [stop, setStop] = useState("");
  const [seats, setSeats] = useState("2");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromCity.trim() || !contact.trim()) return;
    setBusy(true);
    const showRef = stop.trim() || "the show";
    const title = dir === "offer"
      ? `Ride offer — ${fromCity} to ${showRef}`
      : `Need a ride — ${fromCity} to ${showRef}`;
    const body = dir === "offer"
      ? `${seats} seat${Number(seats) > 1 ? "s" : ""} available.`
      : "Looking for a ride.";
    try {
      await fetch("/api/notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "carpool", title, body, city: fromCity.trim(), contact: contact.trim() }),
      });
      setSent(true);
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "#3ddc84" }}>
        <Check size={15} /> Posted — your ride is on the board.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
      <div className="label flex items-center gap-1"><Car size={12} /> Post a ride</div>
      <div className="flex gap-2">
        {(["offer", "need"] as const).map(d => (
          <button key={d} type="button" onClick={() => setDir(d)}
            className={`pill flex-1 text-center text-xs ${dir === d ? "border-neon text-neon" : ""}`}>
            {d === "offer" ? "I have seats" : "I need a ride"}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input value={fromCity} onChange={e => setFromCity(e.target.value)} placeholder="Your city"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1 min-w-0" required />
        <input value={stop} onChange={e => setStop(e.target.value)} placeholder="To which show? (optional)"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1 min-w-0" />
      </div>
      {dir === "offer" && (
        <div className="flex items-center gap-2 text-sm text-muted">
          Seats:
          {["1", "2", "3", "4"].map(n => (
            <button key={n} type="button" onClick={() => setSeats(n)}
              className={`pill px-3 text-xs ${seats === n ? "border-neon text-neon" : ""}`}>{n}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Email or @handle to reach you"
          className="bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon flex-1" required />
        <button type="submit" disabled={busy || !fromCity.trim() || !contact.trim()}
          className="btn btn-neon flex items-center gap-1 text-sm">
          <Send size={14} /> Post
        </button>
      </div>
    </form>
  );
}
