"use client";
import React, { useEffect, useRef, useState } from "react";

// TRANSPORT — the shared playhead, and the panels that show it.
//
// The floating panels need the current time sixty times a second. Pushing that
// through React state would re-render the whole studio on every frame, so the
// transport is a plain mutable object instead: the timeline writes to it, the
// panels read it on their own animation frame, and React never sees the churn.
// Only the object's identity crosses a prop, and that never changes.
//
// The panels use requestAnimationFrame deliberately. rAF stops in a background
// tab — which is exactly right for a display: nobody is reading a clock they
// cannot see. The parts that must keep running when the tab is hidden (playback
// and export) use the Worker pump in Timeline.tsx and are untouched by this.

export type Transport = {
  time: number;
  playing: boolean;
  total: number;
  beat: number;
  bpm: number;
  canvas: HTMLCanvasElement | null;
  seek: (t: number) => void;
  toggle: () => void;
};

export function makeTransport(): Transport {
  return {
    time: 0, playing: false, total: 0, beat: 0.5, bpm: 120, canvas: null,
    seek: () => {}, toggle: () => {},
  };
}

/** Read the transport on every frame without re-rendering anything above. */
function useTick(t: Transport, pick: (t: Transport) => string) {
  const [v, setV] = useState(() => pick(t));
  const last = useRef(v);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const next = pick(t);
      // Only touch state when the displayed value actually changed — a clock
      // showing hundredths still only changes a hundred times a second, not
      // every frame, and a still transport costs nothing at all.
      if (next !== last.current) { last.current = next; setV(next); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [t, pick]);
  return v;
}

/**
 * Pointer capture, defensively.
 *
 * setPointerCapture throws if the pointer id is not currently active, which
 * happens for real on fast clicks and on some touch/stylus stacks. Capture is
 * an optimisation — it keeps a drag alive when the cursor leaves the element —
 * so losing it must never take the interaction down with it.
 */
export function capture(e: React.PointerEvent) {
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
}
export function release(e: React.PointerEvent) {
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
}

const two = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** mm:ss.cc — hundredths, because a 4.84s clip is not a 4.8s clip. */
export function timecode(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${two(s / 60)}:${two(s % 60)}.${two((s % 1) * 100)}`;
}

// --- the big clock ---------------------------------------------------------

export function ClockPanel({ t }: { t: Transport }) {
  const tc = useTick(t, tr => timecode(tr.time));
  const meta = useTick(t, tr => JSON.stringify({
    p: tr.playing,
    b: tr.total ? Math.floor(tr.time / tr.beat) + 1 : 0,
    bar: tr.total ? Math.floor(tr.time / (tr.beat * 4)) + 1 : 0,
    tot: Math.round(tr.total * 100),
    bpm: tr.bpm,
  }));
  const m = JSON.parse(meta);

  return (
    <div className="h-full flex flex-col justify-center gap-1 select-none">
      <div className="flex items-baseline gap-2">
        <span style={{
          // Tabular figures, or the whole clock jitters as digits change width.
          fontVariantNumeric: "tabular-nums",
          fontSize: "clamp(28px, 15cqw, 76px)", lineHeight: 1,
          fontWeight: 700, letterSpacing: "-0.02em",
          color: m.p ? "#ff3d6e" : "#f0f0f5",
        }}>{tc}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#8a8aa0" }}>
        <span>of <b style={{ color: "#c9c9d6" }}>{timecode(m.tot / 100)}</b></span>
        <span>bar <b style={{ color: "#c9c9d6" }}>{m.bar}</b></span>
        <span>beat <b style={{ color: "#c9c9d6" }}>{m.b}</b></span>
        <span><b style={{ color: "#c9c9d6" }}>{m.bpm}</b> bpm</span>
      </div>
      <div className="flex gap-1.5 mt-1">
        <button className="btn px-2 py-1 text-[11px]" onClick={() => t.toggle()}>
          {m.p ? "Pause" : "Play"}
        </button>
        <button className="btn px-2 py-1 text-[11px]" onClick={() => t.seek(0)}>Top</button>
        <button className="btn px-2 py-1 text-[11px]" onClick={() => t.seek(t.time - t.beat)}>-beat</button>
        <button className="btn px-2 py-1 text-[11px]" onClick={() => t.seek(t.time + t.beat)}>+beat</button>
      </div>
    </div>
  );
}

// --- the scrub -------------------------------------------------------------

export function ScrubPanel({ t }: { t: Transport }) {
  const bar = useRef<HTMLDivElement>(null);
  const pos = useTick(t, tr => String(tr.total ? (tr.time / tr.total) * 100 : 0));
  const tc = useTick(t, tr => timecode(tr.time));
  const dragging = useRef(false);

  const at = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || !t.total) return;
    t.seek(Math.max(0, Math.min(t.total, ((clientX - r.left) / r.width) * t.total)));
  };

  return (
    <div className="h-full flex flex-col justify-center gap-2 select-none">
      <div
        ref={bar}
        onPointerDown={e => {
          dragging.current = true;
          // Seek FIRST. setPointerCapture throws NotFoundError if the pointer
          // is no longer active — a fast click or a touch stack that has
          // already released — and an exception here would swallow the seek.
          at(e.clientX);
          capture(e);
        }}
        onPointerMove={e => dragging.current && at(e.clientX)}
        onPointerUp={e => {
          dragging.current = false;
          release(e);
        }}
        className="relative h-9 rounded-lg cursor-pointer"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a3a" }}>
        <div className="absolute inset-y-0 left-0 rounded-l-lg pointer-events-none"
          style={{ width: `${pos}%`, background: "rgba(255,61,110,0.22)" }} />
        <div className="absolute inset-y-0 w-[2px] pointer-events-none"
          style={{ left: `${pos}%`, background: "#ff3d6e" }} />
      </div>
      <div className="flex items-center gap-2 text-[11px]" style={{ color: "#8a8aa0" }}>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "#c9c9d6" }}>{tc}</span>
        <span className="ml-auto">drag anywhere on the bar</span>
      </div>
    </div>
  );
}

// --- the video window ------------------------------------------------------

/**
 * A live mirror of the timeline's canvas.
 *
 * It copies rather than drawing its own frame: the timeline is the single
 * source of what the promo looks like, and a second renderer is a second thing
 * that can disagree with the export.
 */
export function VideoPanel({ t }: { t: Transport }) {
  const out = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const dst = out.current, src = t.canvas;
      if (dst && src && src.width && src.height) {
        const box = dst.parentElement;
        const cw = Math.max(1, box?.clientWidth || dst.width);
        // Letterbox to the source's shape so nothing is ever squashed.
        const ch = Math.max(1, Math.round(cw * (src.height / src.width)));
        if (dst.width !== cw || dst.height !== ch) { dst.width = cw; dst.height = ch; }
        const ctx = dst.getContext("2d");
        if (ctx) ctx.drawImage(src, 0, 0, cw, ch);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [t]);

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <div className="flex-1 min-h-0 grid place-items-center rounded-lg overflow-hidden"
        style={{ background: "#000" }}>
        <canvas ref={out} className="max-w-full max-h-full" />
      </div>
      <div className="flex gap-1.5">
        <button className="btn px-2 py-1 text-[11px]" onClick={() => t.toggle()}>Play / Pause</button>
        <button className="btn px-2 py-1 text-[11px]" onClick={() => t.seek(0)}>Top</button>
      </div>
    </div>
  );
}
