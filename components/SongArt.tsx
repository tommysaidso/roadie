"use client";
import { useState } from "react";
import { Wand2, Loader2, X, Film, RefreshCw, Link as LinkIcon, Download, Check } from "lucide-react";

// Turn a song into poster art. We do NOT hold lyric text anywhere — the Work
// record carries only a hash — so the opening line is something the band types
// in — the opening lines or the chorus, whichever carries the image.
// Title and genre alone already give usable directions; the hook sharpens it.
export default function SongArt({ bandId, band, hero, setHero, heroDim, setHeroDim }: any) {
  const [title, setTitle] = useState("");
  const [line, setLine] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"" | "ideas" | "art" | "clip">("");
  const [err, setErr] = useState("");
  const [clip, setClip] = useState<{ op?: string; note?: string; url?: string; download?: string }>({});
  const [shot, setShot] = useState<{ url?: string; download?: string; watermarked?: boolean }>({});

  async function getIdeas() {
    if (!title.trim()) { setErr("Give it a song title first."); return; }
    setBusy("ideas"); setErr("");
    try {
      const q = new URLSearchParams({ title, line, band_id: String(bandId || ""), genre: band?.genre || "" });
      const r = await fetch(`/api/song-art?${q}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not get ideas."); return; }
      setIdeas(d.prompts || []);
      if (d.prompts?.[0] && !prompt) setPrompt(d.prompts[0]);
    } finally { setBusy(""); }
  }

  async function makeArt(p: string) {
    if (!p.trim()) { setErr("Pick or write a prompt."); return; }
    setBusy("art"); setErr("");
    try {
      const r = await fetch("/api/song-art", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "image", prompt: p, band_id: bandId, aspect: "3:4", title, hook: line }),
      });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Image generation failed."); return; }
      setHero(d.dataUrl);
      setShot({ url: d.url, download: d.download, watermarked: d.watermarked });
    } catch { setErr("Image generation failed."); }
    finally { setBusy(""); }
  }

  async function makeClip() {
    if (!prompt.trim()) { setErr("Pick a prompt first."); return; }
    setBusy("clip"); setErr(""); setClip({});
    try {
      const r = await fetch("/api/song-art", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clip", prompt, image: hero || undefined, band_id: bandId, title, hook: line }),
      });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Could not start the clip."); return; }
      setClip({ op: d.operation, note: "Rendering — this takes a couple of minutes." });
      poll(d.operation, 0);
    } catch { setErr("Could not start the clip."); }
    finally { setBusy(""); }
  }

  async function poll(op: string, n: number) {
    if (n > 40) { setClip({ note: "Still rendering — check back shortly." }); return; }
    await new Promise(r => setTimeout(r, 6000));
    const r = await fetch("/api/song-art", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "poll", operation: op, band_id: bandId, prompt, title, hook: line }),
    });
    const d = await r.json();
    if (!d.ok) { setClip({ note: d.error || "Clip failed." }); return; }
    if (!d.done) { poll(op, n + 1); return; }
    setClip({ note: "", url: d.url, download: d.download });
  }

  return (
    <div className="mt-4 pt-4 border-t border-edge">
      <div className="label mb-2 flex items-center gap-1"><Wand2 size={12} className="text-neon" />Art from your song</div>

      <div className="space-y-2">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title"
          className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm" />
        <input value={line} onChange={e => setLine(e.target.value)} placeholder="First lines or the chorus — whichever paints the picture"
          className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm" />
        <button onClick={getIdeas} disabled={busy === "ideas"}
          className="btn text-sm w-full flex items-center justify-center gap-1 disabled:opacity-40">
          {busy === "ideas" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {busy === "ideas" ? "Reading the song…" : "Give me ideas"}
        </button>
      </div>

      {!!ideas.length && (
        <div className="mt-3 space-y-1.5">
          <div className="label">Pick a direction</div>
          {ideas.map((p, i) => (
            <button key={i} onClick={() => { setPrompt(p); makeArt(p); }} disabled={!!busy}
              className={`w-full text-left text-xs rounded-lg border px-2 py-2 transition disabled:opacity-40 ${
                prompt === p ? "border-neon text-white" : "border-edge text-muted hover:text-white"}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
        placeholder="…or write your own prompt"
        className="w-full bg-ink border border-edge rounded-lg px-2 py-2 text-sm mt-3" />

      <div className="flex gap-2 mt-2">
        <button onClick={() => makeArt(prompt)} disabled={!!busy}
          className="btn btn-neon text-sm flex-1 flex items-center justify-center gap-1 disabled:opacity-40">
          {busy === "art" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {busy === "art" ? "Painting…" : hero ? "New image" : "Make the image"}
        </button>
        {hero && (
          <button onClick={() => setHero("")} className="btn text-sm flex items-center gap-1" title="Remove art">
            <X size={14} />
          </button>
        )}
      </div>

      {hero && (
        <>
          <div className="mt-3">
            <div className="label mb-1">Darken behind the type</div>
            <input type="range" min={0} max={0.9} step={0.05} value={heroDim}
              onChange={e => setHeroDim(Number(e.target.value))} className="w-full" />
          </div>
          <button onClick={makeClip} disabled={!!busy}
            className="btn text-sm w-full mt-2 flex items-center justify-center gap-1 disabled:opacity-40">
            {busy === "clip" ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
            Make a short clip from this
          </button>
          <div className="text-[11px] text-muted mt-1">
            Real generated motion, not a pan over a still. Costs per second of video — use it when you mean it.
          </div>
        </>
      )}

      {(shot.url || clip.url) && (
        <div className="mt-3 rounded-xl border border-edge bg-black/20 p-3 space-y-2">
          <div className="label">Share it</div>
          {shot.url && <ShareRow label="Image" url={shot.url} download={shot.download!} />}
          {clip.url && <ShareRow label="Clip" url={clip.url} download={clip.download!} />}
          <div className="text-[11px] text-muted">
            Shared copies carry a <b>mymymy.studio</b> corner mark, and every link is
            logged against the song, the lyric and the prompt that made it — so a piece
            traces back to you wherever it lands. Clips also carry that credit written
            into the file itself.
            {shot.url && shot.watermarked === false && " (Corner mark unavailable on this server — the link still traces back.)"}
          </div>
        </div>
      )}

      {clip.note && <div className="text-xs text-muted mt-2">{clip.note}</div>}
      {err && <div className="text-xs mt-2" style={{ color: "#e05c7a" }}>{err}</div>}
    </div>
  );
}

function ShareRow({ label, url, download }: { label: string; url: string; download: string }) {
  const [copied, setCopied] = useState(false);
  const full = typeof window !== "undefined" ? window.location.origin + url : url;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted w-10 shrink-0">{label}</span>
      <input readOnly value={full} onFocus={e => e.currentTarget.select()}
        className="flex-1 min-w-0 bg-ink border border-edge rounded-lg px-2 py-1 text-xs" />
      <button onClick={() => { navigator.clipboard?.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="btn text-xs px-2 py-1 shrink-0" title="Copy link">
        {copied ? <Check size={13} /> : <LinkIcon size={13} />}
      </button>
      <a href={download} className="btn text-xs px-2 py-1 shrink-0" title="Download">
        <Download size={13} />
      </a>
    </div>
  );
}
