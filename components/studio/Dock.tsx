"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { capture, release } from "./Transport";

// DOCK — a panel you can move and size.
//
// The episode builder needs the video window, the scrub and the clock all
// visible at once, and where they belong depends on the monitor and the job.
// Rather than guess a layout, every panel floats: drag the header to move it,
// drag any edge or corner to size it, and it stays where you put it.
//
// Three rules this is built around, learned the hard way with floating panels:
//
//   1. A panel must never be able to hide off-screen. Positions are clamped on
//      every move AND re-clamped when the window resizes, so unplugging a second
//      monitor can't lose your clock behind the edge of the world.
//   2. Layout survives reload. It is written to localStorage per panel id, so
//      the room you set up is the room you come back to.
//   3. Pointer events, not mouse events. Same code path for trackpad, mouse and
//      touch, and pointer capture means a fast drag can't "slip off" the handle.
//
// There is always a way back: Reset layout in the dock bar puts everything
// where it started.

export type DockRect = { x: number; y: number; w: number; h: number };

const MIN_W = 220;
const MIN_H = 120;
const HEADER = 30;          // grab strip, also the collapsed height
const EDGE = 7;             // how close to a border counts as a resize grab

// One shared counter so clicking a panel brings it to the front.
let TOP_Z = 40;

const keyFor = (id: string) => `roadie.dock.${id}`;

function clampRect(r: DockRect): DockRect {
  const vw = typeof window === "undefined" ? 1600 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const w = Math.max(MIN_W, Math.min(r.w, vw));
  const h = Math.max(HEADER, Math.min(r.h, vh));
  return {
    w, h,
    // Keep at least a header's worth on screen in both directions — enough to
    // always grab it back.
    x: Math.max(-(w - 80), Math.min(r.x, vw - 80)),
    y: Math.max(0, Math.min(r.y, vh - HEADER)),
  };
}

function loadRect(id: string, fallback: DockRect): DockRect {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(keyFor(id));
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return fallback;
    return clampRect({ x: p.x, y: p.y, w: p.w ?? fallback.w, h: p.h ?? fallback.h });
  } catch { return fallback; }
}

/** Wipe every saved panel position. Backs the "Reset layout" button. */
export function resetDockLayout() {
  if (typeof window === "undefined") return;
  Object.keys(localStorage)
    .filter(k => k.startsWith("roadie.dock."))
    .forEach(k => localStorage.removeItem(k));
}

type Mode = { kind: "move" | "resize"; dx: number; dy: number; edge: string; start: DockRect };

