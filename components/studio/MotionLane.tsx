"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Help, { Field } from "./Help";

// "Make it move" — hand a still to LTX and get a short clip back.
//
// Same NAS pull pool as the image lane: drop a workorder, a machine claims it,
// we read the mp4 off the shared output root. Clips are tagged by episode
// because this feeds episodic work, not one-off promos.

export type MotionClip = {
  id: number; status: string; episode: string | null; prompt: string;
  engine: string | null;
  frames: number | null; seconds: number | null;
  source_gen_id: number | null; error: string | null; url: string | null;
};

type Engine = {
  key: string; label: string; note: string; needsEnd: boolean;
  maxFrames: number; fps: number; step: number; maxSeconds: number;
};

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

/**
 * Legal lengths for an engine. Each model has its own latent rule —
 * (frames - 1) % step — so the options are generated, never hard-coded.
 * Offering an illegal frame count just produces a failed render.
 */
function lengthsFor(e: Engine | undefined) {
  if (!e) return [] as { frames: number; label: string }[];
  const out: { frames: number; label: string }[] = [];
  for (const fraction of [0.4, 0.7, 1]) {
    let n = Math.round(e.maxFrames * fraction);
    n = Math.max(e.step + 1, Math.min(e.maxFrames, n));
    n = n - ((n - 1) % e.step);
    if (!out.some(o => o.frames === n)) {
      out.push({
        frames: n,
        label: `${(n / e.fps).toFixed(2)}s${n === e.maxFrames ? " — full (max)" : ""}`,
      });
    }
  }
  return out;
}

