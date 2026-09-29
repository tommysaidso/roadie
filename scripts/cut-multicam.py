"""
MULTICAM CUTTER — turns an aligned set into one finished video.

    python3 scripts/cut-multicam.py --set 3
    python3 scripts/cut-multicam.py --set 3 --segment 3.5 --height 1080

Runs inside the ROADIE container. ffmpeg is in the image for this.

THE ONE RULE THAT SHAPES EVERYTHING: AUDIO IS KING.

The audio comes from ONE source for the whole cut and never switches. Cutting
between phone mics every few seconds sounds like a fault — different rooms,
different gain, an audible lurch on every edit. So one clip supplies the sound
from start to finish (the alignment reference by default, or a nominated bed such
as a board feed), and the picture cuts freely on top of it. That is also exactly
how a real multicam shoot is cut, and it is why the offsets matter: every camera
is placed against that one timeline.

THE TEMPLATE

    - START: by default the cut runs from the first frame anyone shot, so a
      spoken intro before the band plays is kept. Pass --start music and it
      begins at the first detected downbeat instead, MINUS a pre-roll buffer
      (--preroll, default 2.5s) so the count-in, the last word of the banter and
      the breath before the first hit all survive. Cutting exactly on the
      transient always feels like the video started late.
    - It changes shot every SEGMENT seconds.
    - Only clips that actually cover that moment are candidates.
    - It avoids repeating the previous shot when there is an alternative, and
      prefers the camera it has used least, so no one phone dominates.
    - Wide clips play full frame. Vertical clips are treated as PUNCH-INS:
      scaled to fill and centre-cropped, which reads as a tight shot rather than
      a phone video with bars down the sides.

This is deliberately a template, not an edit. It is meant to be predictable
enough to test against and to be replaced later by something smarter.
"""

import argparse, json, os, subprocess, sys, tempfile, urllib.request
from pathlib import Path

W_DEFAULT, H_DEFAULT = 1920, 1080


