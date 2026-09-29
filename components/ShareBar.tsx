"use client";
import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function ShareBar({ title, text, url }: { title: string; text: string; url?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const target = url || (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await navigator.share({ title, text, url: target }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button onClick={share} className="pill hover:border-neon flex items-center gap-1.5 text-xs" title="Share">
      {copied
        ? <><Check size={12} className="text-moss" /> Copied!</>
        : <><Share2 size={12} /> Share</>}
    </button>
  );
}
