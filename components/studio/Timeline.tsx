"use client";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Transport } from "./Transport";
import { capture, release } from "./Transport";
import Help, { Field } from "./Help";
import InsertPicker from "./InsertPicker";
import Lasso from "./Lasso";

// The canvas. One preview, one timeline, one export.
//
// Deliberately not a general NLE. It does the job a sponsor promo needs: put
// stills in order, give them motion and a fade, lay music under it, and get a
// file out. Everything lives in one JSON doc so saving is a single write.

export type Clip = {
  id: string;
  genId?: number;
  url: string;
  kind?: "image" | "video";           // a still, or a clip made from one
  // WHERE it sits. Until layers existed a clip's position was implied by its
  // order in the array — a filmstrip, one shot after another. That cannot
  // express "this title sits over that shot", so position is now explicit.
  start: number;                      // absolute seconds from the top
  track: number;                      // 0 is the base picture, higher is on top
  dur: number;                        // seconds on screen
  // How far INTO the source the clip begins. Trimming the head of a video has
  // to move the in-point too, or the handle slides while the picture stays put
  // and the last frames fall off the end instead of the first.
  trimIn?: number;
  // A shot that has been ORDERED but not rendered yet. It holds its place on
  // the timeline while the pool works, so the edit around it can carry on
  // being built. `genId` is the row in studio_gens we poll.
  pending?: number;
  // Grok lives outside the pool, so its job id is a string from xAI rather
  // than a row in studio_gens. Two fields instead of one union keeps the
  // polling for each lane obviously separate.
  pendingGrok?: string;
  // RunPod jobs need their lane remembered — the status URL differs per lane.
  // `chain` is what to do NEXT once this job lands. Making a still and then
  // moving it is two RunPod jobs, and the join works because RunPod hands back
  // a PUBLIC url — so the second job can fetch the first one's output directly,
  // with nothing re-uploaded and nothing round-tripped through here.
  pendingPod?: {
    id: string; lane: string;
    chain?: { lane: string; prompt: string; duration: number; size?: string; audio?: string };
  };
  failed?: string;
  // Clips that move together. Attach a sting to the shot it belongs to and
  // sliding the shot takes the sound with it.
  group?: string;
  zoomFrom: number; zoomTo: number;   // 1 = fit, 1.2 = 20% in
  panX: number; panY: number;         // -1..1, drift across the frame
  ease: [number, number, number, number]; // cubic bezier control points
  fadeIn: number; fadeOut: number;    // seconds
  text: string; textSize: number;
};

/**
 * A sound sitting at a point in time — an effect, a sting, a generated bed.
 *
 * Separate from the single `audioName` music bed, which is one file under the
 * whole piece. These are placed: they start where you put them and stop when
 * they are done.
 */
export type AudioClip = {
  id: string;
  url: string;
  name: string;
  start: number;                      // absolute seconds
  dur: number;                        // seconds on the timeline
  trimIn?: number;                    // seconds into the source
  gain: number;                       // 0..1
  kind: "sfx" | "music";
  group?: string;                     // moves with whatever it is attached to
};

/**
 * A MASK drawn round something in the frame, and what to do with it.
 *
 * The lasso is the honest half of "select the subject". SAM and a background
 * remover are both sitting on the NAS, so an auto-select can be added later —
 * but everything downstream of the mask (isolate, knock the background out,
 * invert, dim round it) works the same whether a person or a model drew it.
 * Building the hand path first means the model, when it comes, only has to
 * produce points. Nothing else has to change.
 *
 * Points are stored 0..1 in CANVAS space, not source space, so a mask survives
 * a resize and means the same thing at any export size. It does NOT follow a
 * clip's own zoom or pan drift — that is what real tracking buys you, and this
 * is not it.
 */
export type Fx = {
  id: string;
  clipId: string;                     // the shot it is drawn on
  name: string;                       // "Jay", "the bus", "the sign"
  points: [number, number][];         // 0..1 of width/height
  mode: "isolate" | "cutout" | "invert" | "dim" | "spot";
  feather: number;                    // px of softness at the edge
  enabled: boolean;
};

export type Doc = {
  clips: Clip[];
  fx?: Fx[];
  sounds?: AudioClip[];               // placed sound, over and above the bed
  audioName?: string; audioGain: number;
  tracks?: number;                    // how many picture layers to show
};

/**
 * Bring an older doc forward.
 *
 * Every promo saved before layers has clips with no start and no track, laid
 * end to end. Reading start as 0 would stack the whole promo on one frame, so
 * the old meaning — sequential — is reconstructed by accumulating the durations
 * in array order. Saved work opens exactly as it played.
 */
export function migrateDoc(d: any): Doc {
  const base: Doc = { clips: [], audioGain: 0.8, tracks: 2, ...(d || {}) };
  let acc = 0;
  base.clips = (base.clips || []).map((c: any) => {
    const dur = Number(c?.dur) || 3;
    const start = Number.isFinite(c?.start) ? Number(c.start) : acc;
    // Advance past this clip's END either way, so a doc that somehow mixes
    // old and new clips still lays the old ones after the new ones.
    acc = Math.max(acc, start + dur);
    return { ...c, dur, start, track: Number(c?.track) || 0, trimIn: Number(c?.trimIn) || 0,
             pending: c?.pending || undefined, pendingGrok: c?.pendingGrok || undefined,
             pendingPod: c?.pendingPod || undefined,
             group: c?.group || undefined };
  });
  base.tracks = Math.max(2, base.tracks || 2, ...base.clips.map(c => c.track + 1));
  // Older docs predate placed sound entirely.
  base.fx = Array.isArray(base.fx) ? base.fx.filter((f: any) => Array.isArray(f?.points) && f.points.length > 2) : [];
  base.sounds = Array.isArray(base.sounds) ? base.sounds.map((a: any) => ({
    ...a,
    start: Number(a?.start) || 0,
    dur: Math.max(0.05, Number(a?.dur) || 1),
    gain: Number.isFinite(a?.gain) ? a.gain : 0.9,
    kind: a?.kind === "music" ? "music" : "sfx",
  })) : [];
  return base;
}

export const emptyDoc = (): Doc => ({ clips: [], sounds: [], fx: [], audioGain: 0.8, tracks: 2 });

export const newClip = (
  url: string, genId?: number, kind: "image" | "video" = "image",
  dur?: number, start = 0, track = 0,
): Clip => ({
  id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
  genId, url, kind, start, track, trimIn: 0,
  // A moving clip defaults to its own length; a still gets a sensible hold.
  dur: dur ?? (kind === "video" ? 4.84 : 3),
  // Motion starts OFF. A slow drift is a choice you make per shot, not a
  // default that quietly puts the same lazy push on every promo.
  zoomFrom: 1, zoomTo: 1, panX: 0, panY: 0,
  ease: [0.4, 0, 0.2, 1],
  fadeIn: 0.3, fadeOut: 0.3,
  text: "", textSize: 48,
});

// --- easing ---------------------------------------------------------------

/** Cubic bezier y at x, by sampling. Precise enough for 30fps motion. */
function bezier(p: [number, number, number, number], x: number): number {
  const [x1, y1, x2, y2] = p;
  const cx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const cy = (t: number) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 20; i++) { t = (lo + hi) / 2; if (cx(t) < x) lo = t; else hi = t; }
  return cy(t);
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
};

// --- frame pump -----------------------------------------------------------

/**
 * A 60Hz tick that keeps running when the tab is in the background.
 *
 * requestAnimationFrame stops dead the moment the tab stops being visible, and
 * so does a main-thread setInterval (Chrome throttles it to ~1/sec). Either one
 * means alt-tabbing part way through a 15-second export leaves you with a video
 * that freezes at the moment you looked away — and you don't find out until you
 * play the file back.
 *
 * Timers inside a dedicated worker are not throttled that way, so the worker
 * owns the clock and the main thread just draws when told. Canvas drawing and
 * captureStream both keep working in a hidden tab; only the scheduling was ever
 * the problem.
 */
function makePump(onTick: () => void, fps = 60) {
  const src = `let id=null;onmessage=e=>{if(e.data&&e.data.ms){clearInterval(id);id=setInterval(()=>postMessage(1),e.data.ms);}else{clearInterval(id);id=null;}};`;
  let url: string | null = null;
  let worker: Worker | null = null;
  let fallback: any = null;

  try {
    url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onmessage = () => onTick();
  } catch {
    worker = null;   // no worker (CSP, ancient browser) — degrade, don't die
  }

  return {
    start() {
      if (worker) worker.postMessage({ ms: Math.max(4, Math.round(1000 / fps)) });
      else fallback = setInterval(onTick, Math.max(4, Math.round(1000 / fps)));
    },
    stop() {
      if (worker) worker.postMessage({ stop: true });
      if (fallback) { clearInterval(fallback); fallback = null; }
    },
    dispose() {
      this.stop();
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
    },
  };
}

// --- spline widget --------------------------------------------------------

