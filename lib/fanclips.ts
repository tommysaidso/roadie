// FAN MULTICAM — intake, rights, and the alignment workorder.
//
// Every phone in the room is a camera. Fans upload what they shot, the system
// lines every clip up against the others BY THE AUDIO, and the night can be cut
// as a real multi-camera shoot: verticals as the punch-ins, the wide left wide.
// What the fan gets back is a proper multi-cam video of the night they were at.
//
// Audio is the sync track because it is the only thing every clip shares.
// Phones have no common clock and their timestamps lie, but they all recorded
// the same room — so alignment is expressed as an offset in milliseconds from
// one reference clip.
//
// THREE JOBS, AND DELIBERATELY NOT A FOURTH:
//   1. Hand the phone a URL that uploads STRAIGHT TO R2, never through us.
//   2. Record who shot it and exactly what licence they granted.
//   3. Ask a machine that has ffmpeg to work out the offsets.
//
// It does not cut video. Alignment DOES run here — ffmpeg is in the image for
// it — but assembling a finished multicam is a bigger job and is deliberately
// left to the cut sheet and an editor. An upload button that silently did
// nothing would be worse than an honest boundary.

import { all, one, run } from "@/lib/db";
import { presign, fanClipKey, r2Configured } from "@/lib/r2";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

/** Where the job record is written. Kept as an audit trail and a manual re-run hook. */
export const JOBS_DIR = process.env.ROADIE_RENDER_JOBS_DIR || "/pool/jobs";

const VIDEO = /\.(mp4|mov|m4v|webm)$/i;

/** The licence a fan grants by uploading. Stored verbatim on every clip. */
export const LICENCE_TEXT =
  "I filmed this myself. I give ROADIE permission to use it in videos of this " +
  "show, including video shared publicly, and to credit me by the name I gave. " +
  "ROADIE also reads basic technical details from my upload, like when my " +
  "phone started recording, to line my clip up against everyone else's for " +
  "the edit. I keep ownership of my own footage and can ask for it to be " +
  "removed at any time.";

export function storageReady() { return r2Configured(); }

/**
 * Step one: mint an upload URL.
 *
 * The row is created FIRST, in `pending`, so the clip id can namespace the R2
 * key. A row with no object is harmless and gets swept; an object with no row
 * would be an orphan nobody can find or delete.
 *
 * The licence is taken here rather than after the upload, because a fan who
 * closes the app mid-upload must never leave us holding footage we have no
 * permission to use.
 */
export function startUpload(opts: {
  stopId: number; setId: number | null; userId: number | null;
  filename: string; mime: string; uploaderName: string; licenceGranted: boolean;
  // A QR-code guest has no ROADIE account and nothing else to identify them by
  // — this is how we reach them and how a later "complete" call proves it was
  // theirs. Signed-in uploads leave it null; userId is enough for them.
  guestEmail?: string | null;
  // The phone's OWN Date.now() at the moment it started recording — captured
  // client-side in PhoneCamera.tsx. Never the file's own container metadata;
  // that is already, correctly, ignored downstream (see align-fan-clips.py).
  // Null for anything not shot in our recorder (a picked-from-library file).
  recordedStartedAtMs?: number | null;
}) {
  if (!r2Configured()) {
    return { ok: false as const, error: "Storage is not configured yet." };
  }
  if (!opts.licenceGranted) {
    return { ok: false as const, error: "We can only take footage you give us permission to use." };
  }
  if (!opts.userId && !opts.guestEmail) {
    return { ok: false as const, error: "Sign in, or leave an email so we can reach you." };
  }
  const name = path.basename(String(opts.filename || "clip.mp4")).replace(/[^\w.\- ]+/g, "_").slice(-120);
  if (!VIDEO.test(name)) {
    return { ok: false as const, error: "That is not a video we can read. MP4 or MOV works best." };
  }
  if (!opts.stopId) return { ok: false as const, error: "Which show was this?" };

  const r = run(
    `INSERT INTO fan_clips
       (set_id, stop_id, user_id, path, original_name, mime,
        uploader_name, guest_email, licence_granted, licence_text, licence_at, status,
        recorded_started_at_ms)
     VALUES(?,?,?,?,?,?,?,?,1,?,datetime('now'),'pending',?)`,
    opts.setId, opts.stopId, opts.userId, "", name, opts.mime || "video/mp4",
    String(opts.uploaderName || "").slice(0, 80), opts.guestEmail || null, LICENCE_TEXT,
    opts.recordedStartedAtMs || null,
  );
  const id = Number(r.lastInsertRowid);
  const key = fanClipKey(opts.stopId, id, name);
  run(`UPDATE fan_clips SET path=? WHERE id=?`, key, id);

  // Fifteen minutes is enough for a long upload on a bad rural connection and
  // short enough that a leaked URL is not a standing hole.
  const url = presign("PUT", key, { expiresIn: 900, contentType: opts.mime || "video/mp4" });
  if (!url) return { ok: false as const, error: "Could not prepare the upload." };

  return { ok: true as const, id, key, url, licence: LICENCE_TEXT };
}

