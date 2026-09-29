"use client";
import React, { useRef, useState } from "react";

// THE LASSO — draw round something in the frame and give it a name.
//
// This is the manual half of "select the subject", and it is deliberately the
// half built first. SAM and a background remover are already on the NAS, so an
// auto-select can be added later — but it would only ever produce the same
// thing this produces: a ring of points. Everything downstream (isolate, knock
// the background out, invert, dim round it) is written against the points, not
// against the model, so the model can arrive without any of it changing.
//
// Freehand, not click-a-polygon. You are drawing round a person or a bus, and
// clicking twenty corners round a person is a chore nobody does twice.

export default function Lasso({
  onDone, onCancel,
}: {
  // Points come back 0..1 of the frame, so a mask means the same thing at any
  // canvas or export size.
  onDone: (points: [number, number][]) => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pts, setPts] = useState<[number, number][]>([]);
  const drawing = useRef(false);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  // Thin the trail as it is drawn. A freehand drag fires a point every few
  // pixels; keeping all of them makes a path that is slow to clip against and
  // no more accurate than one that skips the near-duplicates.
  const push = (p: [number, number]) => {
    setPts(prev => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.008) return prev;
      return [...prev, p];
    });
  };

  const d = pts.length
    ? pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`).join(" ") +
      (drawing.current ? "" : " Z")
    : "";

  return (
    <div ref={box}
      className="absolute inset-0 z-20 cursor-crosshair"
      onPointerDown={e => {
        drawing.current = true;
        setPts([at(e)]);
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
      }}
      onPointerMove={e => { if (drawing.current) push(at(e)); }}
      onPointerUp={e => {
        drawing.current = false;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      }}
      onPointerCancel={() => { drawing.current = false; }}>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full pointer-events-none">
        {/* The ring is drawn with a non-scaling stroke, otherwise the 0-100
            viewBox stretches it into a smear on a wide frame. */}
        {d && <path d={d} fill="rgba(255,61,110,0.18)" stroke="#ff3d6e"
          strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>

      <div className="absolute left-2 bottom-2 flex gap-2 items-center"
        onPointerDown={e => e.stopPropagation()}>
        <span className="text-[11px] px-2 py-1 rounded"
          style={{ background: "rgba(0,0,0,0.7)", color: "#c9c9d6" }}>
          {pts.length < 3 ? "Drag round the subject" : `${pts.length} points`}
        </span>
        <button className="btn px-2 py-1 text-[11px]" disabled={pts.length < 3}
          onClick={() => onDone(pts)}>Use this</button>
        <button className="btn px-2 py-1 text-[11px]" onClick={() => setPts([])}>Clear</button>
        <button className="btn px-2 py-1 text-[11px]" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
