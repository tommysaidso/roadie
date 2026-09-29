"use client";
import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import ShootUploader from "@/app/shoot/ShootUploader";

// SHOOT — the pop-out inside The PIT.
//
// Not a page of its own in the fan's journey. They are already in the portal
// watching The Wire; sending in what they shot is one tap from there, and it
// closes back to where they were. A separate destination would mean navigating
// away from the thing that made them want to do it.
//
// THE LOOK: iPhone glass. Heavy backdrop blur over a dimmed room, SHARP edges
// rather than the rounded cards elsewhere, and a hard drop shadow so the panel
// sits above the page instead of in it. The primary action glows, and every
// interactive thing shifts colour while it is being used.

type Stop = { id: number; city: string; date: string; venue: string | null };

export default function ShootPopout() {
  const [open, setOpen] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);

  // Fetched on open rather than on mount: The PIT is the busiest page we have
  // and most visitors never touch this.
  useEffect(() => {
    if (!open || stops.length) return;
    fetch("/api/fan-clips").then(r => r.json())
      .then(d => setStops(d.stops || [])).catch(() => {});
  }, [open, stops.length]);

  // Escape closes, and the page behind must not scroll while it is up —
  // otherwise a phone drags the feed around under the panel.
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", k);
    };
  }, [open]);

  return (
    <>
      {/* ---- the trigger ---- */}
      <button
        onClick={() => setOpen(true)}
        className="group relative w-full text-left px-5 py-4 transition-all duration-200"
        style={{
          background: "linear-gradient(135deg, rgba(255,61,110,0.14), rgba(61,240,255,0.06))",
          border: "1px solid rgba(255,61,110,0.45)",
          boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = "0 10px 34px rgba(0,0,0,0.6), 0 0 26px rgba(255,61,110,0.35)";
          e.currentTarget.style.borderColor = "#ff3d6e";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = "0 6px 22px rgba(0,0,0,0.55)";
          e.currentTarget.style.borderColor = "rgba(255,61,110,0.45)";
          e.currentTarget.style.transform = "none";
        }}>
        <div className="flex items-center gap-3">
          <Camera size={20} style={{ color: "#ff3d6e" }} className="shrink-0" />
          <div className="min-w-0">
            <div className="font-black text-base leading-tight">You were there. Send what you shot.</div>
            <div className="text-xs mt-0.5" style={{ color: "#9a9aae" }}>
              Your clips get cut into one multi-camera video of the night.
            </div>
          </div>
        </div>
      </button>

      {/* ---- the pop-out ---- */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{
            background: "rgba(6,6,10,0.72)",
            backdropFilter: "blur(22px) saturate(160%)",
            WebkitBackdropFilter: "blur(22px) saturate(160%)",
            animation: "shootFade .16s ease-out",
          }}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto scroll"
            style={{
              background: "rgba(18,18,24,0.86)",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.14)",
              // Sharp. The punch comes from the shadow and the hairline, not a radius.
              borderRadius: 0,
              boxShadow: "0 30px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,61,110,0.18), inset 0 1px 0 rgba(255,255,255,0.09)",
              animation: "shootIn .2s cubic-bezier(.2,.8,.2,1)",
            }}>
            <div className="flex items-center gap-3 px-5 py-4 sticky top-0 z-10"
              style={{
                background: "rgba(18,18,24,0.92)",
                backdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(255,255,255,0.10)",
              }}>
              <Camera size={17} style={{ color: "#ff3d6e" }} />
              <div className="font-black">From the floor</div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto p-1.5 transition-colors"
                style={{ color: "#9a9aae" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ff3d6e")}
                onMouseLeave={e => (e.currentTarget.style.color = "#9a9aae")}
                aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <ShootUploader stops={stops} glass />
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shootFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes shootIn {
          from { opacity: 0; transform: translateY(14px) scale(.99) }
          to   { opacity: 1; transform: none }
        }
      `}</style>
    </>
  );
}
