"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Help, { Field } from "./Help";

// Two prompt boxes, side by side, one Generate button. Same click, two looks —
// so you're comparing, not remembering.

const LOOKS = [
  { key: "PHOTOREAL", label: "Photoreal" },
  { key: "COMIC", label: "Comic / illustrated" },
];
const SIZES = [
  { key: "wide", label: "16:9 wide" },
  { key: "square", label: "1:1 square" },
  { key: "vertical", label: "9:16 vertical" },
  { key: "poster", label: "3:4 poster" },
];

export type Pane = {
  prompt: string; negative: string; look: string; size: string;
  steps: number; cfg: number; seed: number | "";
  reference: string; refPreview: string; strength: number;
};

const blankPane = (look = "PHOTOREAL"): Pane => ({
  prompt: "", negative: "", look, size: "wide", steps: 28, cfg: 6.5, seed: "",
  reference: "", refPreview: "", strength: 0.6,
});

export type Shot = {
  id: number; pane: number; status: string; prompt: string;
  urls: string[]; error?: string | null; seed?: number; look?: string; size?: string;
};

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

function PanePanel({ n, value, onChange, shot, onUse, busy }: {
  n: number; value: Pane; onChange: (p: Pane) => void;
  shot?: Shot; onUse: (s: Shot, url: string) => void; busy: boolean;
}) {
  const set = (k: keyof Pane, v: any) => onChange({ ...value, [k]: v });
  const url = shot?.urls?.[0];
  const [upLoading, setUpLoading] = useState(false);
  const [upError, setUpError] = useState<string | null>(null);

  async function onReference(file: File) {
    setUpError(null);
    setUpLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/studio/reference", { method: "POST", body: fd })
        .then(r => r.json());
      if (r?.error) { setUpError(r.error); return; }
      onChange({
        ...value,
        reference: r.reference,
        // Local preview — the staged copy lives on the render machines, not here.
        refPreview: URL.createObjectURL(file),
      });
      if (r.warnings?.length) {
        setUpError(`Staged on ${r.staged} of ${r.of} machines. ${r.warnings.join(" | ")}`);
      }
    } catch (e: any) {
      setUpError(String(e?.message || e));
    } finally {
      setUpLoading(false);
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label">Pane {n === 0 ? "A" : "B"}</span>
        {shot && (
          <span className="pill">
            {shot.status === "queued" ? "rendering…" : shot.status}
            {shot.seed ? ` · seed ${shot.seed}` : ""}
          </span>
        )}
      </div>

      <Field label="Prompt" help={
        <>Describe the picture, not the sales copy. Subject, setting, light, mood.
           Keep the sponsor&apos;s name out of it — text baked into an AI image comes
           out mangled. Put the logo on in the timeline instead.
           <br /><br />
           Vehicles are held to mid-1980s or newer automatically — ask for a &quot;tour
           van&quot; and the model&apos;s first instinct is a 70s hippie bus. Say the year
           or make you want and it&apos;ll go newer still.</>}>
        <textarea
          className={inp + " h-28 resize-y"}
          placeholder="a beat-up tour van parked outside a small-town BC music shop at golden hour, gear on the sidewalk"
          value={value.prompt}
          onChange={e => set("prompt", e.target.value)}
        />
      </Field>

      <div className="rounded-xl border border-[#2a2a3a] bg-[#0b0b0f] p-3">
        <div className="label flex items-center gap-1.5 mb-2">
          Reference photo
          <Help title="Reference photo">
            The only way to pin something words can&apos;t reach — an exact van, a real
            storefront, your actual gear. Naming a make and year in the prompt does
            not work; the model hands back a generic version. A photo settles it.
            <br /><br />
            The file is copied onto every render machine before the job goes out, so
            it works wherever the render lands.
          </Help>
        </div>

        {value.refPreview ? (
          <div className="flex gap-3">
            <img src={value.refPreview} alt="reference"
              className="w-24 h-24 object-cover rounded-lg border border-[#2a2a3a]" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#8a8aa0] truncate mb-2">{value.reference}</div>
              <Field label={`Stay close to it — ${Math.round(value.strength * 100)}% free`}
                help={<>Low keeps the reference&apos;s shapes and layout and just re-lights
                  it. High treats the photo as a loose suggestion. Around 50–65% keeps the
                  vehicle and the framing while letting the mood change.</>}>
                <input type="range" min={0.15} max={0.95} step={0.05} value={value.strength}
                  onChange={e => set("strength", Number(e.target.value))} className="w-full" />
              </Field>
              <button className="btn mt-2"
                onClick={() => onChange({ ...value, reference: "", refPreview: "" })}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input type="file" accept="image/png,image/jpeg,image/webp" className="text-xs"
              disabled={upLoading}
              onChange={e => e.target.files?.[0] && onReference(e.target.files[0])} />
            {upLoading && <span className="text-xs text-[#8a8aa0]">copying to the render machines…</span>}
          </div>
        )}
        {upError && <div className="text-xs text-[#ff3d6e] mt-2">{upError}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Look" help={<>Photoreal and comic are different models. Photoreal for
          real-world sponsor spots; comic for poster art and merch.</>}>
          <select className={inp} value={value.look} onChange={e => set("look", e.target.value)}>
            {LOOKS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Shape" help={<>Pick where it&apos;s going. Vertical for phones,
          wide for a web banner or a video, poster for print.</>}>
          <select className={inp} value={value.size} onChange={e => set("size", e.target.value)}>
            {SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
      </div>

      <details className="text-sm">
        <summary className="label cursor-pointer select-none">Fine tuning</summary>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field label="Steps" help={<>How long it thinks. 28 is the honest default.
            Past ~40 you pay time for almost nothing.</>}>
            <input type="number" min={8} max={60} className={inp}
              value={value.steps} onChange={e => set("steps", Number(e.target.value))} />
          </Field>
          <Field label="Guidance" help={<>How literally it obeys the prompt. Low (4) is
            loose and pretty; high (9) is obedient and can look stiff.</>}>
            <input type="number" min={1} max={12} step={0.5} className={inp}
              value={value.cfg} onChange={e => set("cfg", Number(e.target.value))} />
          </Field>
          <Field label="Seed" help={<>Blank = new every time. Paste a seed from a shot
            you liked to get variations of that same picture.</>}>
            <input type="number" className={inp} placeholder="random"
              value={value.seed} onChange={e => set("seed", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Avoid" help={<>Things to keep out. The look already excludes the
          usual junk, plus pre-1980s vehicles — only add what you actually keep seeing.</>}>
          <input className={inp} placeholder="crowds, night, snow"
            value={value.negative} onChange={e => set("negative", e.target.value)} />
        </Field>
      </details>

      <div className="rounded-xl border border-[#2a2a3a] bg-[#0b0b0f] aspect-video
                      flex items-center justify-center overflow-hidden relative">
        {url && <img src={url} alt={shot?.prompt || ""} className="w-full h-full object-contain" />}
        {!url && shot?.status === "queued" && (
          <span className="text-sm text-[#8a8aa0] animate-pulse">on the render fleet…</span>
        )}
        {!url && shot?.status === "failed" && (
          <span className="text-xs text-[#ff3d6e] p-4 text-center">{shot.error || "Render failed."}</span>
        )}
        {!url && !shot && (
          <span className="text-sm text-[#8a8aa0]">{busy ? "queuing…" : "nothing here yet"}</span>
        )}
      </div>

      {url && shot && (
        <button className="btn btn-neon w-full" onClick={() => onUse(shot, url)}>
          Use this shot →
        </button>
      )}
    </div>
  );
}

export default function PromptStudio({ onUse }: { onUse: (s: Shot, url: string) => void }) {
  const [panes, setPanes] = useState<Pane[]>([blankPane("PHOTOREAL"), blankPane("COMIC")]);
  const [twoUp, setTwoUp] = useState(true);
  const [shots, setShots] = useState<Record<number, Shot>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Shot[]>([]);
  const poll = useRef<any>(null);

  const loadGallery = useCallback(async () => {
    const r = await fetch("/api/admin/studio/generate").then(r => r.json()).catch(() => null);
    if (!r?.gens) return;
    setGallery(r.gens.filter((g: any) => g.status === "done").map((g: any) => {
      let imgs: any[] = []; try { imgs = JSON.parse(g.images || "[]"); } catch {}
      return {
        id: g.id, pane: g.pane, status: g.status, prompt: g.prompt, seed: g.seed,
        look: g.look, size: g.size,
        urls: imgs.map((_: any, i: number) => `/api/admin/studio/image?gen=${g.id}&i=${i}`),
      };
    }));
  }, []);

  useEffect(() => { loadGallery(); }, [loadGallery]);
  useEffect(() => () => clearInterval(poll.current), []);

  async function generate() {
    setMsg(null);
    const active = twoUp ? panes : [panes[0]];
    if (!active.some(p => p.prompt.trim())) { setMsg("Type a prompt first."); return; }
    setBusy(true);
    setShots({});

    const res = await fetch("/api/admin/studio/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panes: active.filter(p => p.prompt.trim()).map(p => ({
          ...p,
          seed: p.seed === "" ? undefined : p.seed,
          // The blob URL is browser-only; the server keys off the basename.
          refPreview: undefined,
          reference: p.reference || undefined,
          strength: p.reference ? p.strength : undefined,
        })),
      }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));

    if (res?.error) { setMsg(res.error); setBusy(false); return; }
    if (Array.isArray(res?.gens)) {
      const seeded: Record<number, Shot> = {};
      res.gens.forEach((g: any) => {
        seeded[g.pane] = { id: g.id, pane: g.pane, status: g.status, prompt: "", urls: [], error: g.error, seed: g.seed };
      });
      setShots(seeded);
    }
    if (!res?.batch) { setBusy(false); return; }

    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      const s = await fetch(`/api/admin/studio/status?batch=${res.batch}`).then(r => r.json()).catch(() => null);
      if (!s?.gens) return;
      const next: Record<number, Shot> = {};
      s.gens.forEach((g: Shot) => { next[g.pane] = g; });
      setShots(next);
      if (!s.pending) { clearInterval(poll.current); setBusy(false); loadGallery(); }
    }, 2500);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-neon" onClick={generate} disabled={busy}>
          {busy ? "Rendering…" : twoUp ? "Generate both" : "Generate"}
        </button>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={twoUp} onChange={e => setTwoUp(e.target.checked)} />
          Side by side
          <Help title="Side by side">
            Runs both panes on one click so you can pick between two directions
            instead of trying to remember the last one. Turn it off to save fleet
            time when you already know what you want.
          </Help>
        </label>
        <button className="btn" onClick={() => setPanes([{ ...panes[0] }, { ...panes[0], look: panes[0].look === "COMIC" ? "PHOTOREAL" : "COMIC" }])}>
          Copy A → B, flip the look
        </button>
        <button className="btn" onClick={() => setPanes(ps => [
          ps[0],
          // Same reference on both sides, different strength — the fastest way
          // to see how far to let a photo travel.
          { ...ps[0], strength: Math.min(0.95, ps[0].strength + 0.25) },
        ])} disabled={!panes[0].reference}>
          Same photo, looser on B
        </button>
        {msg && <span className="text-sm text-[#ff3d6e]">{msg}</span>}
      </div>

      <div className={twoUp ? "grid md:grid-cols-2 gap-4" : ""}>
        {(twoUp ? [0, 1] : [0]).map(n => (
          <PanePanel key={n} n={n} value={panes[n]} busy={busy}
            onChange={p => setPanes(ps => ps.map((old, i) => (i === n ? p : old)))}
            shot={shots[n]} onUse={onUse} />
        ))}
      </div>

      {gallery.length > 0 && (
        <div className="card p-4">
          <div className="label mb-2 flex items-center gap-1.5">
            Everything you&apos;ve made
            <Help title="Gallery">Every finished shot, newest first. Click one to drop it
              straight onto the timeline — you don&apos;t have to re-generate it.</Help>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto scroll">
            {gallery.map(s => s.urls[0] && (
              <button key={s.id} title={s.prompt} onClick={() => onUse(s, s.urls[0])}
                className="aspect-square rounded-lg overflow-hidden border border-[#2a2a3a] hover:border-[#ff3d6e]">
                <img src={s.urls[0]} alt={s.prompt} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
