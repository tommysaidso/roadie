"""
FAN MULTICAM ALIGNER — works out where every phone was in time.

Runs INSIDE the ROADIE container; ffmpeg is in the image for it. It reads a
workorder, correlates every clip against a reference, and posts the offsets back
to the API.

    python3 scripts/align-fan-clips.py --once
    python3 scripts/align-fan-clips.py --watch

HOW THE SYNC WORKS

Phones share no clock and their FILE's own timestamps lie — that is still
true and still ignored completely. What every clip shares is the room, so
the sound is the primary sync track.

But NOT the loudness. See onset_envelope() below for the full reasoning — the
short version is that applause is the enemy and the kick drum is the friend.
Applause is decorrelated between microphones and swamps a loudness envelope;
percussive attacks are impulses that hit every mic with a fixed delay and give a
sharp, unambiguous peak. The first downbeat of a song is the clapper board of a
show that never had one.

THE METADATA TIMELINE — a second, independent signal, not a replacement

A clip's clock comes from one of two places, in order of trust:
  (a) `recorded_started_at_ms` — Date.now() read by our OWN recorder the
      instant its MediaRecorder started (PhoneCamera.tsx). Most trusted.
  (b) the video's EMBEDDED container `creation_time` (ffprobe) — used for
      UPLOADED clips that never went through our recorder (Mike's phone
      footage). Once distrusted as "garbage", but it is the only clock an
      uploaded original carries, it survives a re-save (File.lastModified does
      not), and the audio search + a 5s tolerance window below guard against a
      bad value — a wrong clock only ever seeds a window audio must confirm.
recorder the instant its MediaRecorder actually started — captured
client-side in PhoneCamera.tsx and sent up as plain data. Modern phones
keep network-synced clocks, so two phones' recordings of the same room
typically agree to within a couple of seconds — nowhere near frame-accurate,
but plenty to answer "is the audio result even plausible."

This buys two things audio alone cannot:
  1. A windowed search. The blind cross-correlation below sweeps 60 seconds
     each way, and a live set can easily repeat a riff or chorus inside that
     window — a confident-looking match on the WRONG repeat is a real risk
     with audio alone. A metadata window lets the search look where the
     clock says the truth actually is, first.
  2. A fallback when the audio is the thing that's broken — wind across the
     mic, someone's thumb over it, a genuinely silent clip. Today that clip
     gets dumped at offset 0 with zero confidence, which is worse than a
     clock-placed guess. See `resolve_offset()`.

The floor below stays the same either way.

THE FLOOR ON ACCURACY IS PHYSICS, NOT THE ALGORITHM

Sound travels about 343 m/s. Two phones thirty metres apart in the same hall
hear the same snare roughly 87 ms apart, which is two to three frames at 30 fps.
That is not error we can remove — the phones genuinely recorded different
moments — and no amount of processing will beat it. What alignment gives us is
each camera placed against one timeline to within a few frames, which is what a
cut needs. Anyone expecting frame-exact sync from a room full of phones is
expecting something the speed of sound does not permit.

Confidence is reported honestly. Below 0.5 is marked weak rather than discarded,
because an operator can still place a clip the maths was unsure about.
"""

import argparse, json, os, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path

JOBS_DIR = Path(os.environ.get("ROADIE_RENDER_JOBS_DIR", r"\\DXP4800UARX\Unreal_Nas\GenAi\ComfyUI\jobs"))
SECRET = os.environ.get("ROADIE_WORKER_SECRET", "")
SR = 8000          # plenty for an energy envelope; keeps the maths fast
FRAME = 80         # 10 ms at 8 kHz