function SplineEditor({ value, onChange }: { value: Clip["ease"]; onChange: (v: Clip["ease"]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const S = 120;

  const move = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (drag === null || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, ((e as MouseEvent).clientX - r.left) / r.width));
    const y = Math.min(1.4, Math.max(-0.4, 1 - ((e as MouseEvent).clientY - r.top) / r.height));
    const v: Clip["ease"] = [...value] as any;
    if (drag === 0) { v[0] = x; v[1] = y; } else { v[2] = x; v[3] = y; }
    onChange(v);
  }, [drag, value, onChange]);

  useEffect(() => {
    if (drag === null) return;
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move as any);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move as any); window.removeEventListener("mouseup", up); };
  }, [drag, move]);

  const px = (x: number) => x * S;
  const py = (y: number) => S - y * S;
  const path = `M0,${S} C${px(value[0])},${py(value[1])} ${px(value[2])},${py(value[3])} ${S},0`;

  return (
    <div className="flex items-center gap-3">
      <div ref={ref} className="relative rounded-lg border border-[#2a2a3a] bg-[#0b0b0f] shrink-0"
           style={{ width: S, height: S }}>
        <svg width={S} height={S} className="absolute inset-0">
          <line x1="0" y1={S} x2={S} y2="0" stroke="#2a2a3a" strokeDasharray="3 3" />
          <line x1="0" y1={S} x2={px(value[0])} y2={py(value[1])} stroke="#3a3a4a" />
          <line x1={S} y1="0" x2={px(value[2])} y2={py(value[3])} stroke="#3a3a4a" />
          <path d={path} fill="none" stroke="#ff3d6e" strokeWidth="2" />
        </svg>
        {[0, 1].map(i => (
          <button key={i} onMouseDown={() => setDrag(i as 0 | 1)}
            aria-label={`Control point ${i + 1}`}
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[#ff3d6e] cursor-grab active:cursor-grabbing"
            style={{ left: px(value[i * 2]), top: py(value[i * 2 + 1]) }} />
        ))}
      </div>
      <div className="text-xs text-[#8a8aa0] leading-relaxed">
        <div className="mb-2">Drag the two dots to shape how the motion moves.</div>
        <div className="flex flex-wrap gap-1">
          {([["Steady", [0, 0, 1, 1]], ["Ease out", [0, 0, 0.2, 1]],
             ["Ease both", [0.4, 0, 0.2, 1]], ["Snap", [0.9, 0, 1, 1]]] as const).map(([n, v]) => (
            <button key={n} className="pill hover:border-[#ff3d6e]"
              onClick={() => onChange([...v] as any)}>{n}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- main -----------------------------------------------------------------

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

export default function Timeline({
  doc, setDoc, bpm, setBpm, W = 1280, H = 720, transport,
}: {
  // Takes an updater as well as a value: a drop uploads several files in a
  // loop, and `doc` captured before the first await is stale by the second.
  doc: Doc; setDoc: React.Dispatch<React.SetStateAction<Doc>>;
  bpm: number; setBpm: (n: number) => void;
  W?: number; H?: number;
  // Written to on every frame so the floating panels can read the playhead
  // without a React render crossing the tree. See Transport.tsx.
  transport?: Transport;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const imgs = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());
  const clock = useRef<{ t0: number; at: number } | null>(null);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  // draw() reads this rather than `playing` so the callback (and every frame)
  // isn't rebuilt on transport changes.
  const playingRef = useRef(false);
  // Recording runs the transport without touching React state, so it flips this
  // instead. Without it every video clip would be seek-per-frame during the
  // export and judder its way into the file.
  const recordingRef = useRef(false);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  const rolling = () => playingRef.current || recordingRef.current;
  const [sel, setSel] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  // Magnetic edges are separate from the beat grid on purpose: they answer
  // different questions ("butt this against that" vs "land this on the music")
  // and there are real edits where you want one without the other.
  const [magnet, setMagnet] = useState(true);
  // View zoom, in pixels per second. Null means "fit the whole promo to the
  // panel" — the old behaviour, and still the default. A real number means the
  // operator has dialled in, and the lane scrolls.
  const [pps, setPps] = useState<number | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const [laneW, setLaneW] = useState(900);
  // The pollers run on an interval and would otherwise close over whatever doc
  // existed when the interval was created — so a render finishing while you
  // were editing would write its result on top of a stale document and quietly
  // undo the edit. They read through this instead.
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; }, [doc]);

  const clips = doc.clips;
  // With layers, length is where the last clip ENDS. Summing durations would
  // count a title and the shot under it as two separate stretches of time.
  const total = useMemo(
    () => clips.reduce((a, c) => Math.max(a, c.start + c.dur), 0), [clips]);
  const trackCount = Math.max(2, doc.tracks || 2, ...clips.map(c => c.track + 1));
  const beat = 60 / Math.max(20, bpm);

  // A ref, not state: pointermove can arrive before a state update has
  // committed, and a drag that drops its first few moves feels broken.
  const dragClip = useRef<
    { id: string; mode: "move"; grabT: number } |
    { id: string; mode: "in" | "out"; start0: number; dur0: number; trim0: number } | null>(null);
  const MIN_DUR = 0.1;
  // Where the right-click landed: the time under the cursor and which row.
  const [menu, setMenu] = useState<{ x: number; y: number; t: number; track: number } | null>(null);
  const [selSound, setSelSound] = useState<string | null>(null);
  const dragSound = useRef<{ id: string; grabT: number } | null>(null);

  const patchSound = (id: string, p: Partial<AudioClip>) =>
    setDoc({ ...doc, sounds: (doc.sounds || []).map(a => (a.id === id ? { ...a, ...p } : a)) });

  // What the insert menu is currently asking for, if anything.
  const [picker, setPicker] = useState<null | { kind: "sfx" | "stock"; t: number; track: number }>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * Ask the sound bank's AI for something that fits HERE.
   *
   * It is told what is on screen around the insert point, so the answer is
   * about this moment rather than the promo in general. The top pick lands at
   * the playhead; the rest stay in the picker so a different choice is one
   * click away — his rule: AI picks first, you overrule it.
   */
  async function aiSoundAt(t: number) {
    setBusy("Asking for a sound…");
    const around = clips
      .filter(c => t >= c.start - 2 && t <= c.start + c.dur + 2)
      .map(c => ({ t: c.start, what: c.text?.trim() || (c.kind === "video" ? "a moving shot" : "a still") }));
    const r = await fetch("/api/admin/studio/sfx", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: `a moment ${t.toFixed(1)}s into a sponsor promo`, seconds: Math.max(total, t + 1), beats: around }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error || !r?.picks?.length) { setExporting(r?.error || "No sound came back."); return; }
    const top = r.picks[0];
    addSound({ url: top.url, name: top.label, start: t, dur: 2, gain: 0.9, kind: "sfx" });
    // Leave the picker open on the alternatives.
    setPicker({ kind: "sfx", t, track: -1 });
  }

  // --- generate at the playhead -------------------------------------------
  //
  // Order a shot for a SPOT rather than for the gallery. A placeholder goes
  // down immediately at the time you right-clicked, so the cut keeps its shape
  // while the pool renders, and the picture drops into that exact hole when it
  // lands.
  const [ask, setAsk] = useState<null | { t: number; track: number }>(null);
  const [askClip, setAskClip] = useState<null | { t: number; track: number }>(null);

  // --- multi-select and attach --------------------------------------------
  //
  // `sel` stays the ONE clip the inspector talks about — shot settings only
  // make sense for a single shot. `extra` is everything else shift-clicked
  // alongside it, and together they are what Attach acts on.
  const [extra, setExtra] = useState<string[]>([]);
  // Lassoing is a mode: the preview stops being a preview and becomes a
  // drawing surface, so it is explicit and always has a way out.
  const [lassoFor, setLassoFor] = useState<string | null>(null);
  const fxList = doc.fx || [];

  const patchFx = (id: string, p: Partial<Fx>) =>
    setDoc({ ...doc, fx: fxList.map(f => (f.id === id ? { ...f, ...p } : f)) });

  function addFx(clipId: string, points: [number, number][]) {
    const f: Fx = {
      id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      clipId, name: "", points,
      // Isolate is the safe default: it shows you exactly what you selected
      // without throwing anything away.
      mode: "isolate", feather: 2, enabled: true,
    };
    setDoc({ ...doc, fx: [...fxList, f] });
  }
  const chosen = useCallback(() => (sel ? [sel, ...extra] : extra), [sel, extra]);

  /**
   * Everything that must move when `id` moves: itself, plus every clip and
   * sound sharing its group.
   */
  const moveSet = useCallback((id: string) => {
    const g = clips.find(c => c.id === id)?.group
           || (doc.sounds || []).find(a => a.id === id)?.group;
    if (!g) return { clips: [id], sounds: [id] };
    return {
      clips: clips.filter(c => c.group === g).map(c => c.id).concat(id),
      sounds: (doc.sounds || []).filter(a => a.group === g).map(a => a.id).concat(id),
    };
  }, [clips, doc.sounds]);

  /** Link the current selection so they travel together. */
  function attachSelection() {
    const ids = chosen();
    if (ids.length < 2) { setExporting("Shift-click a second clip first, then Attach."); return; }
    const g = `g${Date.now().toString(36)}`;
    setDoc({
      ...doc,
      clips: clips.map(c => ids.includes(c.id) ? { ...c, group: g } : c),
      sounds: (doc.sounds || []).map(a => ids.includes(a.id) ? { ...a, group: g } : a),
    });
  }

  /**
   * Break the link.
   *
   * Clears the WHOLE group, not just what happens to be selected. Detaching is
   * mutual — releasing one side while the other still claims to be attached
   * leaves a group of one, which reads as "still linked" and is a lie.
   */
  function detachSelection() {
    const ids = chosen();
    const gone = new Set(
      clips.filter(c => ids.includes(c.id)).map(c => c.group)
        .concat((doc.sounds || []).filter(a => ids.includes(a.id)).map(a => a.group))
        .filter(Boolean) as string[]);
    if (!gone.size) return;
    setDoc({
      ...doc,
      clips: clips.map(c => c.group && gone.has(c.group) ? { ...c, group: undefined } : c),
      sounds: (doc.sounds || []).map(a => a.group && gone.has(a.group) ? { ...a, group: undefined } : a),
    });
  }

  /** Slide a clip and everything attached to it by the same delta. */
  function slideGroup(id: string, newStart: number) {
    const c = clips.find(k => k.id === id);
    const a0 = (doc.sounds || []).find(k => k.id === id);
    const from = c ? c.start : a0?.start ?? 0;
    const d = newStart - from;
    if (!d) return;
    const set = moveSet(id);
    setDoc({
      ...doc,
      clips: clips.map(k => set.clips.includes(k.id)
        ? { ...k, start: Math.max(0, k.id === id ? newStart : k.start + d) } : k),
      sounds: (doc.sounds || []).map(k => set.sounds.includes(k.id)
        ? { ...k, start: Math.max(0, k.id === id ? newStart : k.start + d) } : k),
    });
  }

  async function generateAt(t: number, track: number, prompt: string, look: string, dur: number) {
    setBusy("Queueing the shot…");
    const r = await fetch("/api/admin/studio/generate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, look, size: "wide" }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    const gen = r?.gens?.[0];
    if (r?.error || !gen || gen.status === "failed") {
      setExporting(r?.error || gen?.error || "Couldn't queue that shot.");
      return;
    }
    const c = newClip("", undefined, "image", dur, t, Math.max(0, track));
    setDoc({ ...doc, clips: [...clips, { ...c, pending: gen.id }] });
    setSel(c.id);
  }

  /**
   * Order a clip from Grok.
   *
   * Separate from generateAt on purpose. This one spends money, so it does not
   * share a code path with the free lanes where it could ever be reached by
   * accident.
   */
  async function grokAt(t: number, track: number, prompt: string, dur: number) {
    setBusy("Sending it to Grok…");
    const r = await fetch("/api/admin/studio/grok", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error || !r?.id) { setExporting(r?.error || "Grok didn't take it."); return; }
    const c = newClip("", undefined, "video", dur, t, Math.max(0, track));
    setDoc({ ...doc, clips: [...clips, { ...c, pendingGrok: r.id }] });
    setSel(c.id);
  }

  // Grok jobs poll xAI directly, one at a time — its status endpoint takes a
  // single id, unlike the pool's batch poll.
  const grokIds = clips.filter(c => c.pendingGrok).map(c => c.pendingGrok!).join(",");
  useEffect(() => {
    if (!grokIds) return;
    let dead = false;
    const tick = async () => {
      for (const id of grokIds.split(",")) {
        const j = await fetch(`/api/admin/studio/grok?id=${encodeURIComponent(id)}`)
          .then(r => r.json()).catch(() => null);
        if (dead || !j) continue;
        const cur = docRef.current;
        if (j.status === "done" && j.url) {
          setDoc({ ...cur, clips: cur.clips.map(c => c.pendingGrok === id
            ? { ...c, url: j.url, kind: "video" as const, dur: j.seconds || c.dur, pendingGrok: undefined } : c) });
        } else if (j.status === "failed") {
          setDoc({ ...cur, clips: cur.clips.map(c => c.pendingGrok === id
            ? { ...c, pendingGrok: undefined, failed: j.error || "Grok failed" } : c) });
        }
      }
    };
    const iv = setInterval(tick, 5000);
    tick();
    return () => { dead = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grokIds]);

  /**
   * Order from RunPod — the lane that works with every machine at home off.
   *
   * VIDU animates a still, so it needs one it can FETCH. Ours live behind the
   * studio's auth, which RunPod cannot see, so the frame goes up as an inline
   * data URI rather than a link it would fail to open.
   */
  async function podAt(t: number, track: number, lane: "vidu" | "wan25" | "wan26",
                       prompt: string, dur: number, image?: string, size?: string,
                       audio?: string, chain?: NonNullable<Clip["pendingPod"]>["chain"]) {
    setBusy(`Sending it to ${lane === "vidu" ? "VIDU" : lane === "wan25" ? "WAN 2.5" : "WAN 2.6"}…`);
    const r = await fetch("/api/admin/studio/runpod", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lane, prompt, image, duration: dur, size, audio }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error || !r?.id) { setExporting(r?.error || "RunPod didn't take it."); return; }
    const kind = lane === "wan26" ? "image" : "video";
    const c = newClip("", undefined, kind as any, dur || 3, t, Math.max(0, track));
    setDoc({ ...docRef.current, clips: [...docRef.current.clips,
      { ...c, pendingPod: { id: r.id, lane, chain } }] });
    setSel(c.id);
  }

  const podKeys = clips.filter(c => c.pendingPod)
    .map(c => `${c.pendingPod!.lane}:${c.pendingPod!.id}`).join(",");
  useEffect(() => {
    if (!podKeys) return;
    let dead = false;
    const tick = async () => {
      for (const pair of podKeys.split(",")) {
        const [lane, ...rest] = pair.split(":");
        const id = rest.join(":");
        const j = await fetch(`/api/admin/studio/runpod?lane=${lane}&id=${encodeURIComponent(id)}`)
          .then(r => r.json()).catch(() => null);
        if (dead || !j) continue;
        const cur = docRef.current;
        const hit = (c: Clip) => c.pendingPod?.id === id;
        if (j.status === "done" && j.url) {
          const clip = cur.clips.find(hit);
          const chain = clip?.pendingPod?.chain;
          if (chain) {
            // The still is done — now move it. RunPod's own url goes straight
            // in as the image, which is the whole reason these two join
            // cleanly: no download, no re-upload, no public hosting of ours.
            setBusy("Still done — animating it…");
            const nx = await fetch("/api/admin/studio/runpod", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({
                lane: chain.lane, prompt: chain.prompt, image: j.url,
                duration: chain.duration, size: chain.size, audio: chain.audio,
              }),
            }).then(r => r.json()).catch(e => ({ error: String(e) }));
            setBusy(null);
            const now = docRef.current;
            if (nx?.error || !nx?.id) {
              // Keep the still rather than losing both halves of the job.
              setDoc({ ...now, clips: now.clips.map(c => hit(c)
                ? { ...c, url: j.url, pendingPod: undefined,
                    failed: `still made, but animating it failed: ${nx?.error || "no job id"}` } : c) });
            } else {
              setDoc({ ...now, clips: now.clips.map(c => hit(c)
                ? { ...c, kind: "video" as const, dur: chain.duration,
                    pendingPod: { id: nx.id, lane: chain.lane } } : c) });
            }
            continue;
          }
          setDoc({ ...cur, clips: cur.clips.map(c => hit(c)
            ? { ...c, url: j.url, dur: j.seconds || c.dur, pendingPod: undefined } : c) });
        } else if (j.status === "failed") {
          setDoc({ ...cur, clips: cur.clips.map(c => hit(c)
            ? { ...c, pendingPod: undefined, failed: j.error || "RunPod failed" } : c) });
        }
      }
    };
    const iv = setInterval(tick, 6000);
    tick();
    return () => { dead = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podKeys]);

  /**
   * The frame under the playhead, as a data URI.
   *
   * VIDU needs a still it can reach; this is the one we can always produce,
   * because it is literally what the canvas is showing right now.
   */
  function frameDataUrl(): string | undefined {
    try { return canvas.current?.toDataURL("image/jpeg", 0.92); } catch { return undefined; }
  }

  // Poll only while something is actually cooking. Terminal states are never
  // re-polled — the pool prunes its history and a finished job would start
  // reporting as missing.
  const pendingIds = clips.filter(c => c.pending).map(c => c.pending!).join(",");
  useEffect(() => {
    if (!pendingIds) return;
    let dead = false;
    const tick = async () => {
      const r = await fetch(`/api/admin/studio/status?ids=${pendingIds}`)
        .then(r => r.json()).catch(() => null);
      if (dead || !r?.gens) return;
      const byId = new Map(r.gens.map((g: any) => [g.id, g]));
      const cur = docRef.current;
      setDoc({
        ...cur,
        clips: cur.clips.map(c => {
          const g: any = c.pending ? byId.get(c.pending) : null;
          if (!g) return c;
          if (g.status === "done" && g.urls?.[0]) {
            return { ...c, url: g.urls[0], pending: undefined, failed: undefined };
          }
          if (g.status === "failed") {
            return { ...c, pending: undefined, failed: g.error || "render failed" };
          }
          return c;
        }),
      });
    };
    const id = setInterval(tick, 2500);
    tick();
    return () => { dead = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds]);

  /** Put a sound on the timeline at `t`. */
  function addSound(a: Omit<AudioClip, "id">) {
    const id = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    setDoc({ ...doc, sounds: [...(doc.sounds || []), { ...a, id }] });
    setSelSound(id);
    return id;
  }
  // --- drag a file straight onto the lane -----------------------------------
  //
  // Same gesture as right-click "Insert here", minus the picker: the file lands
  // where you let go of it, on the track you dropped it on. It is uploaded to
  // the stock shelf under "Dropped" on the way through, so it is a real file on
  // the NAS afterwards and not a blob that dies with the tab.
  const [dropping, setDropping] = useState<number | null>(null);

  async function dropFilesAt(files: File[], t: number, track: number) {
    let at = t;
    for (const f of files) {
      const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(f.name);
      const isImage = /\.(png|jpe?g|webp)$/i.test(f.name);
      const isAudio = /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name);
      if (!isVideo && !isImage && !isAudio) {
        setExporting(`${f.name} isn't a picture, a clip or a sound.`);
        continue;
      }

      const fd = new FormData();
      fd.append("file", f);
      fd.append("folder", "Dropped");
      const r = await fetch("/api/admin/studio/stock", { method: "POST", body: fd })
        .then(r => r.json()).catch(() => null);
      if (!r?.url) { setExporting(r?.error || `Couldn't take ${f.name}.`); continue; }

      if (isAudio) {
        addSound({ url: r.url, name: r.name || f.name, start: at, dur: 4, gain: 0.9, kind: "sfx" });
      } else {
        const dur = isVideo ? 4.84 : 3;
        setDoc(d => ({
          ...d,
          clips: [...d.clips, newClip(r.url, undefined, isVideo ? "video" : "image", dur, at, Math.max(0, track))],
        }));
        // Several files at once lay end to end rather than stacking on one spot.
        at += dur;
      }
    }
  }

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    // Any click elsewhere, any scroll, or Escape dismisses it.
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [menu]);

  /** The time under a mouse event, in the lane's own coordinates. */
  const timeAtEvent = (clientX: number) => {
    const r = laneRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, (clientX - r.left + (laneRef.current?.scrollLeft || 0)) / scale);
  };
  /** Longest a clip can be — a video cannot outrun its own file. */
  const sourceLen = (c: Clip) => {
    const m = imgs.current.get(c.url);
    return m instanceof HTMLVideoElement && m.duration ? m.duration : Infinity;
  };
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Watch the lane's width so Fit stays fit when the window changes.
  useEffect(() => {
    const el = laneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setLaneW(el.clientWidth || 900));
    ro.observe(el);
    setLaneW(el.clientWidth || 900);
    return () => ro.disconnect();
  }, []);
  const selected = clips.find(c => c.id === sel) || null;

  // Keep the shared transport current. Mutating an object rather than lifting
  // state is the whole point: the docks re-read it on their own frame and
  // nothing above this component re-renders while the promo plays.
  if (transport) {
    transport.time = time; transport.playing = playing;
    transport.total = total; transport.beat = beat; transport.bpm = bpm;
  }
  useEffect(() => {
    if (!transport) return;
    transport.canvas = canvas.current;
    transport.seek = (t: number) => setTime(Math.max(0, Math.min(total, t)));
    transport.toggle = () => setPlaying(p => !p);
  }, [transport, total]);

  const patch = (id: string, p: Partial<Clip>) =>
    setDoc({ ...doc, clips: clips.map(c => (c.id === id ? { ...c, ...p } : c)) });

  // Preload every image once. Drawing straight from a not-yet-decoded <img>
  // gives a blank frame, which during an export is a black hole in the file.
  // The bump on load matters: nothing else changes when a decode finishes, so
  // without it a slow shot sits there black until you happen to touch a slider.
  const [decoded, setDecoded] = useState(0);
  useEffect(() => {
    for (const c of clips) {
      if (imgs.current.has(c.url)) continue;
      if (c.kind === "video") {
        // A <video> is a valid drawImage source. Muted + playsInline so it can
        // start without a gesture; the timeline's own audio bed is the sound.
        const v = document.createElement("video");
        v.crossOrigin = "anonymous";
        v.muted = true;
        v.playsInline = true;
        v.preload = "auto";
        v.onloadeddata = () => setDecoded(n => n + 1);
        v.src = c.url;
        v.load();
        imgs.current.set(c.url, v);
      } else {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => setDecoded(n => n + 1);
        im.src = c.url;
        imgs.current.set(c.url, im);
      }
    }
  }, [clips]);

  /** Natural pixel size of either source type. */
  const srcSize = (m: any) => m instanceof HTMLVideoElement
    ? { w: m.videoWidth, h: m.videoHeight }
    : { w: m?.naturalWidth || 0, h: m?.naturalHeight || 0 };

  const srcReady = (m: any) => m instanceof HTMLVideoElement
    ? m.readyState >= 2
    : !!(m?.complete && m.naturalWidth);

  /**
   * Everything on screen at t, in the order it should be painted.
   *
   * Returns a list now rather than one clip: layers mean several things can be
   * live at once, and the base picture has to go down before the title over it.
   */
  const at = useCallback((t: number) => {
    return clips
      .filter(c => t >= c.start && t < c.start + c.dur)
      .sort((a, b) => a.track - b.track || a.start - b.start)
      .map(c => {
        const local = t - c.start;
        return { clip: c, local, p: c.dur > 0 ? local / c.dur : 0 };
      });
  }, [clips]);

  /** The topmost clip at t — what the inspector should be talking about. */
  const topAt = useCallback((t: number) => {
    const live = at(t);
    return live.length ? live[live.length - 1] : null;
  }, [at]);

  const draw = useCallback((t: number, ctx?: CanvasRenderingContext2D) => {
    const c2 = ctx || canvas.current?.getContext("2d");
    if (!c2) return;
    c2.fillStyle = "#000";
    c2.fillRect(0, 0, W, H);

    const live = at(t);
    if (!live.length) return;

    // Park any video that is NOT live right now, so background decoding does
    // not fight the ones on screen. With layers there can be more than one.
    const liveUrls = new Set(live.map(l => l.clip.url));
    for (const [u, m] of imgs.current) {
      if (!liveUrls.has(u) && m instanceof HTMLVideoElement && !m.paused) m.pause();
    }

    // Bottom layer first: at() hands them back in paint order.
    for (const { clip, local, p } of live) {
    const im = imgs.current.get(clip.url);
    if (!im) continue;

    if (im instanceof HTMLVideoElement) {
      // Play from the in-point, not from the head of the file.
      const inAt = clip.trimIn || 0;
      const want = Math.min(inAt + local, im.duration || inAt + local);
      if (rolling()) {
        // Let it run and only correct real drift — seeking every frame stalls
        // the decoder and the picture judders.
        if (im.paused) im.play().catch(() => {});
        if (Math.abs(im.currentTime - want) > 0.25) im.currentTime = want;
      } else {
        if (!im.paused) im.pause();
        if (Math.abs(im.currentTime - want) > 0.03) im.currentTime = want;
      }
    }

    if (!srcReady(im)) continue;
    const nat = srcSize(im);
    if (!nat.w || !nat.h) continue;

    const e = bezier(clip.ease, Math.min(1, Math.max(0, p)));
    const zoom = clip.zoomFrom + (clip.zoomTo - clip.zoomFrom) * e;

    // Cover-fit, then scale by zoom, then drift. Cover means no letterbox bars
    // in a promo, which is what a sponsor expects to see.
    const scale = Math.max(W / nat.w, H / nat.h) * zoom;
    const dw = nat.w * scale, dh = nat.h * scale;
    const slackX = Math.max(0, dw - W) / 2, slackY = Math.max(0, dh - H) / 2;
    const dx = (W - dw) / 2 + clip.panX * slackX * (e * 2 - 1);
    const dy = (H - dh) / 2 + clip.panY * slackY * (e * 2 - 1);

    let alpha = 1;
    if (clip.fadeIn > 0 && local < clip.fadeIn) alpha = local / clip.fadeIn;
    if (clip.fadeOut > 0 && local > clip.dur - clip.fadeOut) {
      alpha = Math.min(alpha, Math.max(0, (clip.dur - local) / clip.fadeOut));
    }

    c2.save();
    c2.globalAlpha = Math.min(1, Math.max(0, alpha));

    // Any lasso drawn on this shot decides how it lands.
    const masks = (doc.fx || []).filter(f => f.clipId === clip.id && f.enabled && f.points.length > 2);
    const trace = (f: Fx) => {
      c2.beginPath();
      f.points.forEach(([px, py], i) => {
        const X = px * W, Y = py * H;
        i ? c2.lineTo(X, Y) : c2.moveTo(X, Y);
      });
      c2.closePath();
    };

    if (!masks.length) {
      c2.drawImage(im, dx, dy, dw, dh);
    } else {
      const f = masks[0];   // one mask per shot for now — see the inspector
      // A soft edge is a blur on the clip boundary. Cheap, and enough to stop
      // a hand-drawn lasso reading as a cut-out from a magazine.
      if (f.feather > 0) c2.filter = `blur(${f.feather}px)`;

      if (f.mode === "isolate" || f.mode === "cutout") {
        // Only what is inside the lasso. On a layer above the base that means
        // the shot under it shows through everywhere else.
        c2.save(); trace(f); c2.clip();
        c2.filter = "none";
        c2.drawImage(im, dx, dy, dw, dh);
        c2.restore();
      } else if (f.mode === "invert") {
        // Everything EXCEPT the subject. Even-odd against a full-frame rect is
        // what turns the path into a hole.
        c2.save();
        c2.beginPath();
        c2.rect(0, 0, W, H);
        f.points.forEach(([px, py], i) => {
          const X = px * W, Y = py * H;
          i ? c2.lineTo(X, Y) : c2.moveTo(X, Y);
        });
        c2.closePath();
        c2.clip("evenodd");
        c2.filter = "none";
        c2.drawImage(im, dx, dy, dw, dh);
        c2.restore();
      } else {
        // dim / spot: the whole shot, then knock the surroundings back so the
        // eye goes where you drew.
        c2.filter = "none";
        c2.drawImage(im, dx, dy, dw, dh);
        c2.save();
        c2.beginPath();
        c2.rect(0, 0, W, H);
        f.points.forEach(([px, py], i) => {
          const X = px * W, Y = py * H;
          i ? c2.lineTo(X, Y) : c2.moveTo(X, Y);
        });
        c2.closePath();
        c2.clip("evenodd");
        c2.fillStyle = f.mode === "spot" ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.45)";
        c2.fillRect(0, 0, W, H);
        c2.restore();
      }
      c2.filter = "none";
    }

    if (clip.text.trim()) {
      const size = clip.textSize;
      c2.font = `900 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
      c2.textAlign = "center";
      c2.textBaseline = "bottom";
      const lines = clip.text.split("\n");
      lines.forEach((line, i) => {
        const y = H - 60 - (lines.length - 1 - i) * size * 1.15;
        c2.lineWidth = Math.max(4, size / 8);
        c2.strokeStyle = "rgba(0,0,0,.75)";
        c2.strokeText(line, W / 2, y);
        c2.fillStyle = "#fff";
        c2.fillText(line, W / 2, y);
      });
    }
    c2.restore();
    }   // next layer
  }, [at, W, H, doc.fx]);

  useEffect(() => { draw(time); }, [draw, time, doc, decoded]);

  // Playback. When there's music the audio element is the clock — drifting
  // pictures against a track is exactly what nobody wants in a promo.
  useEffect(() => {
    if (!playing) { clock.current = null; stopScheduled(); return; }
    clock.current = { t0: performance.now(), at: time };
    const a = audioEl.current;
    if (a && audioUrl) { a.currentTime = Math.min(time, a.duration || time); a.play().catch(() => {}); }
    // Placed sound is scheduled once, from wherever the playhead is.
    const g = audioGraph(true);
    if (g?.ctx.state === "suspended") g.ctx.resume().catch(() => {});
    scheduleSounds(time);

    const pump = makePump(() => {
      let t: number;
      if (a && audioUrl && !a.paused) t = a.currentTime;
      else t = clock.current!.at + (performance.now() - clock.current!.t0) / 1000;
      if (t >= total) { setTime(total); setPlaying(false); a?.pause(); stopScheduled(); pump.stop(); return; }
      setTime(t);
    });
    pump.start();

    return () => { pump.dispose(); a?.pause(); stopScheduled(); };
    // `time` is the seek position at the moment play started; re-running on
    // every frame's setTime would restart the clock forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, audioUrl, total]);

  const scrubTo = (clientX: number) => {
    const r = rulerRef.current?.getBoundingClientRect();
    if (!r || !total) return;
    // Pixels, not a fraction of the ruler: when zoomed in the ruler is wider
    // than the window and part of it is scrolled out of view.
    let t = (clientX - r.left) / scale;
    if (snap) t = Math.round(t / beat) * beat;
    setTime(Math.min(total, Math.max(0, t)));
  };

  // One audio graph for the life of the editor: element -> gain -> speakers.
  // Built on first use because a context created before a user gesture starts
  // suspended. The same gain node feeds the export, so what you hear while
  // scrubbing is what lands in the file.
  //
  // Now a small mixer rather than a single chain:
  //
  //     music bed  -> bedGain  ┐
  //     sound clip -> its gain ┼-> master -> speakers (and the export tap)
  //
  // Everything meets at `master`, so the export taps one node and gets the
  // whole mix — bed, effects, generated stings — instead of just the bed.
  const graphRef = useRef<{ ctx: AudioContext; bed: GainNode | null; master: GainNode } | null>(null);
  const audioGraph = useCallback((force = false) => {
    if (!graphRef.current) {
      // The context is needed for placed sound even with no music bed at all,
      // so it is no longer gated on there being a bed.
      if (!force && !audioUrl && !(doc.sounds || []).length) return null;
      try {
        const ctx = new AudioContext();
        const master = ctx.createGain();
        master.connect(ctx.destination);
        graphRef.current = { ctx, bed: null, master };
      } catch { return null; }
    }
    const g = graphRef.current;
    // Adopt the bed element the first time there is one. createMediaElementSource
    // may only ever be called once per element, so this is guarded.
    if (g && !g.bed && audioEl.current && audioUrl) {
      try {
        const src = g.ctx.createMediaElementSource(audioEl.current);
        const bed = g.ctx.createGain();
        src.connect(bed); bed.connect(g.master);
        g.bed = bed;
      } catch { /* already adopted, or blocked — the bed still plays on its own */ }
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, doc.sounds]);

  // Keep the level the slider promises, in playback as well as export.
  useEffect(() => {
    const g = audioGraph();
    if (g?.bed) g.bed.gain.value = doc.audioGain;
    else if (audioEl.current) audioEl.current.volume = Math.min(1, Math.max(0, doc.audioGain));
  }, [doc.audioGain, audioGraph]);

  function addAudio(file: File) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const u = URL.createObjectURL(file);
    setAudioUrl(u);
    setDoc({ ...doc, audioName: file.name });
  }

  function fitToBeats() {
    if (!clips.length) return;
    // Both the length AND the position go to the grid. Rounding durations alone
    // used to be enough when clips were a filmstrip; now that each one carries
    // its own start, quantising only the length just slides the gaps around.
    setDoc({
      ...doc,
      clips: clips.map(c => ({
        ...c,
        dur: Math.max(beat, Math.round(c.dur / beat) * beat),
        start: Math.max(0, Math.round(c.start / beat) * beat),
      })),
    });
  }

  /**
   * Nudge a clip one slot earlier or later among its own track's neighbours.
   *
   * Swapping array positions meant something when order WAS position. It no
   * longer is, so this swaps the two clips' places in time instead — which is
   * what the button always looked like it did.
   */
  function move(id: string, dir: -1 | 1) {
    const c = clips.find(k => k.id === id);
    if (!c) return;
    const lane = clips.filter(k => k.track === c.track).sort((a, b) => a.start - b.start);
    const i = lane.findIndex(k => k.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lane.length) return;
    const other = lane[j];
    // Keep both butted against each other rather than leaving a hole.
    const first = dir === -1 ? c : other, second = dir === -1 ? other : c;
    const from = Math.min(c.start, other.start);
    const moved = new Map([[first.id, from], [second.id, from + first.dur]]);
    setDoc({ ...doc, clips: clips.map(k => moved.has(k.id) ? { ...k, start: moved.get(k.id)! } : k) });
  }

  /** Record the canvas in real time. Plays the piece once and captures it. */
  async function exportVideo() {
    if (!clips.length) { setExporting("Add a shot first."); return; }

    // Recording is real time and one-shot — a picture that decodes halfway
    // through is a black stretch you only find after the file is written.
    const pending = clips
      .map(c => imgs.current.get(c.url))
      .filter(m => m && !srcReady(m)) as (HTMLImageElement | HTMLVideoElement)[];
    if (pending.length) {
      setExporting(`Waiting on ${pending.length} shot${pending.length > 1 ? "s" : ""} to load…`);
      await Promise.all(pending.map(m => new Promise<void>(res => {
        // A video is ready at loadeddata, not onload; waiting on the wrong
        // event here would hang the export until the safety timeout.
        const done = () => res();
        if (m instanceof HTMLVideoElement) {
          const prev = m.onloadeddata;
          m.onloadeddata = e => { (prev as any)?.call(m, e); done(); };
        } else {
          const prev = m.onload;
          m.onload = e => { (prev as any)?.call(m, e); done(); };
        }
        m.onerror = done;
        // Never block the export forever on one bad file.
        setTimeout(done, 15000);
      })));
    }

    const cv = canvas.current!;
    const fps = 30;
    const stream = cv.captureStream(fps);

    // Tap the persistent graph rather than building a new one. An element can
    // only be adopted by createMediaElementSource once, and tearing the context
    // down afterwards would leave every later playback silent.
    let audioNote = "";
    const graph = audioGraph();
    if (graph) {
      try {
        const dest = graph.ctx.createMediaStreamDestination();
        graph.master.connect(dest);   // the whole mix, not just the bed

        if (graph.ctx.state === "suspended") {
          // resume() only settles once the page has user activation. Awaiting
          // it bare hangs the whole export forever with no message and no
          // error — a dead button. Time it out and ship the picture instead.
          const resumed = await Promise.race([
            graph.ctx.resume().then(() => true).catch(() => false),
            new Promise<boolean>(r => setTimeout(() => r(false), 1500)),
          ]);
          if (!resumed) {
            audioNote = " (no sound — the browser wouldn't start audio; click Play once, then export)";
          }
        }
        // Only carry the audio track if it can actually produce sound.
        if (!audioNote) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch {
        audioNote = " (no sound — the browser blocked the audio track)";
      }
    }

    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find(m => (window as any).MediaRecorder?.isTypeSupported?.(m));
    if (!mime) { setExporting("This browser can't record video. Use Chrome or Edge."); return; }

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: "video/webm" })); });

    setExporting("Recording — the promo plays once, in real time. You can switch tabs; it keeps going.");
    setTime(0);
    await new Promise(r => setTimeout(r, 60));
    rec.start(100);

    const a = audioEl.current;
    // Level is the gain node's job now — forcing element volume here would
    // override the slider and record the bed at full tilt.
    if (a && audioUrl) { a.currentTime = 0; await a.play().catch(() => {}); }

    recordingRef.current = true;
    const t0 = performance.now();
    await new Promise<void>(res => {
      const pump = makePump(() => {
        const t = (performance.now() - t0) / 1000;
        if (t >= total) { setTime(total); draw(total); pump.dispose(); return res(); }
        // draw() explicitly rather than waiting on the state round-trip —
        // captureStream only samples what has actually been painted.
        setTime(t); draw(t);
      });
      pump.start();
    });

    await new Promise(r => setTimeout(r, 250)); // let the tail flush
    recordingRef.current = false;
    for (const m of imgs.current.values()) if (m instanceof HTMLVideoElement) m.pause();
    rec.stop();
    a?.pause();
    const blob = await done;
    // The graph deliberately stays open — it's reused by the next export and
    // by ordinary playback.

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roadie-promo-${Date.now()}.webm`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setExporting(`Saved — ${(blob.size / 1e6).toFixed(1)} MB.${audioNote}`);
  }

  function exportStill() {
    const cv = canvas.current!;
    cv.toBlob(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const link = document.createElement("a");
      link.href = url; link.download = `roadie-still-${Date.now()}.png`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }, "image/png");
  }

  // The one place seconds become pixels. Everything on the lane — ruler,
  // ticks, clips, playhead — measures through this, so zoom can never put the
  // playhead somewhere different from the clip it is sitting on.
  const fitPps = total > 0 ? laneW / total : 1;
  const scale = pps ?? fitPps;
  const x = useCallback((t: number) => t * scale, [scale]);
  const laneWidth = Math.max(laneW, total * scale);

  // beat ticks, thinned to whatever stays readable AT THE CURRENT ZOOM. Zoomed
  // out, quarter notes turn to mush; zoomed in, you want every one.
  const ticks = useMemo(() => {
    if (!total) return [] as { t: number; bar: boolean }[];
    const out: { t: number; bar: boolean }[] = [];
    const minPx = 8;
    let every = 1;
    while (beat * every * scale < minPx && every < 64) every *= 2;
    for (let i = 0; i * beat <= total; i += every) out.push({ t: i * beat, bar: i % 4 === 0 });
    return out;
  }, [total, beat, scale]);

  // Second labels, likewise thinned so they never overlap.
  const secStep = useMemo(() => {
    for (const st of [1, 2, 5, 10, 15, 30, 60, 120, 300]) if (st * scale >= 44) return st;
    return 600;
  }, [scale]);

  /**
   * Zoom, keeping the playhead where it is on screen — never lose your place.
   *
   * The scroll has to be applied AFTER the new width is laid out, but not via
   * requestAnimationFrame: rAF does not fire in a background tab, and zooming
   * is exactly the kind of thing you do right before switching away to look at
   * something. The anchor is stashed and applied in a layout effect, which runs
   * on commit whether or not the page is painting.
   */
  const zoomAnchor = useRef<number | null>(null);
  function zoomTo(next: number | null) {
    const lane = laneRef.current;
    if (lane) zoomAnchor.current = time * scale - lane.scrollLeft;
    setPps(next);
  }
  useLayoutEffect(() => {
    const lane = laneRef.current;
    const anchor = zoomAnchor.current;
    if (!lane || anchor === null) return;
    zoomAnchor.current = null;
    // Keep the playhead the same distance from the left edge as it was.
    lane.scrollLeft = Math.max(0, time * scale - anchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  /**
   * Snap a time to whatever is worth landing on.
   *
   * Two kinds of target, and the order matters. Other clips' edges and the
   * playhead are MAGNETIC — they pull only when you are already within a few
   * pixels, so butting two clips together is easy but you are never fighting
   * the grid. The beat grid is the fallback, and it is measured in pixels too:
   * a fixed 0.05s tolerance is invisible when zoomed out and maddening when
   * zoomed in.
   *
   * `exclude` keeps a clip from snapping to its own edges.
   */
  const snapT = useCallback((t: number, exclude?: string) => {
    if (magnet) {
      const tol = 8 / scale;
      let best: number | null = null, bestD = Infinity;
      const consider = (target: number) => {
        const d = Math.abs(target - t);
        if (d < tol && d < bestD) { best = target; bestD = d; }
      };
      consider(0);
      consider(time);
      for (const c of clips) {
        if (c.id === exclude) continue;
        consider(c.start);
        consider(c.start + c.dur);
      }
      if (best !== null) return Math.max(0, best);
    }
    // Nothing magnetic nearby — fall back to the beat grid, if that is on.
    if (snap) return Math.max(0, Math.round(t / beat) * beat);
    return Math.max(0, t);
  }, [snap, magnet, scale, time, clips, beat]);

  // --- placed sound --------------------------------------------------------
  //
  // Decoded once into buffers and SCHEDULED, rather than played from an
  // <audio> element each. Scheduling is sample-accurate — an effect meant to
  // land on a hit lands on it — and a dozen elements all seeking at once is
  // exactly the judder the picture already taught us to avoid.
  const buffers = useRef<Map<string, AudioBuffer>>(new Map());
  const playingSrcs = useRef<AudioBufferSourceNode[]>([]);
  const [soundsReady, setSoundsReady] = useState(0);

  useEffect(() => {
    const list = doc.sounds || [];
    if (!list.length) return;
    const g = audioGraph(true);
    if (!g) return;
    let dead = false;
    (async () => {
      for (const a of list) {
        if (buffers.current.has(a.url)) continue;
        try {
          const res = await fetch(a.url);
          if (!res.ok) continue;
          const buf = await g.ctx.decodeAudioData(await res.arrayBuffer());
          if (dead) return;
          buffers.current.set(a.url, buf);
          setSoundsReady(n => n + 1);
        } catch { /* one bad file must not stop the rest */ }
      }
    })();
    return () => { dead = true; };
  }, [doc.sounds, audioGraph]);

  /** Real length of a placed sound, once we know it. */
  const soundLen = (a: AudioClip) => buffers.current.get(a.url)?.duration ?? Infinity;

  function stopScheduled() {
    for (const s of playingSrcs.current) { try { s.stop(); } catch {} }
    playingSrcs.current = [];
  }

  /** Line every placed sound up against a transport starting at `from`. */
  function scheduleSounds(from: number) {
    const g = graphRef.current;
    if (!g) return;
    stopScheduled();
    const now = g.ctx.currentTime + 0.03;   // a beat of headroom to set up
    for (const a of doc.sounds || []) {
      const buf = buffers.current.get(a.url);
      if (!buf) continue;
      const end = a.start + a.dur;
      if (end <= from) continue;                 // already gone by
      const when = now + Math.max(0, a.start - from);
      const into = (a.trimIn || 0) + Math.max(0, from - a.start);
      const len = Math.min(a.dur - Math.max(0, from - a.start), buf.duration - into);
      if (len <= 0) continue;
      try {
        const src = g.ctx.createBufferSource();
        src.buffer = buf;
        const gain = g.ctx.createGain();
        gain.gain.value = a.gain ?? 0.9;
        src.connect(gain); gain.connect(g.master);
        src.start(when, into, len);
        playingSrcs.current.push(src);
      } catch { /* skip this one */ }
    }
  }

  /**
   * Cut a clip's head or tail off at the playhead.
   *
   * Trimming the head moves the in-point with it, exactly as the handle does,
   * so the frame under the playhead is the frame you keep.
   */
  function trimToPlayhead(id: string, which: "in" | "out") {
    const c = clips.find(k => k.id === id);
    if (!c || time <= c.start || time >= c.start + c.dur) return;
    if (which === "out") { patch(id, { dur: time - c.start }); return; }
    patch(id, {
      start: time,
      dur: c.start + c.dur - time,
      trimIn: Math.max(0, (c.trimIn || 0) + (time - c.start)),
    });
  }

  /**
   * Stretch a clip's tail to meet whatever comes next on its own track — the
   * next clip's start, or the playhead if it is further along and nothing
   * follows. Closes a gap without measuring it.
   */
  function extendToNext(id: string) {
    const c = clips.find(k => k.id === id);
    if (!c) return;
    const next = clips
      .filter(k => k.track === c.track && k.id !== c.id && k.start >= c.start + c.dur)
      .sort((a, b) => a.start - b.start)[0];
    const target = next ? next.start : Math.max(time, c.start + c.dur);
    const room = sourceLen(c) - (c.trimIn || 0);
    const dur = Math.min(target - c.start, room);
    if (dur > MIN_DUR) patch(id, { dur });
  }

  /** Bring the playhead into view if a seek put it off the edge. */
  useEffect(() => {
    const lane = laneRef.current;
    if (!lane || pps === null) return;
    const px = time * scale;
    const pad = 40;
    if (px < lane.scrollLeft + pad) lane.scrollLeft = Math.max(0, px - pad);
    else if (px > lane.scrollLeft + lane.clientWidth - pad) {
      lane.scrollLeft = px - lane.clientWidth + pad;
    }
  }, [time, scale, pps]);

  return (
    <div className="flex flex-col gap-4">
      {/* preview */}
      <div className="card p-3">
        <div className="relative">
          <canvas ref={canvas} width={W} height={H}
            className="w-full rounded-xl bg-black border border-[#2a2a3a]" />
          {lassoFor && (
            <Lasso
              onCancel={() => setLassoFor(null)}
              onDone={pts => { addFx(lassoFor, pts); setLassoFor(null); }} />
          )}
        </div>
        {audioUrl && <audio ref={audioEl} src={audioUrl} preload="auto" className="hidden" />}

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button className="btn btn-neon w-24" onClick={() => setPlaying(p => !p)} disabled={!clips.length}>
            {playing ? "Pause" : "Play"}
          </button>
          <button className="btn" onClick={() => { setPlaying(false); setTime(0); }}>Back to start</button>
          <span className="font-mono text-sm tabular-nums">
            {fmt(time)} <span className="text-[#8a8aa0]">/ {fmt(total)}</span>
            <span className="text-[#8a8aa0] ml-3">beat {total ? Math.floor(time / beat) + 1 : 0}</span>
          </span>
          <label className="flex items-center gap-2 text-sm ml-auto">
            <input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />
            Snap to beat
            <Help title="Snap to beat">Locks the playhead and clip edges to the music&apos;s
              beat grid, set by BPM below. Cuts that land on the beat read as intentional;
              cuts that land near it read as sloppy.</Help>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={magnet} onChange={e => setMagnet(e.target.checked)} />
            Magnetic
            <Help title="Magnetic edges">
              Pulls a clip you are dragging onto the edge of another clip, the playhead,
              or the very start — but only when you are already within a few pixels, so it
              helps you butt two shots together without ever fighting you.
              <br /><br />
              Turn it off when you want a deliberate gap or an overlap that lands near an
              edge without touching it. It is separate from <b>Snap to beat</b>; you can
              run either, both, or neither.
            </Help>
          </label>
        </div>
      </div>

      {/* ruler + track */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4 mb-3">
          <Field label="BPM" help={<>The song&apos;s tempo. It draws the beat grid and lets
            &quot;fit to beats&quot; cut on the music. If you don&apos;t know it, 120 is a safe guess
            and you can nudge until the ticks line up with the track.</>}>
            <input type="number" min={40} max={220} className={inp + " w-24"}
              value={bpm} onChange={e => setBpm(Number(e.target.value) || 120)} />
          </Field>
          <button className="btn" onClick={fitToBeats} disabled={!clips.length}>Fit all clips to beats</button>
          <Field label="Music" help={<>Drop an MP3 or WAV under the picture. It plays as you
            scrub and gets muxed into the export. The file stays in this browser — it
            isn&apos;t uploaded.</>}>
            <input type="file" accept="audio/*" className="text-xs"
              onChange={e => e.target.files?.[0] && addAudio(e.target.files[0])} />
          </Field>
          {audioUrl && (
            <Field label={`Music level ${Math.round(doc.audioGain * 100)}%`} help={
              <>How loud the bed sits under the picture. 70–80% leaves room if you talk over it.</>}>
              <input type="range" min={0} max={1} step={0.05} value={doc.audioGain}
                onChange={e => setDoc({ ...doc, audioGain: Number(e.target.value) })} className="w-40" />
            </Field>
          )}
        </div>

        {/* zoom bar */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="label">View</span>
          <button className={"btn px-2 py-1 text-[11px] " + (pps === null ? "btn-neon" : "")}
            onClick={() => zoomTo(null)}>Fit whole promo</button>
          <button className="btn px-2 py-1 text-[11px]"
            onClick={() => zoomTo(Math.max(4, (pps ?? fitPps) / 1.6))}>–</button>
          <button className="btn px-2 py-1 text-[11px]"
            onClick={() => zoomTo(Math.min(1200, (pps ?? fitPps) * 1.6))}>+</button>
          <span className="text-[11px] text-[#8a8aa0] tabular-nums">
            {pps === null ? "fit" : `${Math.round(scale)} px/sec`}
          </span>
          <Help title="Zoom">
            <b>Fit whole promo</b> shows everything end to end. Zoom in with + to work on
            one moment — the lane scrolls, and the playhead stays where it is on screen so
            you never lose your place. On a long piece a half-second effect is only a few
            pixels wide at Fit; zoom in before you trim it.
          </Help>
        </div>

        {/* the lane: ruler and every track share one scroller, so they can
            never drift out of alignment with each other */}
        <div ref={laneRef} className="overflow-x-auto scroll rounded-lg border border-[#2a2a3a] bg-[#0b0b0f]">
          <div style={{ width: laneWidth, position: "relative" }}>

            <div ref={rulerRef}
              className="relative h-10 border-b border-[#2a2a3a] cursor-ew-resize select-none"
              onMouseDown={e => { setPlaying(false); scrubTo(e.clientX); }}
              onMouseMove={e => { if (e.buttons === 1) scrubTo(e.clientX); }}>
              {ticks.map((t, i) => (
                <div key={i} className="absolute top-0 border-l"
                  style={{ left: x(t.t), height: t.bar ? "100%" : "45%",
                           borderColor: t.bar ? "#3a3a4a" : "#22222e" }} />
              ))}
              {/* Labels are centred on their tick, so one sitting exactly on the
                  end would hang half its width past the lane and leave a stray
                  scrollbar at Fit. The final mark is the edge itself — no label
                  needed. */}
              {total > 0 && Array.from({ length: Math.floor(total / secStep) + 1 })
                .map((_, i) => i * secStep)
                .filter(sec => sec < total)
                .map(sec => (
                  <span key={sec}
                    className="absolute bottom-0.5 text-[10px] text-[#8a8aa0] -translate-x-1/2 pointer-events-none tabular-nums"
                    style={{ left: x(sec) }}>{fmt(sec).slice(0, -3)}</span>
                ))}
            </div>

            {/* one row per picture layer, base at the bottom like a real stack */}
            {Array.from({ length: trackCount }).map((_, i) => {
              const track = trackCount - 1 - i;
              const onTrack = clips.filter(c => c.track === track);
              return (
                <div key={track}
                  className="relative border-b border-[#22222e]"
                  onContextMenu={e => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, t: snapT(timeAtEvent(e.clientX)), track });
                  }}
                  onDragOver={e => {
                    // Only for files off the desktop — dragging a clip along the
                    // lane is a pointer drag and must not be caught here.
                    if (!e.dataTransfer.types.includes("Files")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (dropping !== track) setDropping(track);
                  }}
                  onDragLeave={() => setDropping(null)}
                  onDrop={e => {
                    if (!e.dataTransfer.types.includes("Files")) return;
                    e.preventDefault();
                    setDropping(null);
                    const files = Array.from(e.dataTransfer.files || []);
                    if (files.length) dropFilesAt(files, snapT(timeAtEvent(e.clientX)), track);
                  }}
                  style={{
                    height: 74,
                    background: dropping === track ? "rgba(255,61,110,0.10)"
                              : track === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    outline: dropping === track ? "2px dashed #ff3d6e" : undefined,
                    outlineOffset: -2,
                  }}>
                  <span className="absolute left-1 top-1 text-[9px] px-1 rounded z-10 pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#8a8aa0" }}>
                    {track === 0 ? "base" : `layer ${track}`}
                  </span>
                  {!onTrack.length && track === 0 && !clips.length && (
                    <div className="absolute inset-0 grid place-items-center text-sm text-[#8a8aa0]">
                      Generate a shot above and hit &quot;Use this shot&quot; — or drag a
                      picture, clip or sound straight in from your computer.
                    </div>
                  )}
                  {onTrack.map(c => (
                    <div key={c.id}
                      onPointerDown={e => {
                        if (e.shiftKey) {
                          // Shift adds to the selection instead of replacing it.
                          setExtra(x => x.includes(c.id) ? x.filter(i => i !== c.id)
                                                        : sel && sel !== c.id ? [...x, c.id] : x);
                          if (!sel) setSel(c.id);
                        } else { setSel(c.id); setExtra([]); }
                        const r = laneRef.current!.getBoundingClientRect();
                        const tAt = (e.clientX - r.left + laneRef.current!.scrollLeft) / scale;
                        // Within a handle's width of an edge means trim, not move.
                        const handlePx = 10;
                        const nearIn = (tAt - c.start) * scale < handlePx;
                        const nearOut = (c.start + c.dur - tAt) * scale < handlePx;
                        const wide = x(c.dur) > handlePx * 2.5;
                        dragClip.current =
                          wide && nearIn  ? { id: c.id, mode: "in",  start0: c.start, dur0: c.dur, trim0: c.trimIn || 0 } :
                          wide && nearOut ? { id: c.id, mode: "out", start0: c.start, dur0: c.dur, trim0: c.trimIn || 0 } :
                          { id: c.id, mode: "move", grabT: tAt - c.start };
                        capture(e);
                      }}
                      onPointerMove={e => {
                        const d = dragClip.current;
                        const r = laneRef.current!.getBoundingClientRect();
                        const tAt = (e.clientX - r.left + laneRef.current!.scrollLeft) / scale;
                        if (d?.id !== c.id) {
                          // Not dragging — just show what the edge would do.
                          const handlePx = 10;
                          const nearEdge = x(c.dur) > handlePx * 2.5 &&
                            ((tAt - c.start) * scale < handlePx || (c.start + c.dur - tAt) * scale < handlePx);
                          e.currentTarget.style.cursor = nearEdge ? "ew-resize" : "grab";
                          return;
                        }
                        if (d.mode === "move") {
                          // Attached clips travel with it; on its own this is
                          // the same single-clip move as before.
                          slideGroup(c.id, snapT(tAt - d.grabT, c.id));
                          return;
                        }
                        if (d.mode === "out") {
                          // Tail: length only. Never past the end of the source.
                          const end = snapT(tAt, c.id);
                          const room = sourceLen(c) - (c.trimIn || 0);
                          patch(c.id, { dur: Math.max(MIN_DUR, Math.min(end - d.start0, room)) });
                          return;
                        }
                        // Head: start, length and in-point move together, so the
                        // picture under the handle stays the frame you can see.
                        let ns = snapT(tAt, c.id);
                        const latest = d.start0 + d.dur0 - MIN_DUR;
                        // Cannot trim back past the head of the source either.
                        const earliest = d.start0 - d.trim0;
                        ns = Math.min(latest, Math.max(earliest, ns));
                        patch(c.id, {
                          start: ns,
                          dur: d.start0 + d.dur0 - ns,
                          trimIn: Math.max(0, d.trim0 + (ns - d.start0)),
                        });
                      }}
                      onPointerUp={e => { release(e); dragClip.current = null; }}
                      onPointerCancel={e => { release(e); dragClip.current = null; }}
                      title={`${c.dur.toFixed(2)}s at ${c.start.toFixed(2)}s${c.trimIn ? ` (from ${c.trimIn.toFixed(2)}s in)` : ""}`}
                      className={"absolute top-1 bottom-1 rounded-md overflow-hidden cursor-grab active:cursor-grabbing " +
                                 (sel === c.id ? "ring-2 ring-inset ring-[#ff3d6e] z-[5]"
                                   : extra.includes(c.id) ? "ring-2 ring-inset ring-[#ffb03d] z-[5]"
                                   : "border border-[#2a2a3a]")}
                      style={{ left: x(c.start), width: Math.max(6, x(c.dur)) }}>
                      {c.url ? (
                        <img src={c.url} alt="" draggable={false}
                          className="w-full h-full object-cover opacity-70 hover:opacity-100 pointer-events-none" />
                      ) : (
                        <div className="w-full h-full grid place-items-center pointer-events-none text-[9px] px-1 text-center"
                          style={{
                            background: c.failed ? "rgba(224,92,122,0.18)" : "rgba(255,61,110,0.12)",
                            color: c.failed ? "#e05c7a" : "#ffb0c4",
                          }}>
                          {c.failed ? "failed" : "rendering…"}
                        </div>
                      )}
                      {x(c.dur) > 54 && (
                        <span className="absolute bottom-1 left-1 text-[10px] px-1 rounded bg-black/70 pointer-events-none">
                          {c.dur.toFixed(2)}s
                        </span>
                      )}
                      {/* Handles are drawn, not hit-tested — the pointer logic
                          above owns the edges so the grab zone matches at any zoom. */}
                      {x(c.dur) > 25 && (
                        <>
                          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/30 pointer-events-none" />
                          <span className="absolute right-0 top-0 bottom-0 w-[3px] bg-white/30 pointer-events-none" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* sound row — placed effects and generated beds */}
            <div className="relative border-b border-[#22222e]"
              style={{ height: 46, background: "rgba(76,201,240,0.04)" }}
              onContextMenu={e => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, t: snapT(timeAtEvent(e.clientX)), track: -1 });
              }}>
              <span className="absolute left-1 top-1 text-[9px] px-1 rounded z-10 pointer-events-none"
                style={{ background: "rgba(0,0,0,0.6)", color: "#8a8aa0" }}>sound</span>
              {(doc.sounds || []).map(a => (
                <div key={a.id}
                  onPointerDown={e => {
                    const grab = timeAtEvent(e.clientX) - a.start;
                    dragSound.current = { id: a.id, grabT: grab };
                    setSelSound(a.id);
                    if (e.shiftKey) setExtra(x => x.includes(a.id) ? x.filter(i => i !== a.id) : [...x, a.id]);
                    else setExtra([]);
                    capture(e);
                  }}
                  onPointerMove={e => {
                    const d = dragSound.current;
                    if (d?.id !== a.id) return;
                    slideGroup(a.id, snapT(timeAtEvent(e.clientX) - d.grabT));
                  }}
                  onPointerUp={e => { release(e); dragSound.current = null; }}
                  onPointerCancel={e => { release(e); dragSound.current = null; }}
                  onContextMenu={e => e.stopPropagation()}
                  title={`${a.name} — ${a.dur.toFixed(2)}s at ${a.start.toFixed(2)}s`}
                  className={"absolute top-1 bottom-1 rounded-md overflow-hidden cursor-grab active:cursor-grabbing flex items-center px-1.5 " +
                             (selSound === a.id ? "ring-2 ring-inset ring-[#4cc9f0]"
                               : extra.includes(a.id) ? "ring-2 ring-inset ring-[#ffb03d]"
                               : "border border-[#2a4a5a]")}
                  style={{ left: x(a.start), width: Math.max(8, x(a.dur)),
                           background: a.kind === "music" ? "rgba(61,220,132,0.18)" : "rgba(76,201,240,0.18)" }}>
                  <span className="text-[9px] truncate pointer-events-none" style={{ color: "#cfe9f5" }}>
                    {a.name}
                  </span>
                </div>
              ))}
            </div>

            {/* playhead spans the whole stack */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-[#ff3d6e] pointer-events-none z-10"
              style={{ left: x(time) }} />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button className="btn px-2 py-1 text-[11px]"
            onClick={() => setDoc({ ...doc, tracks: trackCount + 1 })}>Add layer</button>
          {trackCount > 2 && !clips.some(c => c.track === trackCount - 1) && (
            <button className="btn px-2 py-1 text-[11px]"
              onClick={() => setDoc({ ...doc, tracks: trackCount - 1 })}>Remove empty layer</button>
          )}
          <Help title="Layers">
            The <b>base</b> row is the picture. Anything on a layer above it paints on top,
            so a logo or a title can sit over a shot instead of replacing it.
            Drag a clip sideways to move it in time; snap keeps it on the beat.
          </Help>
        </div>

        {audioUrl && (
          <div className="mt-1 h-6 rounded-lg border border-[#2a2a3a] bg-[#101018]
                          flex items-center px-2 text-[11px] text-[#8a8aa0] truncate">
            ♪ {doc.audioName}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-4">
          <button className="btn btn-neon" onClick={exportVideo} disabled={!clips.length}>Export video</button>
          <button className="btn" onClick={exportStill} disabled={!clips.length}>Export this frame (PNG)</button>
          <Help title="Export">
            Video records the piece in real time, so a 15-second promo takes 15 seconds.
            You can switch tabs or minimise while it runs — the clock lives in a worker,
            so it won&apos;t freeze on you. You get a .webm, which posts fine to Instagram,
            Facebook and YouTube. For a still, park the playhead where you want it and
            take the PNG.
          </Help>
          {exporting && <span className="text-sm text-[#8a8aa0] self-center">{exporting}</span>}
        </div>
      </div>

      {/* Right-click menu. Fixed to the cursor, and its own pointerdown is
          stopped so choosing an item does not immediately dismiss it. */}
      {menu && (
        <div
          onPointerDown={e => e.stopPropagation()}
          style={{
            position: "fixed",
            left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 240),
            top: Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 260),
            zIndex: 200, width: 226,
            background: "rgba(20,20,28,0.86)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            border: "1px solid #2a2a3a", borderRadius: 12,
            boxShadow: "0 18px 50px rgba(0,0,0,0.6)", overflow: "hidden",
          }}>
          <div className="px-3 py-2 text-[10px] uppercase tracking-wide border-b border-[#2a2a3a]"
            style={{ color: "#8a8aa0" }}>
            Insert at {menu.t.toFixed(2)}s
            <span className="ml-1">{menu.track < 0 ? "· sound" : menu.track === 0 ? "· base" : `· layer ${menu.track}`}</span>
          </div>
          {[
            { k: "gen",   label: "Generate a picture here…", hint: "holds the spot while it renders" },
            { k: "clip",  label: "Generate a clip here…",    hint: "WAN, LTX or Grok" },
            { k: "ai",    label: "Ask AI for a sound",   hint: "picks from the bank and places it" },
            { k: "sfx",   label: "Sound from the bank…", hint: "515 Fairlight effects" },
            { k: "stock", label: "From the stock shelf…", hint: "your licensed footage" },
          ].map(item => (
            <button key={item.k}
              className="w-full text-left px-3 py-2 hover:bg-white/[0.06] block"
              onClick={() => {
                const t = menu.t, track = menu.track;
                setMenu(null);
                if (item.k === "ai") aiSoundAt(t);
                else if (item.k === "gen") setAsk({ t, track });
                else if (item.k === "clip") setAskClip({ t, track });
                else setPicker({ kind: item.k as "sfx" | "stock", t, track });
              }}>
              <div className="text-sm">{item.label}</div>
              <div className="text-[10px]" style={{ color: "#8a8aa0" }}>{item.hint}</div>
            </button>
          ))}
        </div>
      )}

      {picker && (
        <InsertPicker
          kind={picker.kind}
          at={picker.t}
          onClose={() => setPicker(null)}
          onPickSound={(url, name, dur) =>
            addSound({ url, name, start: picker.t, dur, gain: 0.9, kind: "sfx" })}
          onPickStock={(url, kind, dur) =>
            setDoc({
              ...doc,
              clips: [...clips, newClip(url, undefined, kind, dur, picker.t, Math.max(0, picker.track))],
            })}
        />
      )}

      {askClip && <GenerateClipAt at={askClip.t} onClose={() => setAskClip(null)}
        onGo={(form, prompt, dur, size, audio, thenAnimate) => {
          const a = askClip; setAskClip(null);
          if (form === "grok") grokAt(a.t, a.track, prompt, dur);
          // VIDU animates a still, so it gets the frame under the playhead.
          else if (form === "vidu") podAt(a.t, a.track, "vidu", prompt, dur, frameDataUrl());
          else if (form === "wan25") podAt(a.t, a.track, "wan25", prompt, dur, frameDataUrl(), size, audio);
          else if (form === "wan26") {
            // With "then move it" ticked this is one press: the still job
            // carries instructions for the video job that follows it.
            podAt(a.t, a.track, "wan26", prompt, thenAnimate ? dur : 3, undefined, size, undefined,
              thenAnimate ? { lane: "wan25", prompt, duration: dur, size, audio } : undefined);
          }
          else setExporting(
            form === "wan_firstlast"
              ? "First+last needs a start and an end still — pick them in Make it move."
              : "That lane runs from a still — generate a picture here first, then Make it move.");
        }} />}

      {ask && <GenerateAt at={ask.t} onClose={() => setAsk(null)}
        onGo={(prompt, look, dur) => { const a = ask; setAsk(null); generateAt(a.t, a.track, prompt, look, dur); }} />}

      {busy && (
        <div className="fixed bottom-4 right-4 z-[210] card px-3 py-2 text-sm">{busy}</div>
      )}

      {/* FX — what is lassoed on the selected shot */}
      {selected && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="label">FX on this shot</span>
            <Help title="Lasso FX">
              Draw round something in the frame and it becomes a thing you can act on —
              isolate it, knock the background out so the layer underneath shows through,
              invert it, or dim everything around it.
              <br /><br />
              Name it and the name sticks with the shot, so &quot;the bus&quot; means the same
              thing every time you come back to it.
              <br /><br />
              <b>Honest limits:</b> the mask is drawn on the frame, so it does not follow a
              push-in or a drift within the shot, and it does not yet carry itself from one
              shot to the next. Auto-select is not wired — SAM is on the NAS but has no
              workflow staged, so for now you draw it.
            </Help>
            <button className={"btn " + (lassoFor === selected.id ? "btn-neon" : "")}
              onClick={() => setLassoFor(lassoFor === selected.id ? null : selected.id)}>
              {lassoFor === selected.id ? "Drawing — cancel" : "Lasso something"}
            </button>
            {lassoFor === selected.id && (
              <span className="text-[11px]" style={{ color: "#8a8aa0" }}>
                park the playhead on this shot first, then drag round the subject
              </span>
            )}
          </div>

          {!fxList.filter(f => f.clipId === selected.id).length && (
            <p className="text-xs text-muted">
              Nothing lassoed on this shot yet.
            </p>
          )}

          {fxList.filter(f => f.clipId === selected.id).map(f => (
            <div key={f.id} className="rounded-xl border border-[#2a2a3a] p-3 flex flex-wrap items-end gap-3">
              <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
                Name
                <input className={inp + " mt-1 w-40"} value={f.name} placeholder="the bus"
                  onChange={e => patchFx(f.id, { name: e.target.value })} />
              </label>
              <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
                Do what
                <select className={inp + " mt-1"} value={f.mode}
                  onChange={e => patchFx(f.id, { mode: e.target.value as Fx["mode"] })}>
                  <option value="isolate">Isolate it</option>
                  <option value="cutout">Knock the background out</option>
                  <option value="invert">Block it out (keep background)</option>
                  <option value="dim">Dim around it</option>
                  <option value="spot">Spotlight it</option>
                </select>
              </label>
              <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
                Soft edge {f.feather}px
                <input type="range" min={0} max={24} step={1} value={f.feather}
                  onChange={e => patchFx(f.id, { feather: Number(e.target.value) })}
                  className="w-32 block mt-2" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.enabled}
                  onChange={e => patchFx(f.id, { enabled: e.target.checked })} />
                On
              </label>
              <span className="text-[11px]" style={{ color: "#8a8aa0" }}>{f.points.length} points</span>
              <button className="btn ml-auto"
                onClick={() => setDoc({ ...doc, fx: fxList.filter(k => k.id !== f.id) })}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* inspector */}
      {selected && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label">Shot settings</span>
            <div className="flex gap-2">
              <button className="btn" onClick={() => move(selected.id, -1)}>← earlier</button>
              <button className="btn" onClick={() => move(selected.id, 1)}>later →</button>
              <button className="btn" title="Cut the head off at the playhead"
                onClick={() => trimToPlayhead(selected.id, "in")}>Trim start here</button>
              <button className="btn" title="Cut the tail off at the playhead"
                onClick={() => trimToPlayhead(selected.id, "out")}>Trim end here</button>
              <button className="btn" title="Stretch the tail to the next clip"
                onClick={() => extendToNext(selected.id)}>Extend</button>
              <button className="btn" title="Link the shift-selected clips so they move together"
                onClick={attachSelection}>
                Attach{extra.length ? ` (${extra.length + 1})` : ""}
              </button>
              {selected.group && (
                <button className="btn" title="Unlink" onClick={detachSelection}>Detach</button>
              )}
              <button className="btn" onClick={() => {
                setDoc({ ...doc, clips: clips.filter(c => c.id !== selected.id) });
                setSel(null);
              }}>Remove</button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <Field label={`On screen — ${selected.dur.toFixed(2)}s (${(selected.dur / beat).toFixed(1)} beats)`}
                help={<>How long this shot holds. Two to four seconds reads well; under one
                  second only works on a fast track.</>}>
                <input type="range" min={0.3} max={12} step={snap ? beat : 0.1} value={selected.dur}
                  onChange={e => patch(selected.id, { dur: Number(e.target.value) })} className="w-full" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={`Zoom start ${selected.zoomFrom.toFixed(2)}×`}
                  help={<>1.00 is the whole picture. Leave both the same for a locked-off
                    shot — motion for its own sake is what makes a promo look like a slideshow.</>}>
                  <input type="range" min={1} max={2} step={0.01} value={selected.zoomFrom}
                    onChange={e => patch(selected.id, { zoomFrom: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label={`Zoom end ${selected.zoomTo.toFixed(2)}×`}
                  help={<>Where the zoom lands. End higher than start to push in, lower to pull out.</>}>
                  <input type="range" min={1} max={2} step={0.01} value={selected.zoomTo}
                    onChange={e => patch(selected.id, { zoomTo: Number(e.target.value) })} className="w-full" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={`Drift across ${selected.panX.toFixed(2)}`}
                  help={<>Sideways travel. Only has room to move when you&apos;re zoomed in past 1.00×.</>}>
                  <input type="range" min={-1} max={1} step={0.05} value={selected.panX}
                    onChange={e => patch(selected.id, { panX: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label={`Drift up/down ${selected.panY.toFixed(2)}`} help={<>Vertical travel, same rule.</>}>
                  <input type="range" min={-1} max={1} step={0.05} value={selected.panY}
                    onChange={e => patch(selected.id, { panY: Number(e.target.value) })} className="w-full" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={`Fade in ${selected.fadeIn.toFixed(2)}s`} help={<>Black to picture at the head.</>}>
                  <input type="range" min={0} max={2} step={0.05} value={selected.fadeIn}
                    onChange={e => patch(selected.id, { fadeIn: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label={`Fade out ${selected.fadeOut.toFixed(2)}s`} help={<>Picture to black at the tail.</>}>
                  <input type="range" min={0} max={2} step={0.05} value={selected.fadeOut}
                    onChange={e => patch(selected.id, { fadeOut: Number(e.target.value) })} className="w-full" />
                </Field>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Field label="Motion curve" help={<>The shape of the move over time. The line goes
                from the start of the shot to the end; a steep middle means it hurries through
                and settles.</>}>
                <SplineEditor value={selected.ease} onChange={v => patch(selected.id, { ease: v })} />
              </Field>

              <Field label="Words on screen" help={<>Real text, drawn by the editor — this is
                where the sponsor&apos;s name goes. Never put it in the image prompt; the model
                spells it wrong. One line per row.</>}>
                <textarea className={inp + " h-20 resize-y"} placeholder={"ROADIE presents\nyour name here"}
                  value={selected.text} onChange={e => patch(selected.id, { text: e.target.value })} />
              </Field>

              <Field label={`Text size ${selected.textSize}px`} help={<>Measured against a {W}px-wide frame.</>}>
                <input type="range" min={20} max={140} step={2} value={selected.textSize}
                  onChange={e => patch(selected.id, { textSize: Number(e.target.value) })} className="w-full" />
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- generate-at-a-point prompt -------------------------------------------

/**
 * The small box behind "Generate a picture here".
 *
 * Deliberately three fields. The full prompt studio upstairs has looks, sizes,
 * seeds, steps and cfg — all of which matter when you are hunting a shot. Down
 * here you already know what you want and where it goes, so anything more is
 * in the way.
 */
function GenerateAt({
  at, onClose, onGo,
}: {
  at: number;
  onClose: () => void;
  onGo: (prompt: string, look: string, dur: number) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [look, setLook] = useState("PHOTOREAL");
  const [dur, setDur] = useState(3);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const box = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
              "focus:outline-none focus:border-[#ff3d6e]";

  return (
    <div onPointerDown={e => e.stopPropagation()}
      className="fixed left-1/2 -translate-x-1/2 z-[205]"
      style={{
        bottom: 24, width: 460,
        background: "rgba(20,20,28,0.9)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: "1px solid #2a2a3a", borderRadius: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.6)", padding: 12,
      }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="label">Generate a picture</span>
        <span className="text-[11px]" style={{ color: "#8a8aa0" }}>lands at {at.toFixed(2)}s</span>
        <button className="btn px-2 py-1 text-[11px] ml-auto" onClick={onClose}>Cancel</button>
      </div>

      <textarea className={box} rows={3} autoFocus value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="what the shot is — a wide of a mountain highway at dusk, headlights coming on" />

      <div className="flex items-end gap-3 mt-2">
        <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
          Look
          <select className={box + " mt-1"} value={look} onChange={e => setLook(e.target.value)}>
            <option value="PHOTOREAL">Photoreal</option>
            <option value="COMIC">Comic</option>
          </select>
        </label>
        <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
          Hold {dur.toFixed(1)}s
          <input type="range" min={0.5} max={10} step={0.5} value={dur}
            onChange={e => setDur(Number(e.target.value))} className="w-32 block mt-2" />
        </label>
        <button className="btn btn-neon ml-auto" disabled={!prompt.trim()}
          onClick={() => onGo(prompt.trim(), look, dur)}>
          Queue it
        </button>
      </div>
      <p className="text-[11px] mt-2" style={{ color: "#8a8aa0" }}>
        A placeholder holds this spot while the pool renders, so you can keep cutting
        around it. The picture drops in when it lands.
      </p>
    </div>
  );
}


// --- generate-a-clip-at-a-point -------------------------------------------

/**
 * Choosing a video lane, with the trade-offs on the buttons.
 *
 * Four forms, and they are genuinely different tools rather than four names
 * for the same thing. The only one that costs money says so before you press
 * it — Grok is never reached by accident and never as a fallback.
 */
type Form = "wan" | "wan_firstlast" | "ltx" | "grok" | "vidu" | "wan25" | "wan26";

function GenerateClipAt({
  at, onClose, onGo,
}: {
  at: number;
  onClose: () => void;
  onGo: (form: Form, prompt: string, dur: number, size: string,
         audio?: string, thenAnimate?: boolean) => void;
}) {
  const [form, setForm] = useState<Form>("wan");
  const [secs, setSecs] = useState(5);
  const [size, setSize] = useState("480p");
  // Audio is carried as a data URI: RunPod fetches what it is given, and the
  // sound bank sits behind our auth where it cannot reach.
  const [audio, setAudio] = useState<{ name: string; data: string } | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  // Make the still first, then move it — two RunPod jobs joined into one press.
  const [thenAnimate, setThenAnimate] = useState(false);

  async function takeAudio(f: File) {
    setAudioErr(null);
    // 16MB is the endpoint's ceiling, and base64 inflates by about a third,
    // so the real limit on the raw file is ~11MB. Better to say so here than
    // to have RunPod reject it after the upload.
    if (f.size > 11 * 1024 * 1024) {
      setAudioErr(`${(f.size / 1e6).toFixed(1)} MB is too big — keep it under about 11 MB.`);
      return;
    }
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    }).catch(() => null);
    if (!data) { setAudioErr("Couldn't read that file."); return; }
    setAudio({ name: f.name, data });
  }
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const FORMS = [
    { k: "wan" as const, label: "WAN 2.2", secs: 8,
      cost: "free · your card", note: "From a still plus a motion prompt. Longest and steadiest." },
    { k: "wan_firstlast" as const, label: "WAN first + last", secs: 8,
      cost: "free · your card", note: "Two stills, WAN moves between them. Most control over where it lands." },
    { k: "ltx" as const, label: "LTX", secs: 4.84,
      cost: "free · your card", note: "Faster and smoother, but drifts and rarely finishes a thought." },
    { k: "grok" as const, label: "Grok Imagine", secs: 8,
      cost: "about $0.40 a clip", note: "Cloud, from a written prompt — no still needed." },
    { k: "vidu" as const, label: "VIDU Q3", secs: 5,
      cost: "$0.75 a clip", note: "Cloud image-to-video: moves the frame under the playhead. Works with every machine at home switched off." },
    { k: "wan25" as const, label: "WAN 2.5", secs: 5,
      cost: "$0.25–$1.50", note: "Cloud image-to-video, and the only lane that lip-syncs to an audio file. Moves the frame under the playhead." },
    { k: "wan26" as const, label: "WAN 2.6 (picture)", secs: 0,
      cost: "$0.03 each", note: "Cloud, but this endpoint makes a STILL, not a clip." },
  ];
  const chosen = FORMS.find(f => f.k === form)!;
  const paid = ["grok", "vidu", "wan25", "wan26"].includes(form);
  // WAN 2.5 bills by size AND length, so the exact figure goes on the button.
  const WAN25: Record<string, Record<number, number>> = {
    "480p": { 5: 0.25, 10: 0.50 },
    "720p": { 5: 0.50, 10: 1.00 },
    "1080p": { 5: 0.75, 10: 1.50 },
  };
  const thisCost = form === "wan25" ? WAN25[size]?.[secs] ?? null : null;
  const box = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
              "focus:outline-none focus:border-[#ff3d6e]";

  return (
    <div onPointerDown={e => e.stopPropagation()}
      className="fixed left-1/2 -translate-x-1/2 z-[205]"
      style={{
        bottom: 24, width: 520,
        background: "rgba(20,20,28,0.9)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: "1px solid #2a2a3a", borderRadius: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.6)", padding: 12,
      }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="label">Generate a clip</span>
        <span className="text-[11px]" style={{ color: "#8a8aa0" }}>lands at {at.toFixed(2)}s</span>
        <button className="btn px-2 py-1 text-[11px] ml-auto" onClick={onClose}>Cancel</button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {FORMS.map(f => (
          <button key={f.k} onClick={() => setForm(f.k)}
            className={"text-left rounded-lg px-2.5 py-2 border " +
              (form === f.k ? "border-[#ff3d6e] bg-white/[0.05]" : "border-[#2a2a3a] hover:bg-white/[0.03]")}>
            <div className="text-sm">{f.label}</div>
            <div className="text-[10px]" style={{ color: f.k === "grok" ? "#ffb03d" : "#8a8aa0" }}>
              {f.secs}s · {f.cost}
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] mb-2" style={{ color: "#8a8aa0" }}>{chosen.note}</p>

      <textarea className={box} rows={3} autoFocus value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="what happens in the shot — the bus pulls away, dust coming up behind it" />

      {form === "wan25" && (
        <div className="rounded-lg border border-[#2a2a3a] p-2 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px]" style={{ color: "#8a8aa0" }}>Lip-sync to audio</span>
            <label className="text-cyan cursor-pointer underline text-[11px]">
              choose a file
              <input type="file" hidden accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/mp4"
                onChange={e => { const f = e.target.files?.[0]; if (f) takeAudio(f); e.currentTarget.value = ""; }} />
            </label>
            {audio && (
              <>
                <span className="text-[11px] truncate max-w-[180px]" style={{ color: "#cfe9f5" }}>{audio.name}</span>
                <button className="btn px-2 py-0.5 text-[10px]" onClick={() => setAudio(null)}>clear</button>
              </>
            )}
          </div>
          <p className="text-[10px] mt-1" style={{ color: "#8a8aa0" }}>
            Optional. With a voice track the mouth follows the words — this is the only
            lane that does it. Without one it just moves. MP3, WAV or M4A.
          </p>
          {audioErr && <p className="text-[11px] mt-1" style={{ color: "#e05c7a" }}>{audioErr}</p>}
        </div>
      )}

      {form === "wan26" && (
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={thenAnimate} onChange={e => setThenAnimate(e.target.checked)} />
          Then move it (WAN 2.5)
          <span className="text-[10px]" style={{ color: "#8a8aa0" }}>
            makes the still, then animates it — one press, two jobs
          </span>
        </label>
      )}

      <div className="flex items-center gap-3 mt-2">
        {paid && (
          <span className="text-[11px]" style={{ color: "#ffb03d" }}>
            {form === "grok" ? "Bills to the xAI account."
              : form === "wan26" && thenAnimate ? "$0.03 + $0.25 — two jobs, bills to RunPod."
              : thisCost != null ? `$${thisCost.toFixed(2)} — bills to RunPod.`
              : "Bills to the RunPod account."}
          </span>
        )}
        {form === "wan25" && (
          <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
            Size
            <select className={box + " mt-1"} value={size} onChange={e => setSize(e.target.value)}>
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
        )}
        {(form === "vidu" || form === "wan25") && (
          <label className="text-[11px]" style={{ color: "#8a8aa0" }}>
            Length
            <select className={box + " mt-1"} value={secs} onChange={e => setSecs(Number(e.target.value))}>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </label>
        )}
        <button className="btn btn-neon ml-auto" disabled={!prompt.trim()}
          onClick={() => onGo(form, prompt.trim(),
            form === "vidu" || form === "wan25" ? secs : chosen.secs, size,
            audio?.data, thenAnimate)}>
          {paid ? "Generate (paid)" : "Queue it"}
        </button>
      </div>
    </div>
  );
}
