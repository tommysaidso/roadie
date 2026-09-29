"use client";
import React, { useState } from "react";
import Link from "next/link";
import { MapPin, Loader2, ArrowRight } from "lucide-react";

// "Where's my ring?" — one field, either country.
//
// It reads the shape of what you typed rather than making you pick a country
// first: a leading letter is a Canadian postal code, a leading digit is a US
// ZIP. The label corrects itself once it knows, because calling a postal code a
// ZIP (or the reverse) tells a member this wasn't built for them.

export default function PostalAssist({ defaultCountry }: { defaultCountry?: "CA" | "US" }) {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Guess from what's typed so far; fall back to the caller's context.
  const guessed = /^[A-Za-z]/.test(code) ? "CA" : /^\d/.test(code) ? "US" : (defaultCountry || "CA");
  const label = guessed === "US" ? "ZIP code" : "Postal code";
  const placeholder = guessed === "US" ? "98225" : "V1Y 1A1";

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch(`/api/postal?code=${encodeURIComponent(code)}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't place that."); return; }
      setRes(d);
    } catch { setErr("Couldn't place that."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card p-4">
      <div className="label mb-2 flex items-center gap-1.5"><MapPin size={13} /> Find your ring</div>
      <form onSubmit={go} className="flex flex-wrap gap-2 items-center">
        <input value={code} onChange={e => setCode(e.target.value)}
          placeholder={placeholder} aria-label={label}
          className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm outline-none focus:border-neon w-40" />
        <button className="btn btn-neon text-sm" disabled={busy || !code.trim()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Find"}
        </button>
        <span className="text-[11px] text-muted">{label}</span>
      </form>

      {err && <div className="text-sm mt-3" style={{ color: "#e05c7a" }}>{err}</div>}

      {res && (
        <div className="mt-3 text-sm">
          <div className="text-muted text-xs mb-1">
            {res.code}{res.place ? ` · ${res.place}` : ""}{res.region ? ` · ${res.region}` : ""}
          </div>

          {res.hub ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>Nearest ring:</span>
              <span className="font-bold">{res.hub.name}</span>
              <span className="pill text-[10px]">{res.hub.km} km</span>
              {!res.hub.live && (
                <span className="pill text-[10px]" style={{ borderColor: "#8a8aa0", color: "#8a8aa0" }}>
                  coming soon
                </span>
              )}
            </div>
          ) : (
            <div className="text-muted">
              No ring near you yet — but a room can still put its name down.
            </div>
          )}

          {/* Two doors, always. Even with no ring running, an early host is a
              member we want; and for a US act the real offer is the way north. */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Link href="/backend/venue" className="btn text-sm">
              Put my room on the map <ArrowRight size={13} />
            </Link>
            {res.crossing && (
              <Link href={res.crossing} className="btn btn-neon text-sm">
                Touring north — border &amp; visas
              </Link>
            )}
          </div>

          {res.country === "US" && !res.in_corridor && (
            <p className="text-[11px] text-muted mt-2">
              You&apos;re outside the Pacific corridor we run today. Coming north is still open
              to you, and we can help set it up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
