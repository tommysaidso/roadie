"use client";
import { useState } from "react";
import { CalendarDays, DollarSign, Music, FileText, Plus } from "lucide-react";
import PosterStudio from "./PosterStudio";

export default function VenuePromo({ venues, bands, bookings, sponsors }: any) {
  const [mode, setMode] = useState<"form" | "studio">("form");
  const [posted, setPosted] = useState<any>(null);

  const [venueId, setVenueId] = useState(String(venues[0]?.id ?? ""));
  const [date, setDate] = useState("");
  const [genreWanted, setGenreWanted] = useState("");
  const [guarantee, setGuarantee] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function postNight() {
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/venue-slots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venue_id: Number(venueId),
          date,
          genre_wanted: genreWanted,
          guarantee: Number(guarantee) || 0,
          notes,
          source: "promo",
        }),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error || "Failed"); return; }
      const d = await res.json();
      setPosted(d);
      setMode("studio");
    } catch (e: any) {
      setErr(e.message || "Network error");
    } finally {
      setSaving(false);
    }
  }

  // Inject the new open slot into the bookings list so PosterStudio auto-selects it
  const synthBooking = posted ? [{
    id: `slot-${posted.id}`,
    band_id: null,
    venue_id: Number(venueId),
    date,
    bill_position: null,
    status: "open",
    venue: venues.find((v: any) => String(v.id) === venueId)?.name || "",
    band: "",
  }] : [];

  if (mode === "studio") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm font-bold">
              {posted ? "Night posted — now build the materials" : "Poster / pitch studio"}
            </span>
            {posted && (
              <div className="text-xs text-muted mt-0.5">
                Open slot saved and in the matching pool. Pick a band, grab the PNG or the sponsor one-pager.
              </div>
            )}
          </div>
          <button onClick={() => setMode("form")} className="btn text-xs">Post another night</button>
        </div>
        <PosterStudio
          bands={bands}
          venues={venues}
          bookings={[...synthBooking, ...bookings]}
          sponsors={sponsors}
          roi={null}
        />
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="text-base font-black mb-1 flex items-center gap-2">
        <CalendarDays size={16} className="text-neon" />Planning a night?
      </div>
      <p className="text-xs text-muted mb-4">
        Post the open slot to ROADIE's matching pool, then build the gig poster and sponsor
        one-pager without leaving this page.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {venues.length > 1 && (
          <div className="sm:col-span-2">
            <div className="label mb-1">Room</div>
            <select value={venueId} onChange={e => setVenueId(e.target.value)}
              className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm">
              {venues.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <div className="label mb-1"><CalendarDays size={11} className="inline mr-1" />Date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <div className="label mb-1"><DollarSign size={11} className="inline mr-1" />Guarantee (CAD)</div>
          <input type="number" min="0" value={guarantee} onChange={e => setGuarantee(e.target.value)}
            placeholder="0" className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <div className="label mb-1"><Music size={11} className="inline mr-1" />Genre wanted</div>
          <input value={genreWanted} onChange={e => setGenreWanted(e.target.value)}
            placeholder="e.g. folk, country, rock"
            className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <div className="label mb-1">Notes</div>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="door deal, curfew, PA included…"
            className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {err && <div className="text-xs mt-2" style={{ color: "#ff3d6e" }}>{err}</div>}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={postNight}
          disabled={!date || !venueId || saving}
          className="btn btn-neon text-sm flex items-center gap-1.5 disabled:opacity-40"
        >
          <Plus size={15} />{saving ? "Posting…" : "Post the night + open studio"}
        </button>
        <button onClick={() => setMode("studio")} className="btn text-sm flex items-center gap-1.5">
          <FileText size={15} />Just make artwork
        </button>
      </div>
      <div className="text-[11px] text-muted mt-3">
        <b className="text-white">Gig poster</b> — print, PNG or SVG.&nbsp;&nbsp;
        <b className="text-white">Sponsor pitch</b> — same night as a one-pager with your draw and ROI numbers.
      </div>
    </div>
  );
}
