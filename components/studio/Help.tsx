"use client";
import React, { useState } from "react";

// A little "?" you can put beside any control. Click for a plain-English note.
// The studio has a lot of knobs; the answer to that is short explanations in
// reach, not a manual nobody opens.
export default function Help({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={`What is ${title}?`}
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-[16px] h-[16px] rounded-full text-[10px] font-bold leading-none
                   border border-[#2a2a3a] bg-[#1c1c28] text-[#8a8aa0]
                   hover:border-[#ff3d6e] hover:text-[#ff3d6e]"
      >?</button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-6 w-64 p-3 rounded-xl text-left
                     bg-[#14141c] border border-[#2a2a3a] shadow-2xl
                     text-[12px] leading-relaxed text-[#c9c9da] normal-case tracking-normal font-normal"
        >
          <span className="block font-bold text-[#e8e8f0] mb-1">{title}</span>
          {children}
        </span>
      )}
    </span>
  );
}

/** Row label + help, the pairing used all over the studio. */
export function Field({ label, help, children }:
  { label: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label flex items-center gap-1.5 mb-1">
        {label}
        {help && <Help title={label}>{help}</Help>}
      </span>
      {children}
    </label>
  );
}