export default function Dock({
  id, title, children, initial, open = true, onClose, accent, footer,
}: {
  id: string;                 // stable — this is the localStorage key
  title: string;
  children: React.ReactNode;
  initial: DockRect;
  open?: boolean;
  onClose?: () => void;
  accent?: string;
  footer?: React.ReactNode;
}) {
  const [rect, setRect] = useState<DockRect>(initial);
  const [collapsed, setCollapsed] = useState(false);
  const [z, setZ] = useState(() => ++TOP_Z);
  const [hoverEdge, setHoverEdge] = useState("");
  const mode = useRef<Mode | null>(null);
  const el = useRef<HTMLDivElement>(null);

  // Read the saved position on mount rather than in useState, so the server and
  // the first client render agree. Doing it in the initialiser is a hydration
  // mismatch every time.
  useEffect(() => { setRect(loadRect(id, initial)); /* eslint-disable-next-line */ }, [id]);

  // Persist, but not on every pixel of a drag.
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(keyFor(id), JSON.stringify(rect)); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [id, rect]);

  // A smaller window must not strand a panel outside it.
  useEffect(() => {
    const onResize = () => setRect(r => clampRect(r));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** Which border is the pointer on? "" means the body. */
  const edgeAt = useCallback((e: React.PointerEvent) => {
    const b = el.current?.getBoundingClientRect();
    if (!b) return "";
    const nearL = e.clientX - b.left < EDGE, nearR = b.right - e.clientX < EDGE;
    const nearT = e.clientY - b.top < EDGE, nearB = b.bottom - e.clientY < EDGE;
    return `${nearT ? "n" : nearB ? "s" : ""}${nearL ? "w" : nearR ? "e" : ""}`;
  }, []);

  const cursorFor = (edge: string) =>
    !edge ? "" :
    edge === "n" || edge === "s" ? "ns-resize" :
    edge === "e" || edge === "w" ? "ew-resize" :
    edge === "nw" || edge === "se" ? "nwse-resize" : "nesw-resize";

  function raise() { setZ(++TOP_Z); }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    raise();
    const edge = edgeAt(e);
    const fromHeader = (e.target as HTMLElement).closest("[data-dock-grab]");
    // Buttons in the header must still be clickable, not start a drag.
    if ((e.target as HTMLElement).closest("[data-dock-nodrag]")) return;
    if (!edge && !fromHeader) return;

    mode.current = {
      kind: edge ? "resize" : "move",
      dx: e.clientX - rect.x, dy: e.clientY - rect.y,
      edge, start: { ...rect },
    };
    // After the mode is committed — setPointerCapture can throw, and losing
    // capture is survivable while losing the drag is not.
    capture(e);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent) {
    const m = mode.current;
    if (!m) { setHoverEdge(edgeAt(e)); return; }

    if (m.kind === "move") {
      setRect(r => clampRect({ ...r, x: e.clientX - m.dx, y: e.clientY - m.dy }));
      return;
    }

    const s = m.start;
    let { x, y, w, h } = s;
    if (m.edge.includes("e")) w = e.clientX - s.x;
    if (m.edge.includes("s")) h = e.clientY - s.y;
    if (m.edge.includes("w")) { w = s.x + s.w - e.clientX; x = e.clientX; }
    if (m.edge.includes("n")) { h = s.y + s.h - e.clientY; y = e.clientY; }
    // Clamp the size BEFORE committing, or dragging a west edge past the
    // minimum walks the panel sideways instead of stopping.
    if (w < MIN_W) { if (m.edge.includes("w")) x = s.x + s.w - MIN_W; w = MIN_W; }
    if (h < MIN_H) { if (m.edge.includes("n")) y = s.y + s.h - MIN_H; h = MIN_H; }
    setRect(clampRect({ x, y, w, h }));
  }

  function onPointerUp(e: React.PointerEvent) {
    release(e);
    mode.current = null;
  }

  if (!open) return null;

  const line = accent || "#2a2a3a";

  return (
    <div
      ref={el}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => !mode.current && setHoverEdge("")}
      style={{
        position: "fixed", left: rect.x, top: rect.y,
        width: rect.w, height: collapsed ? HEADER : rect.h,
        zIndex: z, cursor: cursorFor(hoverEdge),
        // Apple-glass, same as the radio overlays.
        background: "rgba(20,20,28,0.72)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${line}`,
        borderRadius: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        // A drag must not select the page text under it.
        userSelect: mode.current ? "none" : undefined,
      }}>

      <div data-dock-grab
        onDoubleClick={() => setCollapsed(c => !c)}
        style={{
          height: HEADER, flex: "0 0 auto", cursor: mode.current?.kind === "move" ? "grabbing" : "grab",
          display: "flex", alignItems: "center", gap: 8, padding: "0 8px",
          borderBottom: collapsed ? "none" : `1px solid ${line}`,
          background: "rgba(255,255,255,0.03)",
        }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: accent || "#ff3d6e", flex: "0 0 auto" }} />
        <span className="text-[11px] tracking-wide uppercase truncate" style={{ color: "#c9c9d6" }}>{title}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }} data-dock-nodrag>
          <button onClick={() => setCollapsed(c => !c)} title={collapsed ? "Expand" : "Collapse"}
            className="text-[#8a8aa0] hover:text-white px-1.5 leading-none text-[13px]">
            {collapsed ? "+" : "–"}
          </button>
          {onClose && (
            <button onClick={onClose} title="Close"
              className="text-[#8a8aa0] hover:text-white px-1.5 leading-none text-[13px]">x</button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: 10 }} className="scroll">
          {children}
        </div>
      )}
      {!collapsed && footer && (
        <div style={{ flex: "0 0 auto", borderTop: `1px solid ${line}`, padding: "6px 10px" }}>{footer}</div>
      )}
    </div>
  );
}
