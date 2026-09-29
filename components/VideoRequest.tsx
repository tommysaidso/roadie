"use client";
import React, { useState } from "react";
import { Video, Check, Sparkles } from "lucide-react";

// "We want a music video" — the band side of the production business.
//
// Asked as a conversation rather than a form wall. Each question is one thing,
// in the order a shoot actually gets decided, and every one after the song is
// skippable: a band that only knows "we want it to look like the bar we play"
// should still be able to send that, because it is more than enough to start a
// phone call.
//
// The treatment is drafted from THEIR words. A band that reads it back and
// doesn't recognise its own idea will not book the shoot.

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

type Step = { k: string; q: string; hint: string; required?: boolean };

const STEPS: Step[] = [
  { k: "song", q: "Which song?", hint: "Title — and a link if it's up anywhere.", required: true },
  { k: "kind", q: "What kind of video?", hint: "" },
  { k: "look", q: "How should it feel?", hint: "Gritty, neon, daylight, black and white, snowy, cheap and fun — your words." },
  { k: "story", q: "What happens in it?", hint: "Even loosely. \"We play in a garage and it fills up with people\" is a real answer." },
  { k: "locations", q: "Where could you actually shoot?", hint: "Rooms and places you can get into — a bar, someone's shop, a logging road." },
  { k: "people", q: "Who's in it besides the band?", hint: "Nobody is a fine answer." },
  { k: "must_have", q: "One shot you'd be gutted to lose?", hint: "The image you already see in your head." },
  { k: "avoid", q: "Anything you definitely don't want?", hint: "" },
  { k: "refs", q: "Videos you like?", hint: "Links or just names — it tells us more than adjectives do." },
  { k: "timing", q: "When does it need to exist?", hint: "A date, a season, or \"no rush\"." },
];

const KINDS = [
  ["performance", "Performance — the band playing"],
  ["narrative", "Narrative — a story with actors"],
  ["live", "Live — shot at a real show"],
  ["lyric", "Lyric video"],
  ["mixed", "Mix of performance and story"],
];

export default function VideoRequest({ bandId, bandName }: { bandId: number; bandName?: string }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [f, setF] = useState<Record<string, string>>({ kind: "performance" });
  const [diy, setDiy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));

  async function submit() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/video-request", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, band_id: bandId, diy }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(false);
    if (r?.error) { setErr(r.error); return; }
    setDone(r.request);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="btn text-sm flex items-center gap-1 mt-3">
        <Video size={14} />Get a music video made
      </button>
    );
  }

  if (done) {
    return (
      <div className="card-h rounded-xl p-4 mt-3">
        <div className="flex items-center gap-2 font-bold mb-1">
          <Check size={16} style={{ color: "#3ddc84" }} />That&apos;s with us.
        </div>
        <p className="text-sm text-muted">
          We read these ourselves — no bot is going to quote you. Expect a reply to{" "}
          <b>{done.contact_email || "your account email"}</b>.
        </p>
        {done.treatment && (
          <>
            <div className="label mt-3 mb-1 flex items-center gap-1">
              <Sparkles size={12} style={{ color: "#ff3d6e" }} />How we read it back
            </div>
            <pre className="text-xs whitespace-pre-wrap rounded-lg p-3"
              style={{ background: "rgba(255,255,255,0.03)", color: "#c9c9d6" }}>{done.treatment}</pre>
            <p className="text-[11px] text-muted mt-2">
              If that isn&apos;t your idea, say so when we get in touch — it&apos;s a starting point, not the plan.
            </p>
          </>
        )}
        <button className="btn mt-3" onClick={() => { setDone(null); setOpen(false); setI(0); setF({ kind: "performance" }); }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="card-h rounded-xl p-4 mt-3">
      <div className="flex items-center gap-2 mb-1">
        <Video size={16} style={{ color: "#ff3d6e" }} />
        <span className="font-bold">A music video for {bandName || "your band"}</span>
        <span className="text-[11px] text-muted ml-auto">{i + 1} of {STEPS.length}</span>
      </div>

      <div className="text-sm font-semibold mt-3">{step.q}</div>
      {step.hint && <div className="text-[11px] text-muted mb-2">{step.hint}</div>}

      {step.k === "kind" ? (
        <select className={inp} value={f.kind || "performance"} onChange={e => set("kind", e.target.value)}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : step.k === "song" ? (
        <div className="flex flex-col gap-2">
          <input className={inp} autoFocus value={f.song || ""} onChange={e => set("song", e.target.value)}
            placeholder="Song title" />
          <input className={inp} value={f.song_link || ""} onChange={e => set("song_link", e.target.value)}
            placeholder="Link to it (optional)" />
        </div>
      ) : (
        <textarea className={inp} rows={3} autoFocus value={f[step.k] || ""}
          onChange={e => set(step.k, e.target.value)} />
      )}

      {last && (
        <label className="flex items-center gap-2 text-sm mt-3">
          <input type="checkbox" checked={diy} onChange={e => setDiy(e.target.checked)} />
          I&apos;d rather make it myself with your tools
          <span className="text-[10px] text-muted">— we&apos;ll set you up instead of quoting a shoot</span>
        </label>
      )}

      {err && <div className="text-sm mt-2" style={{ color: "#e05c7a" }}>{err}</div>}

      <div className="flex items-center gap-2 mt-3">
        {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
        <button className="btn" onClick={() => { setOpen(false); setI(0); }}>Cancel</button>
        <div className="ml-auto flex gap-2">
          {!last && !step.required && (
            <button className="btn" onClick={() => setI(i + 1)}>Skip</button>
          )}
          {last ? (
            <button className="btn btn-neon" disabled={busy || !f.song?.trim()} onClick={submit}>
              {busy ? "Sending…" : "Send it"}
            </button>
          ) : (
            <button className="btn btn-neon"
              disabled={!!step.required && !f[step.k]?.trim()}
              onClick={() => setI(i + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}