export default function MotionLane({
  still, endStill, onUse, onClearEnd,
}: {
  still: { id: number; url: string; prompt: string } | null;
  endStill: { id: number; url: string; prompt: string } | null;
  onUse: (clip: MotionClip) => void;
  onClearEnd: () => void;
}) {
  const [clips, setClips] = useState<MotionClip[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [engine, setEngine] = useState<string>("wan");
  const [episodes, setEpisodes] = useState<{ episode: string; count: number }[]>([]);
  const [episode, setEpisode] = useState("");
  const [motion, setMotion] = useState("");
  const [frames, setFrames] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<any>(null);

  const eng = engines.find(e => e.key === engine);
  const lengths = lengthsFor(eng);

  // The lane keeps its own shot picker. The main gallery lives on the previous
  // tab, and choosing an end frame there would mean bouncing between tabs.
  const [shots, setShots] = useState<{ id: number; url: string; prompt: string }[]>([]);
  const [start, setStart] = useState<{ id: number; url: string; prompt: string } | null>(null);
  const [end, setEnd] = useState<{ id: number; url: string; prompt: string } | null>(null);

  const loadShots = useCallback(async () => {
    const r = await fetch("/api/admin/studio/generate").then(r => r.json()).catch(() => null);
    if (!r?.gens) return;
    setShots(r.gens
      .filter((g: any) => g.status === "done" && (g.kind || "image") === "image")
      .map((g: any) => {
        let imgs: any[] = []; try { imgs = JSON.parse(g.images || "[]"); } catch {}
        return imgs.length
          ? { id: g.id, url: `/api/admin/studio/image?gen=${g.id}&i=0`, prompt: g.prompt }
          : null;
      })
      .filter(Boolean));
  }, []);
  useEffect(() => { loadShots(); }, [loadShots]);

  // Whatever the previous tab handed us seeds the start frame.
  useEffect(() => { if (still && !start) setStart(still); }, [still]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (endStill) setEnd(endStill); }, [endStill]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/studio/motion").then(r => r.json()).catch(() => null);
    if (!r) return;
    setClips(r.clips || []);
    setEpisodes(r.episodes || []);
    if (r.engines?.length) {
      setEngines(r.engines);
      setEngine(cur => (r.engines.some((e: Engine) => e.key === cur) ? cur : r.defaultEngine));
    }
    return r.clips || [];
  }, []);

  // Frame counts are per-engine; a length that was legal for LTX is not legal
  // for WAN, so reset to that engine's max whenever the engine changes.
  useEffect(() => {
    if (eng) setFrames(eng.maxFrames);
  }, [eng?.key]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearInterval(poll.current), []);

  // Only poll while something is actually cooking.
  useEffect(() => {
    const waiting = clips.some(c => c.status === "queued");
    clearInterval(poll.current);
    if (!waiting) return;
    poll.current = setInterval(async () => {
      const ids = clips.filter(c => c.status === "queued").map(c => c.id).join(",");
      if (ids) await fetch(`/api/admin/studio/status?ids=${ids}`).catch(() => null);
      load();
    }, 6000);
    return () => clearInterval(poll.current);
  }, [clips, load]);

  async function makeItMove() {
    if (!start) { setMsg("Pick a start frame first."); return; }
    if (eng?.needsEnd && !end) { setMsg("This one moves between two shots — pick an end frame too."); return; }
    setMsg(null); setBusy(true);
    const r = await fetch("/api/admin/studio/motion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gen_id: start.id,
        end_gen_id: eng?.needsEnd ? end?.id : undefined,
        engine, motion, frames, episode: episode.trim(),
      }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(false);
    if (r?.error) { setMsg(r.error); return; }
    setMsg(`Queued — ${r.seconds?.toFixed(2)}s on the render fleet. Video takes a while.`);
    load();
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="label flex items-center gap-1.5">
        Make it move
        <Help title="Make it move">
          Turns a still you already made into a short moving clip on the render
          fleet, then drops it on the timeline like any other shot. It takes a
          few minutes — a clip is far more work than a picture.
        </Help>
      </div>

      <Field label="Engine" help={<>WAN is the newer model and holds a shot together far
        better; it also runs to eight seconds. LTX is quicker but drifts and rarely
        finishes a thought. First+last takes two of your shots and moves between them,
        which is the only way to say where a shot should end up.</>}>
        <select className={inp} value={engine} onChange={e => setEngine(e.target.value)}>
          {engines.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
      </Field>
      {eng && <div className="text-xs text-[#8a8aa0] -mt-1">{eng.note}</div>}

      <div className="flex flex-wrap gap-4">
        <div>
          <div className="label mb-1">{eng?.needsEnd ? "Starts here" : "From this shot"}</div>
          {start ? (
            <img src={start.url} alt="" className="w-32 h-20 object-cover rounded-lg border border-[#ff3d6e]" />
          ) : (
            <div className="w-32 h-20 rounded-lg border border-dashed border-[#2a2a3a]
                            grid place-items-center text-[10px] text-[#8a8aa0]">pick below</div>
          )}
        </div>
        {eng?.needsEnd && (
          <div>
            <div className="label mb-1">Ends here</div>
            {end ? (
              <div className="relative">
                <img src={end.url} alt="" className="w-32 h-20 object-cover rounded-lg border border-[#ff3d6e]" />
                <button className="btn absolute -top-2 -right-2 px-2 py-0 text-xs"
                  onClick={() => { setEnd(null); onClearEnd(); }}>x</button>
              </div>
            ) : (
              <div className="w-32 h-20 rounded-lg border border-dashed border-[#2a2a3a]
                              grid place-items-center text-[10px] text-center px-1 text-[#8a8aa0]">
                pick an end frame below
              </div>
            )}
          </div>
        )}
        {start && <div className="flex-1 min-w-[140px] text-xs text-[#8a8aa0] line-clamp-4">{start.prompt}</div>}
      </div>

      {shots.length > 0 && (
        <div>
          <div className="label mb-2">Your shots</div>
          <div className="flex gap-2 overflow-x-auto scroll pb-1">
            {shots.map(s => (
              <div key={s.id} className="shrink-0">
                <img src={s.url} alt={s.prompt} title={s.prompt}
                  className={"w-24 h-16 object-cover rounded-lg border " +
                    (start?.id === s.id || end?.id === s.id ? "border-[#ff3d6e]" : "border-[#2a2a3a]")} />
                <div className="flex gap-1 mt-1">
                  <button className="btn px-2 py-0.5 text-[10px] flex-1"
                    onClick={() => setStart(s)}>start</button>
                  {eng?.needsEnd && (
                    <button className="btn px-2 py-0.5 text-[10px] flex-1"
                      onClick={() => setEnd(s)}>end</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Field label="What moves" help={<>Describe the MOVEMENT, not the picture — the picture
        is already decided by the still. &quot;flags snapping, crowd shifting, dust drifting
        through the light&quot;. Leave it blank and it just breathes.</>}>
        <input className={inp} value={motion} onChange={e => setMotion(e.target.value)}
          placeholder="dust drifting through the light, gear shifting in the background" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Length" help={<>Each model has its own ceiling — WAN reaches about
          eight seconds, LTX under five. Longer than the max isn&apos;t available; cut two
          clips and join them instead.</>}>
          <select className={inp} value={frames} onChange={e => setFrames(Number(e.target.value))}>
            {lengths.map(l => <option key={l.frames} value={l.frames}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Episode" help={<>Tags the clip and files it in its own folder on the
          NAS, so a series&apos; footage stays together instead of piling into one heap.</>}>
          <input className={inp} value={episode} onChange={e => setEpisode(e.target.value)}
            list="roadie-episodes" placeholder="ep01" />
          <datalist id="roadie-episodes">
            {episodes.map(e => <option key={e.episode} value={e.episode}>{`${e.episode} (${e.count})`}</option>)}
          </datalist>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-neon" onClick={makeItMove} disabled={!start || busy}>
          {busy ? "Queuing…" : "Make it move"}
        </button>
        {msg && <span className="text-sm text-[#8a8aa0]">{msg}</span>}
      </div>

      {clips.length > 0 && (
        <div>
          <div className="label mb-2">Clips</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-72 overflow-y-auto scroll">
            {clips.map(c => (
              <div key={c.id} className="rounded-lg border border-[#2a2a3a] overflow-hidden">
                {c.status === "done" && c.url ? (
                  <>
                    <video src={c.url} className="w-full aspect-video object-cover bg-black"
                      muted loop playsInline
                      onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
                    <button className="btn w-full rounded-none border-0 border-t border-[#2a2a3a]"
                      onClick={() => onUse(c)}>
                      Use this clip
                    </button>
                  </>
                ) : (
                  <div className="aspect-video grid place-items-center text-[11px] px-2 text-center
                                  bg-[#0b0b0f] text-[#8a8aa0]">
                    {c.status === "queued"
                      ? "on the render fleet…"
                      : <span className="text-[#ff3d6e]">{c.error || "failed"}</span>}
                  </div>
                )}
                <div className="px-2 py-1 text-[10px] text-[#8a8aa0] truncate">
                  {c.episode ? `${c.episode} · ` : ""}
                  {c.seconds ? `${c.seconds.toFixed(2)}s` : ""}
                  {c.engine ? ` · ${c.engine.startsWith("wan") ? "WAN" : "LTX"}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
