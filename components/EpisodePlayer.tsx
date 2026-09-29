"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, MessageSquare, Loader2, Volume2, Eye, EyeOff, SkipForward } from "lucide-react";

type Part = { kind: string; id: string; vo: string; audio?: string; sec?: number; topic?: string };

// The spine is fixed and approved. An interrupt pauses it, answers out of the
// pre-rendered atom bank (so audio starts immediately rather than after a live
// TTS round-trip), then reorders what is left so the beats matching whatever
// they just probed play next.
export default function EpisodePlayer({ manifest, base }: { manifest: any; base: string }) {
  const [order, setOrder] = useState<string[]>(manifest.beats.map((b: any) => b.id));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [visual, setVisual] = useState(true);
  const [q, setQ] = useState("");
  const [thinking, setThinking] = useState(false);
  const [log, setLog] = useState<{ who: "you" | "roadie"; text: string; source?: string }[]>([]);
  const [answering, setAnswering] = useState(false);
  const [played, setPlayed] = useState<string[]>([]);
  const [shotNo, setShotNo] = useState(0);

  const audio = useRef<HTMLAudioElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const queue = useRef<Part[]>([]);
  const shotTimers = useRef<any[]>([]);
  const resumeAfter = useRef(false);

  const beatOf = (id: string) => manifest.beats.find((b: any) => b.id === id);
  const beat = beatOf(order[idx]);

  useEffect(() => {
    audio.current = new Audio();
    audio.current.preload = "auto";
    // Connectors are tiny and always the first thing heard on an interrupt —
    // warming them is what makes an answer feel instant.
    (manifest.connectors || []).forEach((c: any) => { if (c.audio) new Audio(`${base}/${c.audio}`); });
    return () => { audio.current?.pause(); audio.current = null;
      shotTimers.current.forEach(clearTimeout); shotTimers.current = []; };
  }, [manifest, base]);

  const playFile = useCallback((src: string, onEnd: () => void) => {
    const a = audio.current; if (!a) return;
    a.pause(); a.src = src; a.onended = onEnd;
    a.play().catch(() => onEnd());
  }, []);

  // --- the spine ---------------------------------------------------------
  const playBeat = useCallback((i: number) => {
    const b = beatOf(order[i]);
    if (!b) { setPlaying(false); return; }
    setIdx(i);
    setPlayed(p => (p.includes(b.id) ? p : [...p, b.id]));

    // Each beat is cut from TWO shots, not one clip on a loop — the second lands
    // partway through the line so the picture moves with what's being said.
    shotTimers.current.forEach(clearTimeout);
    shotTimers.current = [];
    const shots: string[] = b.clips || [];
    if (video.current && shots.length) {
      const v = video.current;
      const show = (n: number) => { v.src = `${base}/${shots[n]}`; v.play().catch(() => {}); };
      show(0);
      setShotNo(0);
      if (shots.length > 1 && b.sec) {
        // hand over just past halfway, so neither shot outstays the line
        const at = Math.max(2500, (b.sec * 1000) * 0.52);
        shotTimers.current.push(setTimeout(() => { show(1); setShotNo(1); }, at));
      }
    }
    if (!b.audio) { setTimeout(() => playBeat(i + 1), 2500); return; }
    playFile(`${base}/${b.audio}`, () => {
      if (i + 1 < order.length) playBeat(i + 1);
      else { setPlaying(false); setStarted(false); }
    });
  }, [order, base, playFile]);

  function start() {
    setStarted(true); setPlaying(true);
    playBeat(idx);
  }

  function toggle() {
    const a = audio.current; if (!a) return;
    if (playing) { a.pause(); video.current?.pause();
      shotTimers.current.forEach(clearTimeout); shotTimers.current = [];
      setPlaying(false); }
    else { a.play().catch(() => {}); video.current?.play().catch(() => {}); setPlaying(true); }
  }

  function skip() {
    audio.current?.pause();
    shotTimers.current.forEach(clearTimeout); shotTimers.current = [];
    if (idx + 1 < order.length) playBeat(idx + 1);
    else { setPlaying(false); setStarted(false); }
  }

  // --- interrupts --------------------------------------------------------
  function playQueue() {
    const next = queue.current.shift();
    if (!next) {
      setAnswering(false);
      if (resumeAfter.current) { resumeAfter.current = false; setPlaying(true); playBeat(idx + 1); }
      return;
    }
    if (!next.audio) { playQueue(); return; }
    playFile(`${base}/${next.audio}`, playQueue);
  }

  function speak(text: string, done: () => void) {
    // Live answers have no cached audio — the browser reads them.
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02; u.onend = done; u.onerror = () => done();
      speechSynthesis.speak(u);
    } catch { done(); }
  }

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const question = q.trim(); if (!question || thinking) return;
    setQ(""); setLog(l => [...l, { who: "you", text: question }]);

    // cut the narration the moment they speak
    audio.current?.pause(); video.current?.pause();
    shotTimers.current.forEach(clearTimeout); shotTimers.current = [];
    const wasRunning = playing;
    setPlaying(false);
    setThinking(true);

    try {
      const r = await fetch("/api/roadietv", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, played }),
      });
      const d = await r.json();
      setThinking(false);
      if (!r.ok) { setLog(l => [...l, { who: "roadie", text: d.error || "Something went wrong." }]); return; }

      setLog(l => [...l, { who: "roadie", text: d.text, source: d.source }]);

      // the answer may push matching beats to the front of what's left
      if (Array.isArray(d.reorder) && d.reorder.length) {
        setOrder([...played, ...d.reorder.filter((id: string) => !played.includes(id))]);
        setIdx(played.length - 1);
      }

      resumeAfter.current = wasRunning;
      setAnswering(true);
      if (d.parts?.length) { queue.current = d.parts; playQueue(); }
      else speak(d.text, () => {
        setAnswering(false);
        if (resumeAfter.current) { resumeAfter.current = false; setPlaying(true); playBeat(idx + 1); }
      });
    } catch {
      setThinking(false);
      setLog(l => [...l, { who: "roadie", text: "Couldn't reach the narrator just now." }]);
    }
  }

  const pct = Math.round(((played.length) / manifest.beats.length) * 100);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      {/* STAGE */}
      <div className="card p-0 overflow-hidden">
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {visual ? (
            <video ref={video} muted playsInline loop
              className="w-full h-full object-cover"
              poster={`${base}/poster.jpg`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Volume2 size={44} className="text-muted" />
            </div>
          )}

          {!started && (
            <button onClick={start}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px]">
              <div className="w-16 h-16 rounded-full bg-neon/90 flex items-center justify-center">
                <Play size={26} className="text-black ml-1" />
              </div>
              <div className="text-white font-black text-lg">{manifest.title}</div>
              <div className="text-xs text-muted">
                {Math.round(manifest.beats.reduce((t: number, b: any) => t + (b.sec || 0), 0))}s · cut in any time
              </div>
            </button>
          )}

          {started && beat && (
            <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent">
              <div className="text-[10px] tracking-widest text-neon mb-1">
                {beat.cue}{(beat.clips?.length || 0) > 1 && <span className="text-muted"> · shot {shotNo + 1}/{beat.clips.length}</span>}
              </div>
              <div className="text-sm text-white/90 leading-snug">{beat.vo}</div>
            </div>
          )}

          {answering && (
            <div className="absolute top-3 left-3 pill" style={{ borderColor: "#3ddc84", color: "#3ddc84" }}>
              answering
            </div>
          )}
        </div>

        <div className="p-3 flex items-center gap-2 flex-wrap">
          <button onClick={started ? toggle : start} className="btn btn-neon text-sm flex items-center gap-1">
            {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Pause" : started ? "Resume" : "Play"}
          </button>
          <button onClick={skip} disabled={!started} className="btn text-sm flex items-center gap-1 disabled:opacity-40">
            <SkipForward size={15} />Next
          </button>
          <button onClick={() => setVisual(v => !v)} className="btn text-sm flex items-center gap-1">
            {visual ? <EyeOff size={15} /> : <Eye size={15} />}{visual ? "Audio only" : "Show visuals"}
          </button>
          <div className="flex-1 min-w-[120px]">
            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <div className="h-full bg-neon transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="text-xs text-muted">{played.length}/{manifest.beats.length}</span>
        </div>
      </div>

      {/* INTERRUPT */}
      <div className="card p-4 flex flex-col" style={{ maxHeight: 560 }}>
        <div className="label mb-2 flex items-center gap-1"><MessageSquare size={12} />Cut in any time</div>

        <div className="flex-1 overflow-y-auto scroll space-y-2 mb-3">
          {!log.length && (
            <div className="text-xs text-muted leading-relaxed">
              Ask whatever you want while it plays. It answers out of the plan — and where the
              plan doesn&rsquo;t say, it tells you that instead of guessing.
              <div className="mt-2 flex flex-wrap gap-1">
                {["What's the ask?", "Is this built or a deck?", "What if a venue says no?", "Why no alcohol?"]
                  .map(s => (
                    <button key={s} onClick={() => setQ(s)} className="pill text-[11px]">{s}</button>
                  ))}
              </div>
            </div>
          )}
          {log.map((m, i) => (
            <div key={i} className={m.who === "you" ? "text-right" : ""}>
              <div className={`inline-block text-xs rounded-xl px-3 py-2 max-w-[92%] text-left ${
                m.who === "you" ? "bg-panel2 text-white" : "border border-edge text-muted"}`}>
                {m.text}
                {m.source === "unknown" && <div className="text-[10px] mt-1 text-amber">outside the plan</div>}
              </div>
            </div>
          ))}
          {thinking && <div className="text-xs text-muted flex items-center gap-1"><Loader2 size={12} className="animate-spin" />…</div>}
        </div>

        <form onSubmit={ask} className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about the plan…"
            className="flex-1 min-w-0 bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={!q.trim() || thinking}
            className="btn btn-neon text-sm px-3 disabled:opacity-40">Ask</button>
        </form>
      </div>
    </div>
  );
}
