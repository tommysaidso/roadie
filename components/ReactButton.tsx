"use client";
import { useState } from "react";
import { ThumbsUp } from "lucide-react";

export default function ReactButton({ noticeId, initial = 0 }: { noticeId: number; initial?: number }) {
  const [count, setCount] = useState(initial);
  const [reacted, setReacted] = useState(false);

  async function react() {
    if (reacted) return;
    try {
      const r = await fetch(`/api/notices/${noticeId}/react`, { method: "POST" });
      const d = await r.json();
      setCount(d.reactions ?? count + 1);
      setReacted(true);
    } catch {}
  }

  return (
    <button onClick={react} disabled={reacted}
      className={`flex items-center gap-1 text-xs pill ${reacted ? "border-neon text-neon" : "hover:border-neon"}`}>
      <ThumbsUp size={12} />{count > 0 ? ` ${count}` : ""}
    </button>
  );
}
