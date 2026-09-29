"use client";
/**
 * Tips + first-run guided tour.
 * - <Tip text="...">: hover tooltip on any control. Global on/off, persisted.
 * - <GuidedTour/>: spotlight walkthrough over elements marked data-tour="...".
 *   Auto-starts on first studio visit; relaunchable from the Help button.
 * - <HelpButton/>: "?" pill — restart tour, toggle hover tips.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect,
         useRef, useState, ReactNode } from "react";

/* useLayoutEffect warns when it runs during a server render, and every page
   here is server-rendered before it hydrates. */
const useIsoLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TIPS_KEY = "mmm_tips_enabled";
const TOUR_KEY = "mmm_tour_done";

const TipsCtx = createContext<{ tips: boolean; setTips: (v: boolean) => void }>({ tips: true, setTips: () => {} });

export function TipsProvider({ children }: { children: ReactNode }) {
  const [tips, setTipsState] = useState(true);
  useEffect(() => { setTipsState(localStorage.getItem(TIPS_KEY) !== "off"); }, []);
  const setTips = (v: boolean) => { setTipsState(v); localStorage.setItem(TIPS_KEY, v ? "on" : "off"); };
  return <TipsCtx.Provider value={{ tips, setTips }}>{children}</TipsCtx.Provider>;
}

export function useTips() { return useContext(TipsCtx); }

