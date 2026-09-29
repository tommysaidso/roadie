"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Building2, ClipboardList, BadgeDollarSign } from "lucide-react";

type Stats = { bands: number; venues: number; openSlots: number; sponsorSpend: number };

// Persistent header strip — always visible at the top of every ROADIE page.
// Tap any pill to jump straight to that section. This is the wayfinding
// "back arrow" replacement: you can always hop laterally between Bands /
// Venues / Slots / Sponsors without losing your place in the left nav.
export default function StatHeader() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/stats").then((r) => r.json()).then((d) => alive && setS(d)).catch(() => {});
    const t = setInterval(() => {
      fetch("/api/stats").then((r) => r.json()).then((d) => alive && setS(d)).catch(() => {});
    }, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const pills = [
    { href: "/garage",   label: "Bands",    value: s?.bands ?? "—",    icon: Users,             color: "#ff3d6e" },
    { href: "/venues",   label: "Venues",   value: s?.venues ?? "—",   icon: Building2,         color: "#3df0ff" },
    { href: "/board",    label: "Open slots", value: s?.openSlots ?? "—", icon: ClipboardList,  color: "#ffd166" },
    { href: "/sponsors", label: "Sponsors", value: s ? `CA$${(s.sponsorSpend ?? 0).toLocaleString()}` : "—", icon: BadgeDollarSign, color: "#9b9aff" },
  ];

  return (
    <div className="sticky top-0 lg:top-0 z-30 bg-panel/90 backdrop-blur border-b border-edge">
      <div className="flex items-stretch divide-x divide-edge overflow-x-auto scroll">
        {pills.map(({ href, label, value, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="flex-1 min-w-[120px] px-4 py-2.5 hover:bg-white/[0.04] transition flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-2">
              <Icon size={14} style={{ color }} />
              <span className="text-[10px] uppercase tracking-widest text-muted group-hover:text-white whitespace-nowrap">
                {label}
              </span>
            </div>
            <span className="text-sm font-bold text-white whitespace-nowrap">{value}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