def sh(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def fetch(url, dest):
    with urllib.request.urlopen(url, timeout=600) as r, open(dest, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)


def plan(clips, segment_ms, span_ms, begin_ms=0):
    """
    Decide who is on screen when.

    Returns a list of {clip, start_ms, dur_ms, source_ms} where source_ms is the
    position INSIDE that clip — which is the whole reason alignment happened.
    """
    out, used, last = [], {c["id"]: 0 for c in clips}, None
    t = begin_ms
    while t < span_ms:
        seg_end = min(t + segment_ms, span_ms)
        live = [c for c in clips
                if c["starts_at_ms"] <= t and c["ends_at_ms"] >= seg_end]
        if not live:
            # A hole in coverage. Skip forward to whenever somebody is filming
            # again rather than emitting black.
            nxt = [c["starts_at_ms"] for c in clips if c["starts_at_ms"] > t]
            if not nxt:
                break
            t = min(nxt)
            continue

        # Least-used first, and not the same camera twice in a row if we can
        # help it. Ties break on clip id so the same input always cuts the same
        # way — a template you cannot reproduce is not testable.
        pool = [c for c in live if c["id"] != last] or live
        pick = sorted(pool, key=lambda c: (used[c["id"]], c["id"]))[0]

        used[pick["id"]] += 1
        last = pick["id"]
        out.append({
            "clip": pick,
            "start_ms": t,
            "dur_ms": seg_end - t,
            "source_ms": t - pick["starts_at_ms"],
        })
        t = seg_end
    return out


def timeline_start(sheet, mode, preroll_sec):
    """
    Where the cut begins on the set timeline.

    'music' anchors on the earliest detected downbeat across all clips and backs
    off by the pre-roll, but never earlier than the first frame anyone shot and
    never later than the downbeat itself.
    """
    earliest = min((c["starts_at_ms"] for c in sheet["clips"]), default=0)
    if mode != "music":
        return earliest
    hits = [c["first_onset_ms"] for c in sheet["clips"] if c.get("first_onset_ms") is not None]
    if not hits:
        print("[cut] no downbeat detected — starting from the footage instead")
        return earliest
    return max(earliest, min(hits) - int(preroll_sec * 1000))


def render(sheet, outfile, segment_sec, width, height, work: Path,
           start_mode="footage", preroll_sec=2.5):
    clips = [c for c in sheet["clips"] if c.get("url")]
    if len(clips) < 2:
        raise SystemExit("Need at least two aligned clips to cut.")

    print(f"[cut] {len(clips)} clips, span {sheet['span_ms']/1000:.1f}s")

    # 1) pull the sources
    local = {}
    for c in clips:
        dest = work / f"src-{c['id']}.mp4"
        print(f"  fetching clip {c['id']} ({c.get('role')})")
        fetch(c["url"], dest)
        local[c["id"]] = dest

    # 2) the audio bed — one source, whole cut
    bed = next((c for c in clips if c.get("is_audio_bed")), None) or \
          max(clips, key=lambda c: c["ends_at_ms"] - c["starts_at_ms"])
    print(f"[cut] audio bed: clip {bed['id']} ({bed.get('uploader') or 'unknown'})")

    begin = timeline_start(sheet, start_mode, preroll_sec)
    if begin:
        print(f"[cut] starting at {begin/1000:.2f}s ({start_mode})")
    segs = plan(clips, int(segment_sec * 1000), sheet["span_ms"], begin)
    if not segs:
        raise SystemExit("Nothing to cut — no clip covers any part of the timeline.")
    print(f"[cut] {len(segs)} segments of {segment_sec}s")

    # 3) render each segment to a common format.
    #
    # Segment-then-concat rather than one enormous filtergraph: it is slower but
    # every piece is inspectable, one bad source fails one segment instead of the
    # whole job, and the ffmpeg command stays something a human can read.
    parts = []
    for i, s in enumerate(segs):
        c = s["clip"]
        part = work / f"seg-{i:04d}.mp4"
        vertical = (c.get("role") == "punch-in") or (c.get("orientation") == "vertical")
        if vertical:
            # Fill the frame and crop the middle out — a punch-in, not a phone
            # video with bars beside it.
            vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                  f"crop={width}:{height},setsar=1,fps=30")
        else:
            vf = (f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                  f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30")

        r = sh(["ffmpeg", "-v", "error", "-y",
                "-ss", f"{max(0, s['source_ms'])/1000:.3f}",
                "-t", f"{s['dur_ms']/1000:.3f}",
                "-i", str(local[c["id"]]),
                "-an", "-vf", vf,
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-pix_fmt", "yuv420p", str(part)])
        if r.returncode != 0 or not part.exists():
            print(f"  segment {i} failed on clip {c['id']}: {r.stderr.strip()[:160]}")
            continue
        parts.append(part)

    if not parts:
        raise SystemExit("Every segment failed to render.")

    # 4) join the picture
    listing = work / "parts.txt"
    # Bare filenames, not paths: ffmpeg resolves concat entries RELATIVE TO
    # THE LIST FILE, so a path here becomes work/work/seg-0000.mp4 and every
    # entry fails to open. The list sits beside the segments, so the name is
    # enough. Caught by an end-to-end render, not by reading the code.
    listing.write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    silent = work / "picture.mp4"
    r = sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
            "-i", str(listing), "-c", "copy", str(silent)])
    if r.returncode != 0:
        raise SystemExit(f"Concat failed: {r.stderr.strip()[:300]}")

    # 5) lay the single audio bed underneath, trimmed to where the cut starts
    bed_offset = max(0, segs[0]["start_ms"] - bed["starts_at_ms"]) / 1000
    r = sh(["ffmpeg", "-v", "error", "-y",
            "-i", str(silent),
            "-ss", f"{bed_offset:.3f}", "-i", str(local[bed["id"]]),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart", str(outfile)])
    if r.returncode != 0:
        raise SystemExit(f"Mux failed: {r.stderr.strip()[:300]}")

    size = Path(outfile).stat().st_size
    print(f"[cut] done: {outfile} ({size/1048576:.1f} MB)")
    return size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", type=int, required=True)
    ap.add_argument("--segment", type=float, default=float(os.environ.get("CUT_SEGMENT_SEC", 4)))
    ap.add_argument("--start", choices=["footage", "music"], default="footage",
                    help="footage = first frame anyone shot; music = the first downbeat, less the pre-roll")
    ap.add_argument("--preroll", type=float, default=2.5,
                    help="seconds kept in front of the first downbeat when --start music")
    ap.add_argument("--width", type=int, default=W_DEFAULT)
    ap.add_argument("--height", type=int, default=H_DEFAULT)
    ap.add_argument("--api", default=os.environ.get("ROADIE_INTERNAL_URL", "http://127.0.0.1:3001"))
    a = ap.parse_args()

    secret = os.environ.get("ROADIE_WORKER_SECRET", "")
    base = a.api.rstrip("/")

    def report(**kw):
        body = json.dumps({"action": "render_result", "set_id": a.set, **kw}).encode()
        req = urllib.request.Request(f"{base}/api/admin/multicam", data=body, method="POST",
                                     headers={"content-type": "application/json",
                                              "x-roadie-worker": secret})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                print(f"[cut] reported {r.status}")
        except Exception as e:
            print(f"[cut] REPORT FAILED — {e}")

    # The cut sheet is the contract between alignment and the edit.
    req = urllib.request.Request(
        f"{base}/api/admin/multicam?set={a.set}&cutsheet=1&worker=1",
        headers={"x-roadie-worker": secret})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            sheet = json.loads(r.read())
    except Exception as e:
        print(f"[cut] could not read the cut sheet — {e}", file=sys.stderr)
        report(ok=False, note=f"cut sheet unreadable: {e}")
        return 1

    work = Path(tempfile.mkdtemp(prefix=f"cut-{a.set}-"))
    out = work / f"multicam-set-{a.set}.mp4"
    try:
        size = render(sheet, out, a.segment, a.width, a.height, work,
                      start_mode=a.start, preroll_sec=a.preroll)
    except SystemExit as e:
        print(f"[cut] {e}", file=sys.stderr)
        report(ok=False, note=str(e))
        return 1
    except Exception as e:
        report(ok=False, note=f"unexpected: {e}")
        return 1

    # Upload straight to R2 with the presigned PUT the API hands back.
    up = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"{base}/api/admin/multicam", method="POST",
        data=json.dumps({"action": "render_upload_url", "set_id": a.set}).encode(),
        headers={"content-type": "application/json", "x-roadie-worker": secret},
    ), timeout=60).read())

    if not up.get("url"):
        report(ok=False, note="no upload url")
        return 1

    print("[cut] uploading…")
    put = urllib.request.Request(up["url"], data=out.read_bytes(), method="PUT",
                                 headers={"Content-Type": "video/mp4"})
    with urllib.request.urlopen(put, timeout=1800) as r:
        print(f"[cut] uploaded {r.status}")

    report(ok=True, key=up["key"], bytes=size)

    for p in work.glob("*"):
        try: p.unlink()
        except OSError: pass
    try: work.rmdir()
    except OSError: pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