export function Tip({ text, children, side = "top" }: { text: string; children: ReactNode; side?: "top" | "bottom" }) {
  const { tips } = useTips();
  const [show, setShow] = useState(false);
  if (!tips) return <>{children}</>;
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className={`pointer-events-none absolute left-1/2 z-[70] w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-white/15 bg-black/90 px-2.5 py-1.5 text-[10px] leading-snug text-ink shadow-xl ${side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}>
          {text}
        </span>
      )}
    </span>
  );
}

// ---- Guided tour -----------------------------------------------------------

type Side = "top" | "bottom" | "left" | "right";
/* `place` is the preferred side for the card; the solver overrules it when
   that side would cover the target. */
type Step = { target: string; title: string; text: string; place?: Side };

export type TourStep = Step;
const STUDIO_STEPS: Step[] = [
  { target: "", title: "Welcome to your studio",
    text: "Quick tour — six stops, ~60 seconds. You can rerun it anytime from the ? button, and turn hover tips on/off there too." },
  { target: "catalog", title: "Your catalog lives here",
    text: "Every song (a \"work\") is in the left rail. Click one to load it. No songs yet? Drop any audio file on the ingest box and a work is born." },
  { target: "tabs", title: "The workbench tabs",
    text: "RECORD captures takes from your mic. MORPH, SWARM and EQ transform sound. LIBRARY browses your samples. Everything you make lands as takes on the song." },
  { target: "record", title: "Record + takes",
    text: "Hit record to capture a take. Existing takes are listed below — press ▶ on any take to hear it, the pencil to rename, drag it down onto the timeline to arrange." },
  { target: "arrangement", title: "The arrangement timeline",
    text: "Drag takes from the list onto a lane (vocal, drum, bass…). Move clips, trim their edges, then press the transport ▶ to play the whole stack with the playhead." },
  { target: "tabs", title: "That's the loop",
    text: "Record or generate → audition takes → arrange → play. When a song's ready, use stack & register down below to mint ISRCs and start the paperwork. Hover anything for a tip. Enjoy." },
];

/**
 * Positions the card beside the spotlight and points an arrow at it.
 *
 * Done imperatively in a layout effect rather than through state, because it
 * needs the card's real measured size and two passes (measure, maybe narrow,
 * re-solve) — routing that through React would render three times per step.
 *
 * The rules it has to obey, each one learned the hard way:
 *  - the card must never sit on top of the thing it is explaining
 *  - it must stay fully on screen
 *  - if no full-width position clears the target, narrow the card and re-solve
 *  - the arrow belongs ON the card edge facing the target, not somewhere near it
 */
function placeCard(card: HTMLDivElement, arrow: HTMLDivElement, box: DOMRect, prefer: Side) {
  const pad = 6, gap = 14;
  const hx = box.left - pad, hy = box.top - pad;
  const hw = box.width + pad * 2, hh = box.height + pad * 2;
  const vw = window.innerWidth, vh = window.innerHeight;

  card.style.width = "";
  let cw = card.offsetWidth, ch = card.offsetHeight;

  const solve = () => {
    const clamp = (x: number, y: number): [number, number] => [
      Math.max(12, Math.min(vw - cw - 12, x)),
      Math.max(12, Math.min(vh - ch - 12, y)),
    ];
    const cands: Record<Side, [number, number]> = {
      bottom: clamp(hx + hw / 2 - cw / 2, hy + hh + gap),
      top:    clamp(hx + hw / 2 - cw / 2, hy - ch - gap),
      right:  clamp(hx + hw + gap,        hy + hh / 2 - ch / 2),
      left:   clamp(hx - cw - gap,        hy + hh / 2 - ch / 2),
    };
    const area = ([x, y]: [number, number]) => {
      const ox = Math.max(0, Math.min(x + cw, hx + hw) - Math.max(x, hx));
      const oy = Math.max(0, Math.min(y + ch, hy + hh) - Math.max(y, hy));
      return ox * oy;
    };
    const pick = (Object.keys(cands) as Side[]).sort((a, b) => {
      const d = area(cands[a]) - area(cands[b]);
      if (d !== 0) return d;
      if (a === prefer) return -1;
      if (b === prefer) return 1;
      return 0;
    })[0];
    return { pos: cands[pick], overlap: area(cands[pick]) };
  };

  let solved = solve();
  if (solved.overlap > 0) {
    const gutter = Math.max(hx - gap * 2, vw - (hx + hw) - gap * 2);
    const shrunk = Math.max(228, Math.floor(gutter));
    if (shrunk < cw) {
      card.style.width = `${shrunk}px`;
      cw = card.offsetWidth; ch = card.offsetHeight;
      solved = solve();
    }
  }

  const [cx, cy] = solved.pos;
  card.style.left = `${cx}px`;
  card.style.top = `${cy}px`;

  const dx = hx + hw / 2 - (cx + cw / 2);
  const dy = hy + hh / 2 - (cy + ch / 2);
  if (dx || dy) {
    const s = Math.min(
      dx ? (cw / 2 + 9) / Math.abs(dx) : Infinity,
      dy ? (ch / 2 + 9) / Math.abs(dy) : Infinity,
    );
    arrow.style.display = "";
    arrow.style.left = `${cx + cw / 2 + dx * s}px`;
    arrow.style.top = `${cy + ch / 2 + dy * s}px`;
    arrow.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
  } else {
    arrow.style.display = "none";
  }
}

export function GuidedTour({ auto = true, steps, storageKey }: { auto?: boolean; steps?: Step[]; storageKey?: string }) {
  const ALL = steps ?? STUDIO_STEPS;
  const KEY = storageKey ?? TOUR_KEY;
  const [step, setStep] = useState<number>(-1);
  const [live, setLive] = useState<Step[]>(ALL);
  const [box, setBox] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  /* Resolve against what is actually rendered. A step whose element is not on
     this page used to still count and show an un-anchored card floating in the
     middle — the tour talking about something you cannot see. Targetless steps
     (the welcome card) are deliberately kept. */
  const resolve = useCallback(() => {
    const usable = ALL.filter(s => {
      if (!s.target) return true;
      const el = document.querySelector(`[data-tour="${s.target}"]`);
      if (!el) return false;
      /* A zero-size anchor is as useless as a missing one — it spotlights a
         dot. That is exactly what an empty <div data-tour="..."/> produces. */
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    });
    setLive(usable.length ? usable : ALL);
    return usable.length ? usable : ALL;
  }, [ALL]);

  useEffect(() => {
    if (auto && typeof window !== "undefined" && !localStorage.getItem(KEY)) {
      const t = setTimeout(() => { resolve(); setStep(0); }, 1200);
      return () => clearTimeout(t);
    }
  }, [auto, KEY, resolve]);

  useEffect(() => {
    const h = () => { resolve(); setStep(0); };
    window.addEventListener("mmm:start-tour", h);
    return () => window.removeEventListener("mmm:start-tour", h);
  }, [resolve]);

  useEffect(() => {
    if (step < 0) { setBox(null); return; }
    const target = live[step]?.target;
    if (!target) { setBox(null); return; }
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) { setBox(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setBox(el.getBoundingClientRect());
    update();
    const t = setTimeout(update, 350);                 // after the scroll settles
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, live]);

  useIsoLayout(() => {
    if (step < 0 || !box || !cardRef.current || !arrowRef.current) return;
    placeCard(cardRef.current, arrowRef.current, box, live[step]?.place ?? "bottom");
  }, [box, step, live]);

  const done = useCallback(() => { localStorage.setItem(KEY, "1"); setStep(-1); }, [KEY]);

  useEffect(() => {
    if (step < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); done(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault(); setStep(p => (p + 1 < live.length ? p + 1 : (done(), -1)));
      } else if (e.key === "ArrowLeft") { e.preventDefault(); setStep(p => Math.max(0, p - 1)); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, live.length, done]);

  if (step < 0 || step >= live.length) return null;
  const s = live[step];

  return (
    <>
      {/* Click-catcher only. The dim comes from the spotlight's own shadow —
          a second black layer over everything used to dim the highlighted
          element too, so there was never actually a spotlight. */}
      <div className="fixed inset-0 z-[80]" onClick={done} />
      {box && (
        <div className="pointer-events-none fixed z-[81] rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.72)] transition-all duration-200"
             style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }} />
      )}
      {!box && <div className="pointer-events-none fixed inset-0 z-[81] bg-black/70" />}
      <div
        ref={arrowRef}
        className="pointer-events-none fixed z-[83] h-0 w-0 border-y-[7px] border-l-[13px] border-y-transparent border-l-accent"
        style={{ display: box ? undefined : "none" }}
      />
      <div
        ref={cardRef}
        className="fixed z-[82] w-[320px] max-w-[88vw] rounded-2xl border border-white/15 bg-black/95 p-4 shadow-2xl transition-[left,top] duration-200"
        style={box ? undefined : { top: "38%", left: "50%", transform: "translateX(-50%)" }}
      >
        <div className="text-[10px] uppercase tracking-widest text-accent">step {step + 1} of {live.length}</div>
        <div className="mt-1 text-sm text-ink">{s.title}</div>
        <p className="mt-1 text-xs leading-relaxed text-mute">{s.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <button className="text-[10px] text-mute hover:text-ink" onClick={done}>skip — don&apos;t show again</button>
          <div className="flex gap-2">
            {step > 0 && <button className="btn-ghost text-xs" onClick={() => setStep(step - 1)}>back</button>}
            <button className="btn-glow text-xs" onClick={() => (step + 1 < live.length ? setStep(step + 1) : done())}>
              {step + 1 < live.length ? "next" : "finish"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function HelpButton() {
  const { tips, setTips } = useTips();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button className="btn-ghost px-2 py-1 text-xs" title="help" onClick={() => setOpen(!open)}>?</button>
      {open && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-52 rounded-xl border border-white/15 bg-black/95 p-2 text-xs shadow-xl">
          <button className="block w-full rounded-lg px-2 py-1.5 text-left text-ink hover:bg-white/5"
                  onClick={() => { setOpen(false); window.dispatchEvent(new Event("mmm:start-tour")); }}>
            ▶ replay the guided tour
          </button>
          <button className="block w-full rounded-lg px-2 py-1.5 text-left text-ink hover:bg-white/5"
                  onClick={() => { setTips(!tips); setOpen(false); }}>
            {tips ? "◻ turn hover tips off" : "◼ turn hover tips on"}
          </button>
        </div>
      )}
    </span>
  );
}
