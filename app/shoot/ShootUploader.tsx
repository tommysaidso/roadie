"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Check, X, Camera, Loader2, Video } from "lucide-react";
import PhoneCamera, { cameraSupported } from "./PhoneCamera";

// FAN UPLOAD — hand it over, get the multicam back.
//
// This is NOT Floor Studio. A Floor Session is controlled capture: a rehearsal
// room or a board feed, the band's own take, with a whole cleanup chain. This is
// the opposite — a stranger's phone at the back of the room, and the only thing
// asked of them is the file.
//
// So there is no take library, no share button and no editing. A fan does not
// want a library; they want to hand over what they shot and get a multi-camera
// video of the night back. Everything else here is a step between them and that.
//
// The bytes never touch our server: each file gets a presigned URL and goes
// straight to R2. That is what makes a 400 MB clip on a rural connection work
// at all.

type Stop = { id: number; city: string; date: string; venue: string | null };
type Job = {
  file: File; id?: number; pct: number;
  state: "waiting" | "uploading" | "done" | "failed"; error?: string;
  // Set only when this file came out of our own live recorder — the
  // moment Date.now() read when its MediaRecorder actually started.
  startedAtMs?: number;
};

export default function ShootUploader(
  { stops, initialStop, glass = false, shareToken }:
  { stops: Stop[]; initialStop?: number; glass?: boolean; shareToken?: string },
) {
  // In the pop-out the panel IS the card, so the inner cards drop their frame
  // and become plain sections — otherwise it is a box inside a box inside glass.
  const box = glass ? "space-y-4" : "card p-5 space-y-4";
  const shell = glass ? "flex flex-col gap-5" : "flex flex-col gap-5 max-w-2xl";
  const [stopId, setStopId] = useState(String(initialStop || ""));
  const [name, setName] = useState("");
  // Only asked of someone with no ROADIE session (e.g. scanned a QR at the
  // show). Signed-in uploads ignore this field server-side, so it costs a
  // signed-in fan nothing to leave blank — the server never asks for it.
  const [email, setEmail] = useState("");
  const [licence, setLicence] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // A recording just stopped — this drives an impossible-to-miss confirmation
  // panel (progress, then a clear "uploaded" state) instead of leaving someone
  // to notice a small item further down the page right after a full-screen
  // camera view closes.
  const [review, setReview] = useState<{ url: string; filename: string; jobIndex: number } | null>(null);
  // Decided once, client-side only — this is exactly the getUserMedia +
  // MediaRecorder feature-detect, so it is never right on the server render.
  const [hasCamera, setHasCamera] = useState(false);
  // Two separate inputs on purpose. `capture="environment"` on a file input
  // doesn't just hint at the camera on many mobile browsers — it can REMOVE
  // the "choose an existing file" option entirely, forcing camera-only. The
  // "already shot" path needs a plain input with no capture attribute, or it
  // silently tries to force the camera open too.
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHasCamera(cameraSupported()); }, []);

  useEffect(() => {
    fetch("/api/fan-clips").then(r => r.json())
      .then(d => setLicence(d.licence || ""))
      .catch(() => {});
  }, []);

  const setJob = useCallback((i: number, patch: Partial<Job>) => {
    setJobs(p => p.map((j, n) => n === i ? { ...j, ...patch } : j));
  }, []);

  /** One clip: ask for a URL, PUT straight to R2, tell us it landed. */
  async function upload(i: number, job: Job) {
    setJob(i, { state: "uploading", pct: 0 });

    const start = await fetch("/api/fan-clips", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "start", stop_id: Number(stopId),
        filename: job.file.name, mime: job.file.type || "video/mp4",
        uploader_name: name, guest_email: email, licence: true,
        recorded_started_at_ms: job.startedAtMs ?? null,
        k: shareToken || null,
      }),
    }).then(r => r.json()).catch(() => null);

    if (!start?.upload_url) {
      setJob(i, { state: "failed", error: start?.error || "Couldn't start that upload." });
      return;
    }

    // XHR rather than fetch purely for the progress events — a fan on a slow
    // connection watching a dead bar assumes it has frozen and closes the tab.
    //
    // 2026-09-17: a fan on a phone at a live show has a connection that
    // drops mid-transfer for reasons that have nothing to do with us — a
    // wifi/cell handoff, the venue's network getting hammered, the phone
    // sleeping the tab. A single PUT with no retry turned every one of those
    // into a full restart from 0%. The presigned URL is a plain S3 PUT to a
    // fixed key: re-sending it is safe (it just overwrites the same object)
    // and still valid for the URL's 15-minute window, so a transient drop
    // gets three tries before it's shown to the fan as failed.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) setJob(i, { state: "uploading", pct: 0, error: `Connection dropped — retrying (${attempt}/${MAX_ATTEMPTS})…` });
      const ok = await new Promise<boolean>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", start.upload_url);
        xhr.setRequestHeader("Content-Type", job.file.type || "video/mp4");
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setJob(i, { pct: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(true);
          else { setJob(i, { state: "failed", error: `Upload failed (${xhr.status})` }); resolve(false); }
        };
        xhr.onerror = () => resolve(false);
        xhr.send(job.file);
      });
      if (ok) {
        await fetch("/api/fan-clips", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "complete", id: start.id, bytes: job.file.size, guest_email: email }),
        }).catch(() => {});
        setJob(i, { state: "done", pct: 100, id: start.id });
        return;
      }
      if (attempt === MAX_ATTEMPTS) {
        setJob(i, { state: "failed", error: "Connection dropped." });
      }
    }
  }

  async function go(files: FileList | File[] | null, startedAtMs?: number) {
    setErr(null);
    if (!stopId) { setErr("Pick which show this was first."); return; }
    if (!agreed) { setErr("Tick the box so we're allowed to use it."); return; }
    if (!files?.length) return;

    // startedAtMs only ever applies to a single freshly-recorded file, which
    // is the only caller that passes it.
    // Only the live in-app recorder sends an exact clock. For a PICKED file the
    // reliable clock is the video's EMBEDDED creation_time, which the align
    // worker reads server-side (it survives a re-save; File.lastModified does
    // not). So uploads carry no client clock here on purpose.
    const next: Job[] = Array.from(files).map(f => ({ file: f, pct: 0, state: "waiting", startedAtMs }));
    const base = jobs.length;
    setJobs(p => [...p, ...next]);
    // One at a time: a phone pushing six videos at once on a venue's wifi
    // finishes none of them.
    for (let n = 0; n < next.length; n++) await upload(base + n, next[n]);
  }

  /** A clip just came out of the live camera recorder — feed it straight into
   *  the same upload pipeline a picked file would go through, and put up a
   *  full-screen confirmation overlay so "did that work?" is never a
   *  question. The overlay (not the jobs list further down the page) is the
   *  answer to that question, because it doesn't depend on the page being
   *  scrolled to the right place after the full-screen camera view closes. */
  function onRecorded(r: { blob: Blob; mime: string; ext: string; startedAtMs: number }) {
    setCameraOpen(false);
    const filename = `clip-${Date.now()}.${r.ext}`;
    const file = new File([r.blob], filename, { type: r.mime });
    // The real recorded bytes, kept for the "save a copy to your phone too"
    // link — independent of whatever happens to the cloud upload.
    const localUrl = URL.createObjectURL(r.blob);
    setReview({ url: localUrl, filename, jobIndex: jobs.length });
    go([file], r.startedAtMs);
  }

  function closeReview() {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
  }

  const done = jobs.filter(j => j.state === "done").length;

  return (
    <div className={shell}>

      <div className={box}>
        <label className="flex flex-col gap-1">
          <span className="label text-xs">Which show?</span>
          <select className="bg-ink border border-edge px-3 py-2.5 text-sm outline-none focus:border-neon transition-colors"
            value={stopId} onChange={e => setStopId(e.target.value)}>
            <option value="">— pick the night —</option>
            {stops.map(s => (
              <option key={s.id} value={s.id}>
                {s.date} · {s.city}{s.venue ? ` · ${s.venue}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="label text-xs">Your name, for the credits</span>
          <input className="bg-ink border border-edge px-3 py-2.5 text-sm outline-none focus:border-neon transition-colors"
            value={name} onChange={e => setName(e.target.value)} placeholder="how you want to be credited" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="label text-xs">Your email (only if you don&apos;t have a ROADIE account)</span>
          <input type="email" className="bg-ink border border-edge px-3 py-2.5 text-sm outline-none focus:border-neon transition-colors"
            value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
        </label>

        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 shrink-0"
            checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span className="text-muted">{licence || "Loading…"}</span>
        </label>

        {/* `capture="environment"` is a hint to the OS, honoured inconsistently
            across iOS Safari and Android — it is kept here as the fallback
            path, not the main one. getUserMedia() in PhoneCamera is what
            actually and reliably asks the browser for camera + microphone. */}
        <input ref={fileRef} type="file" accept="video/*" capture="environment" multiple className="hidden"
          onChange={e => { go(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />

        {/* Deliberately NO capture attribute — this is the "I already shot it"
            path. Adding capture here would risk the same bug as above: some
            mobile browsers hide the "choose existing file" option entirely
            once capture is present. */}
        <input ref={libraryRef} type="file" accept="video/*" multiple className="hidden"
          onChange={e => { go(e.target.files); if (libraryRef.current) libraryRef.current.value = ""; }} />

        {hasCamera ? (
          <button
            onClick={() => setCameraOpen(true)}
            disabled={!stopId || !agreed}
            className="w-full py-3.5 flex items-center justify-center gap-2 text-base font-black
                       transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#ff3d6e", color: "#0b0b0f", border: "1px solid #ff3d6e",
              boxShadow: "0 4px 18px rgba(255,61,110,0.35)",
            }}
            onMouseEnter={e => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.boxShadow = "0 6px 30px rgba(255,61,110,0.6)";
              e.currentTarget.style.background = "#ff5580";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "0 4px 18px rgba(255,61,110,0.35)";
              e.currentTarget.style.background = "#ff3d6e";
            }}>
            <Video size={18} /> Record a Clip
          </button>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!stopId || !agreed}
            className="w-full py-3.5 flex items-center justify-center gap-2 text-base font-black
                       transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#ff3d6e", color: "#0b0b0f", border: "1px solid #ff3d6e",
              boxShadow: "0 4px 18px rgba(255,61,110,0.35)",
            }}>
            <Camera size={18} /> Pick your clips
          </button>
        )}

        {hasCamera && (
          <button onClick={() => libraryRef.current?.click()} disabled={!stopId || !agreed}
            className="text-xs text-muted underline underline-offset-2 disabled:opacity-40">
            or upload a video you already have
          </button>
        )}

        <p className="text-xs text-muted">
          Send one song at a time rather than the whole set in one file — it uploads faster and
          lines up better. Portrait is fine; we use it for the close-ups.
        </p>
      </div>

      {err && <div className={glass ? "p-3 text-sm" : "card p-3 text-sm"} style={{ color: "#e05c7a" }}>{err}</div>}

      {!!jobs.length && (
        <div className={glass ? "space-y-3 pt-1" : "card p-5 space-y-3"}>
          <div className="flex items-center justify-between">
            <span className="label">Your clips</span>
            <span className="text-xs text-muted">{done} of {jobs.length} in</span>
          </div>
          {jobs.map((j, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="shrink-0">
                {j.state === "done" ? <Check size={16} style={{ color: "#3ddc84" }} />
                  : j.state === "failed" ? <X size={16} style={{ color: "#e05c7a" }} />
                  : j.state === "uploading" ? <Loader2 size={16} className="animate-spin" style={{ color: "#3df0ff" }} />
                  : <Upload size={16} className="text-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{j.file.name}</div>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "#22222e" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${j.pct}%`,
                      background: j.state === "failed" ? "#e05c7a" : j.state === "done" ? "#3ddc84" : "#ff3d6e",
                    }} />
                </div>
                {j.error && <div className="text-xs mt-1" style={{ color: "#e05c7a" }}>{j.error}</div>}
              </div>
              <div className="text-xs text-muted tabular-nums shrink-0 w-10 text-right">
                {j.state === "done" ? "in" : `${j.pct}%`}
              </div>
            </div>
          ))}
        </div>
      )}

      {done > 0 && (
        <div className="p-4" style={{ border: "1px solid rgba(61,220,132,0.45)", boxShadow: "0 0 24px rgba(61,220,132,0.18)" }}>
          <div className="font-black mb-1" style={{ color: "#3ddc84" }}>That's in. Thank you.</div>
          <p className="text-sm text-muted">
            Your footage gets lined up against everyone else's from that night and cut into one
            multi-camera video of the show. You'll be credited as {name || "anonymous"}. Nothing
            else is needed from you.
          </p>
        </div>
      )}

      {cameraOpen && (
        <PhoneCamera onRecorded={onRecorded} onClose={() => setCameraOpen(false)} />
      )}

      {review && (() => {
        const job = jobs[review.jobIndex];
        const state = job?.state ?? "waiting";
        const pct = job?.pct ?? 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
            style={{ background: "rgba(5,5,8,0.92)" }}>
            <div className="w-full max-w-sm p-6 space-y-4" style={{ background: "#0b0b0f", border: "1px solid #22222e" }}>
              {state === "done" ? (
                <div className="flex items-center gap-2">
                  <Check size={22} style={{ color: "#3ddc84" }} />
                  <span className="font-black text-lg">Uploaded</span>
                </div>
              ) : state === "failed" ? (
                <div className="flex items-center gap-2">
                  <X size={22} style={{ color: "#e05c7a" }} />
                  <span className="font-black text-lg">Upload failed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 size={22} className="animate-spin" style={{ color: "#3df0ff" }} />
                  <span className="font-black text-lg">Uploading…</span>
                </div>
              )}

              {state !== "done" && state !== "failed" && (
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#22222e" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "#ff3d6e" }} />
                </div>
              )}

              <p className="text-sm text-muted">
                {state === "done"
                  ? `Your clip is safely in the cloud for the multicam cut. You'll be credited as ${name || "anonymous"}.`
                  : state === "failed"
                  ? (job?.error || "Something went wrong sending it to the cloud. Your recording is still on your phone below — try Save a copy, then try again.")
                  : "Don't close this tab — keep it in the background if you need to, but stay on this page until it says Uploaded."}
              </p>

              <a href={review.url} download={review.filename}
                className="block w-full py-3 text-center text-sm font-bold"
                style={{ border: "1px solid #333", color: "#e8e8f0" }}>
                Save a copy to your phone too
              </a>

              {(state === "done" || state === "failed") && (
                <button onClick={closeReview}
                  className="w-full py-3 text-center text-sm font-black"
                  style={{ background: "#ff3d6e", color: "#0b0b0f" }}>
                  Done
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
