"use client";
import { useEffect, useRef, useState } from "react";
import { Video, Circle, Square, RotateCcw, X } from "lucide-react";

// LIVE CAMERA RECORDER — this is what actually asks for the camera and mic.
//
// The file input's `capture="environment"` attribute (still offered as a
// fallback below) is a HINT to the OS, not a request the browser itself makes.
// iOS Safari and Android Chrome honour that hint inconsistently — sometimes it
// opens the camera app, sometimes it opens the photo library, sometimes
// nothing happens at all, and none of that is something a web page controls.
//
// getUserMedia() is the actual browser permission API. Called from a real tap
// (never on page load — both iOS and Android silently refuse that), it is
// what produces the one unambiguous "Allow this site to use your camera and
// microphone?" dialog on every modern mobile browser, over HTTPS. There is no
// more-standard way to ask; if this doesn't prompt, nothing will.
//
// Requires a secure context: HTTPS, or localhost for local dev. A plain-http
// page has no navigator.mediaDevices at all — that check is what the
// unsupported() feature-detect below is really testing.

type Recorded = { blob: Blob; mime: string; ext: string; startedAtMs: number };

function pickMimeType(): { mime: string; ext: string } {
  // Safari (iOS + macOS) records H.264/AAC in an mp4 container; Chrome/Firefox
  // record VP8/9+Opus in webm. Ask in order of what we'd rather have, and let
  // MediaRecorder itself have the final say via isTypeSupported.
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch { /* isTypeSupported itself can throw on very old builds */ }
  }
  // Nothing reported support — let MediaRecorder pick its own default rather
  // than force an option it already said no to.
  return { mime: "", ext: "webm" };
}

export function cameraSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== "undefined";
}

export default function PhoneCamera(
  { onRecorded, onClose }: { onRecorded: (r: Recorded) => void; onClose: () => void },
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  // The phone's own wall-clock moment recording actually starts — not the
  // file's container metadata (that gets ignored downstream; see
  // align-fan-clips.py for why phone file timestamps can't be trusted).
  // This is a value we capture ourselves at the one moment we know it's
  // true, sent up as plain data alongside the clip.
  const startedAtRef = useRef<number>(0);

  const [phase, setPhase] = useState<"opening" | "live" | "recording" | "error">("opening");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  async function open(mode: "environment" | "user") {
    setPhase("opening"); setError(null);
    // Stop whatever we were already holding before asking for a new stream —
    // a phone only ever grants one active camera stream to a tab at a time,
    // and switching cameras means releasing the old one first.
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      // video + audio in ONE call: that is what produces a single combined
      // permission prompt instead of two separate ones.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("live");
    } catch (e: any) {
      const name = e?.name || "";
      const msg =
        name === "NotAllowedError" ? "Camera access was blocked. Check your browser's site settings and allow camera + microphone, then try again."
        : name === "NotFoundError" ? "No camera found on this device."
        : name === "NotReadableError" ? "Another app has the camera right now — close it and try again."
        : "Couldn't open the camera. You can still upload a video instead, below.";
      setError(msg);
      setPhase("error");
    }
  }

  useEffect(() => {
    open("environment");
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const { mime } = pickMimeType();
    chunksRef.current = [];
    const rec = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    startedAtRef.current = Date.now();
    rec.start(1000); // timesliced so a crash/backgrounding doesn't lose everything
    recorderRef.current = rec;
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(s => s + 1), 1000);
    setPhase("recording");
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    rec.onstop = () => {
      // Trust what the recorder actually reports it encoded, not what we
      // guessed beforehand — a browser can silently pick something other than
      // our first-choice mimeType, and naming the file wrong (an mp4-encoded
      // blob saved as .webm, say) is exactly the kind of thing that looks fine
      // right up until something downstream tries to read the bytes.
      const actualMime = rec.mimeType || pickMimeType().mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type: actualMime });
      const ext = actualMime.includes("mp4") ? "mp4" : actualMime.includes("webm") ? "webm" : "mp4";
      onRecorded({ blob, mime: actualMime, ext, startedAtMs: startedAtRef.current });
    };
    rec.stop();
  }

  function flipCamera() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    open(next);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        {/* playsInline is required on iOS — without it Safari takes the video
            fullscreen with its own native controls and this UI never shows. */}
        <video ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-cover" />

        {phase === "opening" && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            Asking for camera + microphone…
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm text-center text-white text-sm space-y-3">
              <p>{error}</p>
              <button className="btn px-4 py-2 text-xs" onClick={() => open(facing)}>Try again</button>
            </div>
          </div>
        )}

        {phase === "recording" && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.6)" }}>
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#ff3d6e" }} />
            <span className="text-white text-sm tabular-nums">{mm}:{ss}</span>
          </div>
        )}

        <button onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <X size={18} color="#fff" />
        </button>
      </div>

      <div className="shrink-0 flex items-center justify-center gap-8 py-6" style={{ background: "#0b0b0f" }}>
        {phase === "live" && (
          <>
            <button onClick={flipCamera} className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ border: "1px solid #333" }} aria-label="Flip camera">
              <RotateCcw size={18} color="#8a8aa0" />
            </button>
            <button onClick={startRecording}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#ff3d6e", boxShadow: "0 0 0 4px rgba(255,61,110,0.25)" }}
              aria-label="Start recording">
              <Circle size={28} color="#0b0b0f" fill="#0b0b0f" />
            </button>
            <div className="w-11" />
          </>
        )}
        {phase === "recording" && (
          <button onClick={stopRecording}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#fff" }} aria-label="Stop recording">
            <Square size={26} color="#ff3d6e" fill="#ff3d6e" />
          </button>
        )}
        {(phase === "opening" || phase === "error") && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Video size={14} /> waiting on the camera…
          </div>
        )}
      </div>
    </div>
  );
}
