"use client";
import { useEffect, useRef, useState } from "react";

/** Chromatic tuner for the road — mic → autocorrelation pitch detection →
 *  nearest note + cents. Pure Web Audio, no backend. Tune up before the floor
 *  session. */

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const GUITAR = [
  { s: "E", hz: 82.41 }, { s: "A", hz: 110.0 }, { s: "D", hz: 146.83 },
  { s: "G", hz: 196.0 }, { s: "B", hz: 246.94 }, { s: "e", hz: 329.63 },
];

function freqToNote(freq: number) {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const refFreq = 440 * Math.pow(2, (midi - 69) / 12);
  const cents = Math.floor(1200 * Math.log2(freq / refFreq));
  return { name: NOTES[(midi % 12 + 12) % 12], octave: Math.floor(midi / 12) - 1, cents };
}

function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;
  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const b = buf.slice(r1, r2);
  const n = b.length;
  const c = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < n; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return sampleRate / T0;
}

export default function Tuner() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ name: string; octave: number; cents: number } | null>(null);
  const [hz, setHz] = useState(0);
  const [err, setErr] = useState("");
  const [listening, setListening] = useState(false);
  const raf = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null; ctxRef.current = null;
    setListening(false); setNote(null); setHz(0);
  };
  useEffect(() => () => stop(), []);

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setListening(true);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ctx.sampleRate);
        if (f > 0 && f < 2000) { setHz(f); setNote(freqToNote(f)); }
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) {
      setErr(e?.name === "NotAllowedError" ? "mic blocked — allow the microphone to tune" : "no mic found");
      setListening(false);
    }
  };

  const toggle = () => { const next = !open; setOpen(next); if (next) start(); else stop(); };

  const cents = note?.cents ?? 0;
  const inTune = note && Math.abs(cents) <= 5;
  const needle = Math.max(-50, Math.min(50, cents));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">🎸 Tuner{listening && note ? ` — ${note.name}${note.octave}` : ""}</div>
        <button type="button" onClick={toggle} className="pill text-xs text-muted">
          {open ? "stop" : "tune up"}
        </button>
      </div>

      {open ? (
        <div className="space-y-3">
          {err && <div className="text-xs text-red-400">{err}</div>}
          <div className="flex items-center justify-center">
            <div className={`text-center ${inTune ? "text-emerald-400" : "text-white"}`}>
              <div className="text-4xl font-semibold leading-none">
                {note ? note.name : "—"}
                <span className="align-top text-sm text-muted">{note ? note.octave : ""}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted">{hz ? `${hz.toFixed(1)} Hz` : "play a note…"}</div>
            </div>
          </div>
          <div className="relative h-8">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-emerald-400/40" />
            {[-50, -25, 25, 50].map((m) => (
              <div key={m} className="absolute top-1 h-2 w-px bg-white/15" style={{ left: `${50 + m}%` }} />
            ))}
            {note && (
              <div className={`absolute top-0 h-8 w-1 -translate-x-1/2 rounded-full transition-all duration-100 ${
                inTune ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : Math.abs(cents) < 20 ? "bg-yellow-400" : "bg-red-400"}`}
                   style={{ left: `${50 + needle}%` }} />
            )}
            <div className="absolute -bottom-4 left-0 text-[9px] text-muted">♭ flat</div>
            <div className="absolute -bottom-4 right-0 text-[9px] text-muted">sharp ♯</div>
          </div>
          <div className="pt-3 text-center text-[10px]">
            {note ? (inTune ? <span className="text-emerald-400">in tune ✓</span>
              : <span className="text-muted">{cents > 0 ? `${cents}¢ sharp — loosen` : `${Math.abs(cents)}¢ flat — tighten`}</span>)
              : <span className="text-muted">&nbsp;</span>}
          </div>
          <div className="flex justify-center gap-3 border-t border-white/5 pt-2">
            {GUITAR.map((g, i) => (
              <div key={i} className="text-center">
                <div className="text-xs text-white">{g.s}</div>
                <div className="text-[8px] text-muted">{g.hz}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted">Grab your mic and check every string before you track.</div>
      )}
    </div>
  );
}