def _creation_ms(data):
    """Embedded container/stream creation_time (ISO 8601) as epoch ms, or None.
    The clock for UPLOADED clips that carry no recorder timestamp — an original
    phone file records this at capture and it survives a re-save."""
    from datetime import datetime, timezone
    tags = (data.get("format", {}) or {}).get("tags", {}) or {}
    cands = [tags.get("creation_time")]
    for s in data.get("streams", []) or []:
        cands.append((s.get("tags") or {}).get("creation_time"))
    for t in cands:
        if not t:
            continue
        try:
            dt = datetime.fromisoformat(str(t).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        except Exception:
            continue
    return None


def ffprobe(path):
    """Duration, dimensions, audio presence, and embedded creation_time."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json",
         "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        return None
    data = json.loads(out.stdout or "{}")
    v = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    a = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    dur = float(data.get("format", {}).get("duration") or 0)

    w = int(v.get("width") or 0) if v else 0
    h = int(v.get("height") or 0) if v else 0
    # A phone shot upright often reports landscape dimensions plus a rotation.
    # Without this every vertical clip is misfiled as a wide and ends up used as
    # the wrong kind of shot in the cut.
    rot = 0
    if v:
        rot = abs(int((v.get("side_data_list") or [{}])[0].get("rotation", 0) or 0))
        if not rot:
            rot = abs(int((v.get("tags") or {}).get("rotate", 0) or 0))
    if rot in (90, 270):
        w, h = h, w

    return {"duration_ms": int(dur * 1000), "width": w, "height": h, "has_audio": bool(a),
            "creation_ms": _creation_ms(data)}


def onset_envelope(path):
    """
    An ONSET-STRENGTH envelope: where the attacks are, not how loud it is.

    THIS IS THE WHOLE TRICK, so it is worth writing down why.

    A plain loudness envelope fails on live music because APPLAUSE dominates it.
    Applause is a diffuse field — every person claps at a different instant near
    a different phone — so it is decorrelated between microphones, which is the
    one property correlation depends on. It is also loud and sustained, so it
    swamps the music and produces a broad, flat correlation peak. A "match" on
    applause is ambiguous by tens or hundreds of milliseconds.

    Percussive attacks are the opposite. A kick or a snare is an impulse: it
    leaves the stage once and arrives at every microphone with a fixed delay, so
    it produces a SHARP peak. It is the slate — the clapper board of a show that
    never had one.

    So: differentiate the waveform (a cheap high-pass that kills room rumble and
    emphasises attacks), take a short-frame RMS, then keep only the POSITIVE
    frame-to-frame change. Sustained sound — applause, crowd noise, a held chord
    — barely changes frame to frame, so it contributes almost nothing. A drum
    hit is a spike.

    Nothing heavier is needed. Demucs would separate the drums properly and
    would work, but it wants torch, a few hundred megabytes of model and a GPU
    to be quick. This gets the same benefit for the cost of a subtraction.
    """
    with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as tmp:
        raw = tmp.name
    try:
        r = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-vn",
             # Band-limit before anything else: below ~90 Hz is handling rumble
             # and stage thump, above ~7 kHz on a phone mic is mostly hiss.
             "-af", "highpass=f=90,lowpass=f=7000",
             "-ac", "1", "-ar", str(SR), "-f", "s16le", "-y", raw],
            capture_output=True,
        )
        if r.returncode != 0:
            return None
        data = Path(raw).read_bytes()
    finally:
        try: os.unlink(raw)
        except OSError: pass

    import array, math
    pcm = array.array("h")
    pcm.frombytes(data[: len(data) - (len(data) % 2)])
    if len(pcm) < SR:                      # under a second is not worth aligning
        return None

    # First difference — emphasises attacks, kills anything slow-moving.
    diff = [0.0] * len(pcm)
    prev = 0
    for i, v in enumerate(pcm):
        diff[i] = float(v - prev)
        prev = v

    # Short-frame energy of the differentiated signal.
    energy = []
    for i in range(0, len(diff) - FRAME, FRAME):
        acc = 0.0
        for n in range(i, i + FRAME):
            acc += diff[n] * diff[n]
        energy.append(math.sqrt(acc / FRAME))

    if len(energy) < 20:
        return None

    # Half-wave rectified difference: rising edges only. This is what makes
    # applause almost invisible and a kick drum unmistakable.
    onset = [0.0]
    for i in range(1, len(energy)):
        onset.append(max(0.0, energy[i] - energy[i - 1]))

    # SMOOTH THE SPIKES. An onset envelope is nearly all zeros with one- or
    # two-frame spikes on the hits, and correlating two sparse spike trains is
    # brittle: a coarse search steps straight over the true peak and reports a
    # confident match on the wrong beat. Widening each hit to ~50 ms gives the
    # correlation something to grip while keeping the peak sharp enough to be
    # worth having. Measured: without this the search missed by a whole beat.
    K = 5
    sm = []
    for i in range(len(onset)):
        lo = max(0, i - K // 2)
        hi = min(len(onset), i + K // 2 + 1)
        sm.append(sum(onset[lo:hi]) / (hi - lo))
    onset = sm

    peak = max(onset) or 1.0
    onset = [o / peak for o in onset]

    # If nothing stands out, there are no usable transients — a clip of pure
    # crowd noise, or someone filming the ceiling from the bar. Say so rather
    # than returning a flat line that will correlate with anything.
    strong = sum(1 for o in onset if o > 0.25)
    if strong < 8:
        return None

    return onset


def first_onset_frame(onset, thresh=0.35):
    """
    The first real hit — the clapper mark.

    Worth recording separately because the music often does not start when the
    recording does. Somebody films two minutes of the singer talking before a
    drum is touched. Alignment does not care, but an edit does: if a cut began
    at the first downbeat it would throw away the introduction, which is
    frequently the best thing in the clip. So we mark it and let the cutter
    decide, with a pre-roll in front of it.
    """
    for i, o in enumerate(onset):
        if o >= thresh:
            return i
    return 0


def best_offset(ref, other, max_lag_frames=6000, window=None):
    """
    Normalised cross-correlation. Returns (offset_frames, score 0..1).

    max_lag defaults to 60 seconds either way — beyond that it is not the same
    moment of the same song and a "match" would be a coincidence.

    `window`, if given, is an (expected_lag, tolerance) pair in frames — the
    metadata timeline's guess at where the true offset is. Restricting the
    search to that band first, rather than sweeping the full 60 seconds, is
    what keeps a repeated riff or chorus elsewhere in the song from winning a
    confident-looking match on the wrong repeat.
    """
    n, m = len(ref), len(other)
    if n < 50 or m < 50:
        return 0, 0.0

    def norm(v):
        mu = sum(v) / len(v)
        c = [x - mu for x in v]
        mag = sum(x * x for x in c) ** 0.5 or 1.0
        return c, mag

    def score_at(lag):
        a_start = max(0, lag)
        b_start = max(0, -lag)
        span = min(n - a_start, m - b_start)
        if span < 100:                      # under a second of overlap proves nothing
            return -1.0
        a, amag = norm(ref[a_start:a_start + span])
        b, bmag = norm(other[b_start:b_start + span])
        dot = sum(x * y for x, y in zip(a, b))
        sc = dot / (amag * bmag)
        # Short overlaps correlate well by accident. Weight by how much of the
        # shorter clip actually took part.
        return sc * min(1.0, span / max(100, min(n, m)))

    full_lo, full_hi = -min(max_lag_frames, m - 1), min(max_lag_frames, n - 1)
    if window is not None:
        expected, tol = window
        lo, hi = max(full_lo, expected - tol), min(full_hi, expected + tol)
        if lo >= hi:                        # the window fell entirely outside range
            lo, hi = full_lo, full_hi
    else:
        lo, hi = full_lo, full_hi

    # Coarse sweep, then a DENSE refine around the best few candidates. The
    # refine window has to be at least as wide as the coarse step or the search
    # can never correct a step it landed next to — that was the original fault.
    COARSE = 4
    cand = []
    for lag in range(lo, hi, COARSE):
        cand.append((score_at(lag), lag))
    if not cand:                            # window narrower than one coarse step
        cand = [(score_at(lo), lo)]
    cand.sort(reverse=True)

    best, best_lag = -1.0, 0
    for _, lag0 in cand[:5]:                # a few peaks, not just the tallest
        for lag in range(lag0 - COARSE * 2, lag0 + COARSE * 2 + 1):
            if lag < lo or lag > hi:
                continue
            sc = score_at(lag)
            if sc > best:
                best, best_lag = sc, lag

    return best_lag, max(0.0, min(1.0, best))


CLOCK_TOLERANCE_MS = 5000   # generous: NTP drift + tap-to-record latency, not physics
CLOCK_TOLERANCE_FRAMES = CLOCK_TOLERANCE_MS // 10


def metadata_window(ref_started_ms, other_started_ms, ref_dur_ms, other_dur_ms):
    """
    Turn two Date.now() readings into a search window in frames, or None if
    the clocks aren't usable for this pair.

    Two clips of the SAME room have to overlap in wall-clock time — if the
    gap between their reported start times is bigger than both clips put
    together, they could not possibly have recorded the same moment, which
    means a clock is wrong (phone's date/time off, auto-time disabled) rather
    than that the show has some very unusual geometry. Trust nothing in that
    case rather than seed a search with a lie.
    """
    if not ref_started_ms or not other_started_ms:
        return None
    expected_ms = other_started_ms - ref_started_ms
    if abs(expected_ms) >= (ref_dur_ms + other_dur_ms + 1):
        return None
    return int(round(expected_ms / 10)), CLOCK_TOLERANCE_FRAMES


def resolve_offset(ref_env, other_env, ref_started_ms, other_started_ms, ref_dur_ms, other_dur_ms):
    """
    THE ACTUAL DECISION: which signal do we trust for this clip.

    Runs a windowed audio search first when the clock gives us a plausible
    window — cheaper than the blind 60-second sweep and much less likely to
    lock onto the wrong repeat of a riff. If that's confident, done: audio
    and clock agree, this is as good as this pipeline gets.

    If the windowed search comes up weak, fall back to the full blind sweep
    (today's behaviour) as a second opinion. A confident full-sweep result
    that lands OUTSIDE what the clock allows is exactly the "audio's fucked"
    case worth naming: either it locked onto the wrong beat, or the clip's
    audio is garbage in a way that happens to correlate anyway. Either way,
    an unverified audio lock is worse than a clock-placed clip that says
    plainly it hasn't been confirmed by sound — so the clock wins that fight.

    Returns (offset_ms, score, method) where method is "audio" or "clock".
    """
    window = metadata_window(ref_started_ms, other_started_ms, ref_dur_ms, other_dur_ms)

    if window is not None:
        lag_w, score_w = best_offset(ref_env, other_env, window=window)
        if score_w >= 0.5:
            return lag_w * 10, score_w, "audio"

        lag_b, score_b = best_offset(ref_env, other_env)
        agrees = abs(lag_b - window[0]) <= window[1] * 2
        if score_b >= 0.5 and agrees:
            return lag_b * 10, score_b, "audio"
        if score_b >= 0.5:
            # Confident, but nowhere near where the clocks say it should be —
            # an unverifiable lock. Prefer the clock and say so plainly.
            return window[0] * 10, max(score_w, 0.0), "clock"
        # Weak everywhere. Still worth placing roughly rather than at 0.
        return window[0] * 10, max(score_w, score_b, 0.0), "clock"

    # No usable clock for this pair — exactly today's blind full search.
    lag_b, score_b = best_offset(ref_env, other_env)
    return lag_b * 10, score_b, "audio"


def fetch(url, dest):
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)


def run_job(job_path: Path):
    job = json.loads(job_path.read_text(encoding="utf-8"))
    if job.get("kind") != "fan_multicam_align":
        return False

    set_id = job["set_id"]
    print(f"[align] set {set_id}: {len(job['clips'])} clips")

    work = Path(tempfile.mkdtemp(prefix=f"align-{set_id}-"))
    probed, envs, started = {}, {}, {}
    try:
        for c in job["clips"]:
            local = work / f"{c['id']}-{c.get('name') or 'clip.mp4'}"
            try:
                fetch(c["url"], local)
            except Exception as e:
                print(f"  clip {c['id']}: download failed — {e}")
                probed[c["id"]] = {"has_audio": False}
                started[c["id"]] = c.get("recorded_started_at_ms") or None
                continue
            info = ffprobe(local) or {"has_audio": False}
            probed[c["id"]] = info
            # Recorder clock first; else the embedded creation_time (uploads).
            started[c["id"]] = c.get("recorded_started_at_ms") or info.get("creation_ms") or None
            if info.get("has_audio"):
                env = onset_envelope(local)
                if env:
                    envs[c["id"]] = env
                    probed[c["id"]]["first_onset_ms"] = first_onset_frame(env) * 10
            print(f"  clip {c['id']}: {info.get('duration_ms',0)/1000:.1f}s "
                  f"{info.get('width')}x{info.get('height')} audio={info.get('has_audio')}"
                  f"{' clock' if started[c['id']] else ''}")

        if len(envs) < 2:
            # Still worth a shot with clocks alone if two or more clips carry
            # them — a room where every clip's audio failed but the phones'
            # own clocks didn't is exactly the case this exists for.
            clocked = [cid for cid in probed if started.get(cid)]
            if len(clocked) < 2:
                print("  not enough usable audio or clock data to align")
                results = [{"id": cid, "offset_ms": 0, "score": 0, "align_method": "none", **probed.get(cid, {})}
                           for cid in probed]
                post(job, set_id, 0, results)
                return True
            ref_id = max(clocked, key=lambda k: probed.get(k, {}).get("duration_ms", 0))
            print(f"  no usable audio anywhere — placing {len(clocked)} clips by clock only, reference {ref_id}")
            results = []
            for cid, info in probed.items():
                if cid == ref_id:
                    results.append({"id": cid, "offset_ms": 0, "score": 1.0, "align_method": "clock", **info})
                    continue
                w = metadata_window(started.get(ref_id), started.get(cid),
                                     probed.get(ref_id, {}).get("duration_ms", 0),
                                     info.get("duration_ms", 0))
                if w is None:
                    results.append({"id": cid, "offset_ms": 0, "score": 0.0, "align_method": "none", **info})
                else:
                    results.append({"id": cid, "offset_ms": w[0] * 10, "score": 0.0, "align_method": "clock", **info})
            post(job, set_id, ref_id, results)
            return True

        # The reference is the longest clip with audio — the most overlap with
        # everything else, so the most reliable thing to measure against. If it
        # also carries a clock reading, every other clip gets the windowed
        # search + clock fallback; if not (a board recording, say), this
        # degrades cleanly to the original blind-search-only behaviour.
        ref_id = max(envs, key=lambda k: len(envs[k]))
        ref_started, ref_dur = started.get(ref_id), probed.get(ref_id, {}).get("duration_ms", 0)
        print(f"  reference: clip {ref_id}{' (clocked)' if ref_started else ' (no clock)'}")

        results = []
        for cid, info in probed.items():
            if cid == ref_id:
                results.append({"id": cid, "offset_ms": 0, "score": 1.0, "align_method": "audio", **info})
                continue
            if cid not in envs:
                # No usable audio on this clip specifically — the "video's
                # fine, mic's fucked" case. Place it by clock if we can rather
                # than dumping it at 0 with no confidence at all.
                w = metadata_window(ref_started, started.get(cid), ref_dur, info.get("duration_ms", 0))
                if w is None:
                    results.append({"id": cid, "offset_ms": 0, "score": 0.0, "align_method": "none", **info})
                else:
                    results.append({"id": cid, "offset_ms": w[0] * 10, "score": 0.0, "align_method": "clock", **info})
                continue
            offset_ms, score, method = resolve_offset(
                envs[ref_id], envs[cid], ref_started, started.get(cid),
                ref_dur, info.get("duration_ms", 0),
            )
            # POSITIVE offset means this clip started later than the reference.
            # The sign was inverted here originally and every offset came out
            # backwards; a synthetic set with known offsets caught it.
            print(f"  clip {cid}: offset {offset_ms:+d} ms  score {score:.2f}  via {method}")
            results.append({"id": cid, "offset_ms": offset_ms, "score": round(score, 3),
                             "align_method": method, **info})

        post(job, set_id, ref_id, results)
        return True
    finally:
        for p in work.glob("*"):
            try: p.unlink()
            except OSError: pass
        try: work.rmdir()
        except OSError: pass


def post(job, set_id, ref_id, results):
    cb = job.get("callback")
    if not cb:
        print("  no callback in job; results not sent")
        return
    body = json.dumps({
        "action": "align_result", "set_id": set_id,
        "reference_clip_id": ref_id, "results": results,
    }).encode()
    req = urllib.request.Request(cb, data=body, method="POST", headers={
        "content-type": "application/json", "x-roadie-worker": SECRET,
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"  reported: {r.status} {r.read(200).decode('utf-8','replace')}")
    except Exception as e:
        print(f"  REPORT FAILED — {e}")


def sweep(once):
    pending = JOBS_DIR / "pending"
    done = JOBS_DIR / "done"
    done.mkdir(parents=True, exist_ok=True)
    while True:
        jobs = sorted(pending.glob("align-set-*.json")) if pending.exists() else []
        for j in jobs:
            try:
                if run_job(j):
                    j.rename(done / j.name)
            except Exception as e:
                print(f"[align] {j.name} failed: {e}")
        if once:
            return
        time.sleep(10)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="process what is waiting, then exit")
    ap.add_argument("--watch", action="store_true", help="keep watching the queue")
    a = ap.parse_args()
    if not SECRET:
        print("ROADIE_WORKER_SECRET is not set — results cannot be reported.", file=sys.stderr)
    sweep(once=not a.watch)
