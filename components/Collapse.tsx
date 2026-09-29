"use client";
import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

// One collapsible group, used everywhere a list repeats.
//
// Standing rule: a group ships CLOSED. Expanding is the user's move, not the
// page's opening state — otherwise every town, season and stop is open at once
// and the screen is a dump rather than a structure.
//
// The closed row still has to earn its space, so it carries a count and any
// status pills. You should be able to skim the closed list and know where to
// look without opening anything.

export default function Collapse({
  title, count, meta, pills, children, defaultOpen = false, storageKey, tone,
}: {
  title: React.ReactNode;
  count?: number | string;
  meta?: React.ReactNode;          // right-hand summary, visible while closed
  pills?: React.ReactNode;         // status chips, visible while closed
  children: React.ReactNode;
  defaultOpen?: boolean;           // only for "the thing you're looking at"
  storageKey?: string;             // remember this one group's state
  tone?: string;                   // left border accent for warnings
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = localStorage.getItem(`roadie_open_${storageKey}`);
      if (v === "1") setOpen(true);
    } catch { /* private mode */ }
  }, [storageKey]);

  function toggle() {
    setOpen(o => {
      const next = !o;
      if (storageKey) { try { localStorage.setItem(`roadie_open_${storageKey}`, next ? "1" : "0"); } catch {} }
      return next;
    });
  }

  return (
    <div className={`card ${tone ? "border-l-2" : ""}`} style={tone ? { borderLeftColor: tone } : undefined}>
      <button onClick={toggle} aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-panel2 rounded-2xl">
        <ChevronRight size={14} className="shrink-0 text-muted transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }} />
        <span className="font-bold truncate">{title}</span>
        {count !== undefined && count !== null && (
          <span className="pill shrink-0 text-[10px]">{count}</span>
        )}
        {pills}
        {meta && <span className="ml-auto text-[11px] text-muted shrink-0">{meta}</span>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