/**
 * Step two: the phone reports the upload finished.
 *
 * Trusting the client that the bytes landed is acceptable here — the worst case
 * is a row pointing at a missing object, which the aligner reports as failed.
 * Verifying server-side would mean a HEAD to R2 on every upload for very little.
 */
export function completeUpload(id: number, bytes?: number) {
  const clip = one<any>(`SELECT * FROM fan_clips WHERE id = ?`, id);
  if (!clip) return { ok: false as const, error: "No such clip." };
  run(`UPDATE fan_clips SET status='uploaded', bytes=? WHERE id=?`, bytes ?? null, id);
  return { ok: true as const };
}

/** A short-lived link to watch or download one clip. */
export function clipUrl(clip: { path: string }, expiresIn = 3600) {
  return presign("GET", clip.path, { expiresIn });
}

export function clipsForSet(setId: number) {
  return all<any>(
    `SELECT * FROM fan_clips WHERE set_id=? AND status NOT IN ('removed') ORDER BY id`, setId);
}

export function clipsForStop(stopId: number) {
  return all<any>(
    `SELECT * FROM fan_clips WHERE stop_id=? AND status NOT IN ('removed') ORDER BY id`, stopId);
}

export function sets() {
  return all<any>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM fan_clips c WHERE c.set_id=s.id AND c.status='uploaded') AS clips,
            (SELECT COUNT(*) FROM fan_clips c WHERE c.set_id=s.id AND c.align_status='ok') AS aligned
       FROM multicam_sets s ORDER BY s.created_at DESC`);
}

/**
 * Align a set. Runs HERE, in the container, not on anybody's desktop.
 *
 * ffmpeg is in the image for exactly this. An earlier version dropped a
 * workorder for a worker on a workstation to pick up, which meant the feature
 * silently stopped whenever that machine was asleep — the opposite of the point
 * of running a platform in the first place.
 *
 * The workorder file is still written, because it is a useful record of what was
 * asked and it lets a job be re-run by hand. But the aligner is started
 * immediately and detached, so nothing depends on anything outside this box.
 *
 * The presigned GETs last six hours: long enough for a big set on slow storage,
 * short enough that a leaked job file is not a standing key to the footage.
 */
export function queueAlignment(setId: number) {
  const set = one<any>(`SELECT * FROM multicam_sets WHERE id=?`, setId);
  if (!set) return { ok: false as const, error: "No such set." };

  const clips = clipsForSet(setId).filter((c: any) => c.status === "uploaded");
  if (clips.length < 2) {
    return { ok: false as const, error: "Alignment needs at least two uploaded clips — one camera is not a multicam." };
  }

  const pending = path.join(JOBS_DIR, "pending");
  try { fs.mkdirSync(pending, { recursive: true }); }
  catch (e: any) { return { ok: false as const, error: `Job folder unreachable: ${e?.message || e}` }; }

  const job = {
    kind: "fan_multicam_align",
    set_id: setId,
    // Internal: the worker is in this container, so it talks to the app over
    // loopback rather than out through the tunnel and back in again.
    callback: `${(process.env.ROADIE_INTERNAL_URL || "http://127.0.0.1:3001").replace(/\/$/, "")}/api/admin/multicam`,
    clips: clips.map((c: any) => ({
      id: c.id,
      name: c.original_name,
      url: presign("GET", c.path, { expiresIn: 6 * 3600 }),
      // The metadata timeline signal — null for anything not shot in our
      // recorder. The aligner uses it to seed/validate the audio search and
      // as the fallback placement when a clip's audio can't be read.
      recorded_started_at_ms: c.recorded_started_at_ms ?? null,
    })),
    created_at: new Date().toISOString(),
  };
  const name = `align-set-${setId}-${Date.now().toString(36)}.json`;
  try { fs.writeFileSync(path.join(pending, name), JSON.stringify(job, null, 2)); }
  catch (e: any) { return { ok: false as const, error: `Could not queue: ${e?.message || e}` }; }

  run(`UPDATE multicam_sets SET status='aligning' WHERE id=?`, setId);

  // Start the aligner and walk away. Detached with its output discarded so a
  // long job can outlive the request that asked for it — a set of twenty clips
  // takes minutes, and nobody is holding an HTTP connection open for that.
  try {
    const child = spawn("python3", ["scripts/align-fan-clips.py", "--once"], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
  } catch (e: any) {
    // The job file is on disk either way, so this is recoverable by hand
    // rather than lost. Say so instead of reporting a success that never ran.
    return { ok: false as const, error: `Queued but could not start the aligner: ${e?.message || e}` };
  }

  return { ok: true as const, job: name, clips: clips.length };
}

/**
 * The worker reports back here.
 *
 * A weak score is recorded rather than discarded. The maths being unsure does
 * not make a clip useless — an operator can still place it by hand — and hiding
 * the uncertainty would be worse than showing it.
 */
export function applyAlignment(setId: number, referenceClipId: number, results: Array<{
  id: number; offset_ms: number; score: number; duration_ms?: number;
  width?: number; height?: number; has_audio?: boolean; first_onset_ms?: number;
  align_method?: string;
}>) {
  for (const r of results) {
    const orientation = r.width && r.height ? (r.height > r.width ? "vertical" : "wide") : null;
    // A clock-placed clip (audio unusable or untrustworthy, metadata plausible)
    // is real progress over dumping it at offset 0 with no confidence — call it
    // "weak" rather than "failed", but never "ok": nothing has confirmed the
    // placement against the room's own sound, so an operator should still spot-
    // check it before trusting the cut.
    const status = r.align_method === "clock" ? "weak"
      : !r.has_audio ? "failed"
      : r.score >= 0.5 ? "ok"
      : r.score > 0 ? "weak" : "failed";
    run(
      `UPDATE fan_clips
          SET offset_ms=?, align_score=?, align_status=?, duration_ms=?,
              width=?, height=?, orientation=?, has_audio=?, first_onset_ms=?,
              align_method=?
        WHERE id=? AND set_id=?`,
      Math.round(r.offset_ms || 0), r.score ?? 0, status,
      r.duration_ms ?? null, r.width ?? null, r.height ?? null,
      orientation, r.has_audio ? 1 : 0, r.first_onset_ms ?? null,
      r.align_method || null, r.id, setId,
    );
  }
  const ok = one<any>(`SELECT COUNT(*) n FROM fan_clips WHERE set_id=? AND align_status='ok'`, setId)?.n ?? 0;
  run(`UPDATE multicam_sets SET reference_clip_id=?, status=?, aligned_at=datetime('now') WHERE id=?`,
      referenceClipId, ok >= 2 ? "aligned" : "failed", setId);
  return { ok: true as const, aligned: ok };
}

/**
 * The cut sheet: every aligned clip on one timeline.
 *
 * This is the contract between alignment and the edit. `starts_at_ms` is where
 * the clip sits on the SET's timeline, so a cutter never has to know anything
 * about how the offsets were found.
 *
 * One clip is flagged as the audio bed — the longest by default. The cut takes
 * ALL of its sound from that one source and never switches, because cutting
 * between phone mics is audible on every edit and sounds like a fault.
 */
export function cutSheet(setId: number) {
  const set = one<any>(`SELECT * FROM multicam_sets WHERE id=?`, setId);
  if (!set) return null;
  const usable = clipsForSet(setId)
    .filter((c: any) => ["ok", "weak"].includes(c.align_status) && c.status !== "hidden");
  // Longest wins the audio, unless the operator nominated one.
  const bedId = set.audio_bed_clip_id ||
    usable.slice().sort((a: any, b: any) => (b.duration_ms || 0) - (a.duration_ms || 0))[0]?.id;
  const clips = usable
    .map((c: any) => ({
      id: c.id,
      uploader: c.uploader_name,
      orientation: c.orientation,
      role: c.orientation === "vertical" ? "punch-in" : "wide",
      starts_at_ms: c.offset_ms || 0,
      ends_at_ms: (c.offset_ms || 0) + (c.duration_ms || 0),
      confidence: c.align_score,
      align_method: c.align_method,
      // On the SET timeline, not inside the clip — where the first hit lands.
      first_onset_ms: c.first_onset_ms == null ? null : (c.offset_ms || 0) + c.first_onset_ms,
      is_audio_bed: c.id === bedId,
      url: clipUrl(c, 6 * 3600),
    }))
    .sort((a: any, b: any) => a.starts_at_ms - b.starts_at_ms);
  return { set, clips, span_ms: Math.max(0, ...clips.map((c: any) => c.ends_at_ms)) };
}


/**
 * Render the cut. Runs in this container, like the aligner.
 *
 * Detached on purpose: a twenty-clip set is minutes of ffmpeg and nobody is
 * holding an HTTP request open for that. Progress is reported through
 * `render_status` on the set rather than a live connection.
 */
export function renderCut(setId: number, opts: { segmentSec?: number } = {}) {
  const set = one<any>(`SELECT * FROM multicam_sets WHERE id=?`, setId);
  if (!set) return { ok: false as const, error: "No such set." };

  const ready = one<any>(
    `SELECT COUNT(*) n FROM fan_clips
      WHERE set_id=? AND align_status IN ('ok','weak') AND status!='hidden'`, setId)?.n ?? 0;
  if (ready < 2) {
    return { ok: false as const, error: "Align the set first — a cut needs at least two placed clips." };
  }
  if (set.render_status === "rendering") {
    return { ok: false as const, error: "That set is already rendering." };
  }

  run(`UPDATE multicam_sets SET render_status='rendering', render_note=NULL WHERE id=?`, setId);

  const args = ["scripts/cut-multicam.py", "--set", String(setId)];
  if (opts.segmentSec) args.push("--segment", String(opts.segmentSec));

  try {
    const child = spawn("python3", args, {
      cwd: process.cwd(), detached: true, stdio: "ignore", env: { ...process.env },
    });
    child.unref();
  } catch (e: any) {
    run(`UPDATE multicam_sets SET render_status='failed', render_note=? WHERE id=?`,
        `could not start the cutter: ${e?.message || e}`, setId);
    return { ok: false as const, error: `Could not start the cutter: ${e?.message || e}` };
  }
  return { ok: true as const, rendering: true };
}

/** Where a finished cut lives in R2. */
export function cutKey(setId: number) {
  const prefix = (process.env.R2_PREFIX || "roadie/fanclips").replace(/^\/|\/$/g, "");
  return `${prefix}/cuts/set-${setId}.mp4`;
}

export function cutUploadUrl(setId: number) {
  const key = cutKey(setId);
  // Thirty minutes: the cutter uploads a finished file that can be large.
  return { key, url: presign("PUT", key, { expiresIn: 1800, contentType: "video/mp4" }) };
}

export function finishRender(setId: number, ok: boolean, key?: string, bytes?: number, note?: string) {
  if (ok && key) {
    run(`UPDATE multicam_sets
            SET output_key=?, output_bytes=?, render_status='done',
                render_note=NULL, rendered_at=datetime('now')
          WHERE id=?`, key, bytes ?? null, setId);
  } else {
    run(`UPDATE multicam_sets SET render_status='failed', render_note=? WHERE id=?`,
        String(note || "render failed"), setId);
  }
  return { ok: true as const };
}

/** A link to watch the finished cut. */
export function cutWatchUrl(setId: number) {
  const set = one<any>(`SELECT output_key FROM multicam_sets WHERE id=?`, setId);
  if (!set?.output_key) return null;
  return presign("GET", set.output_key, { expiresIn: 6 * 3600 });
}
