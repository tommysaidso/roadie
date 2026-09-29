"use client";
import React, { useCallback, useEffect, useState } from "react";
import Help from "./Help";

// THE ATOM LANE — the other half of an episode, inside the editor.
//
// The timeline builds the spine: pictures, sound, the thing that plays start to
// finish. But an episode is only interactive because of the ATOMS — the bank of
// pre-rendered answers the AI reaches for when a viewer interrupts. Those have
// been hand-written in JSON, which is why they drift out of step with what the
// episode actually says.
//
// So they live here now, beside the timeline, with the same rules the template
// spells out and a warning whenever the bank is heading for the flat feeling
// that has sunk every episode after the first.

type Atom = {
  id: string; topic?: string; intent: string[]; vo: string;
  grounds?: string[]; jump_to?: string; audio?: string; sec?: number;
  voice?: string; character?: string;
};

// Gemini prebuilt voices. Not the full list — a working cast, picked to sound
// like different PEOPLE rather than the same read at different pitches. Any
// other valid Gemini voice name can be typed in.
const VOICES = [
  { id: "", label: "Narrator (episode default)" },
  { id: "Charon", label: "Charon — dry, measured (the narrator)" },
  { id: "Puck", label: "Puck — light, quick" },
  { id: "Kore", label: "Kore — warm, even" },
  { id: "Fenrir", label: "Fenrir — heavy, gravelled" },
  { id: "Aoede", label: "Aoede — bright, younger" },
  { id: "Zephyr", label: "Zephyr — easy, open" },
];

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

export default function AtomLane() {
  const [eps, setEps] = useState<any[] | null>(null);
  const [ep, setEp] = useState<string>("");
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [review, setReview] = useState<{ level: string; msg: string }[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [rec, setRec] = useState<{ id: string; mr: MediaRecorder; chunks: Blob[] } | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  /**
   * Hot-record a take straight into an atom.
   *
   * The microphone stream is stopped explicitly on finish — leaving tracks live
   * keeps the browser's recording indicator on, which looks like the studio is
   * listening to the room after you have finished.
   */
  async function startRec(id: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.start();
      setRec({ id, mr, chunks });
      setNote("Recording — hit stop when you're done.");
    } catch (e: any) {
      setNote(`No microphone: ${e?.message || e}`);
    }
  }

  function stopRec(mode: "use" | "revoice") {
    const r = rec;
    if (!r) return;
    r.mr.onstop = async () => {
      r.mr.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(r.chunks, { type: "audio/webm" });
      setRec(null);
      await sendAudio(r.id, new File([blob], `${r.id}.webm`, { type: "audio/webm" }), mode);
    };
    r.mr.stop();
  }

  async function sendAudio(id: string, file: File, mode: "use" | "revoice") {
    if (dirty) await save();
    setBusy(mode === "revoice" ? "Listening, then re-voicing…" : "Taking the audio…");
    setHeard(null);
    const fd = new FormData();
    fd.append("ep", ep); fd.append("id", id); fd.append("mode", mode); fd.append("file", file);
    const r = await fetch("/api/admin/studio/atoms/audio", { method: "POST", body: fd })
      .then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error) { setNote(r.error); return; }
    setAtoms(r.atoms || []); setReview(r.review || []);
    if (r.heard) setHeard(r.heard);
    setNote(mode === "revoice" ? `${id} re-voiced in the show's voice.` : `${id} now uses your take.`);
  }

  useEffect(() => {
    fetch("/api/admin/studio/atoms").then(r => r.json()).then(d => {
      setEps(d.episodes || []);
      if (d.episodes?.length && !ep) setEp(d.episodes[0].id);
    }).catch(() => setEps([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    const r = await fetch(`/api/admin/studio/atoms?ep=${encodeURIComponent(id)}`)
      .then(r => r.json()).catch(() => null);
    if (!r) { setNote("Couldn't read that episode."); return; }
    setAtoms(r.atoms || []); setReview(r.review || []);
    setTitle(r.title || ""); setStatus(r.status || "");
    setDirty(false);
  }, []);
  useEffect(() => { load(ep); }, [ep, load]);

  const patch = (id: string, p: Partial<Atom>) => {
    setAtoms(a => a.map(x => (x.id === id ? { ...x, ...p } : x)));
    setDirty(true);
  };

  async function save() {
    setBusy("Saving…"); setNote(null);
    const r = await fetch("/api/admin/studio/atoms", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ep, atoms }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error) { setNote(r.error); return; }
    setAtoms(r.atoms || []); setReview(r.review || []); setDirty(false);
    setNote("Saved to the episode source.");
  }

  async function render(id: string) {
    // Save first — rendering voices whatever is ON DISK, so an unsaved edit
    // would quietly render the old words.
    if (dirty) await save();
    setBusy(`Voicing ${id}…`); setNote(null);
    const r = await fetch("/api/admin/studio/atoms", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ep, render: id }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error) { setNote(r.error); return; }
    setAtoms(r.atoms || []); setReview(r.review || []);
    setNote(`${id} voiced and the manifest is in sync.`);
  }

  function add() {
    const n = atoms.length + 1;
    setAtoms(a => [...a, {
      id: `a_new${n}`, topic: "", intent: [], vo: "", grounds: [],
    }]);
    setOpen(`a_new${n}`);
    setDirty(true);
  }

  if (eps === null) return <div className="card p-4 text-sm text-muted">Reading episodes…</div>;
  if (!eps.length) return (
    <div className="card p-4 text-sm text-muted">
      No episode sources found in <code>content/</code>. Copy <code>roadietv-TEMPLATE.json</code> to start one.
    </div>
  );

  const unrendered = atoms.filter(a => !a.audio).length;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="label flex items-center gap-1.5">
          Answer bank
          <Help title="Atoms — the interactive half">
            The timeline builds the spine, the part that plays start to finish. This is the
            other half: the answers the AI reaches for when a viewer interrupts.
            <br /><br />
            They are <b>pre-rendered</b> on purpose. Generating an answer live costs three to
            five seconds of dead air, and that silence is what stops a viewer believing they
            are talking to the documentary. Rendered ahead, an answer starts in under a second.
            <br /><br />
            Each one has to <b>stand alone</b> — atoms play in any order, so anything opening
            with &quot;as I mentioned&quot; breaks the moment it comes first. And write intents as
            things people actually <i>say</i>, not keywords: &quot;how does it pay&quot; works where
            &quot;revenue&quot; does not.
          </Help>
        </span>

        <select className={inp + " w-auto"} value={ep} onChange={e => setEp(e.target.value)}>
          {eps.map(e => <option key={e.id} value={e.id}>{e.id} — {e.title}</option>)}
        </select>

        <span className="pill text-[10px]">{atoms.length} atoms</span>
        {unrendered > 0 && (
          <span className="pill text-[10px]" style={{ color: "#ffb03d" }}>{unrendered} unvoiced</span>
        )}
        {status && <span className="pill text-[10px]">{status}</span>}

        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={add}>Add atom</button>
          <button className={"btn " + (dirty ? "btn-neon" : "")} onClick={save} disabled={!dirty}>
            {dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      {title && <div className="text-xs text-muted">{title}</div>}
      {busy && <div className="text-sm" style={{ color: "#3df0ff" }}>{busy}</div>}
      {note && <div className="text-sm text-muted">{note}</div>}
      {heard && (
        <div className="text-xs rounded-lg px-2 py-1.5" style={{ background: "rgba(61,240,255,0.08)", color: "#9fdfea" }}>
          Heard: &ldquo;{heard}&rdquo; — the atom&apos;s text now matches this, so the words and the audio agree.
        </div>
      )}

      {/* What will make this episode feel flat, before it gets rendered. */}
      {review.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {review.map((r, i) => (
            <div key={i} className="text-xs rounded-lg px-2 py-1.5"
              style={{
                background: r.level === "warn" ? "rgba(224,92,122,0.10)" : "rgba(255,255,255,0.03)",
                color: r.level === "warn" ? "#e0899c" : "#8a8aa0",
              }}>
              {r.msg}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {atoms.map(a => (
          <div key={a.id} className="rounded-xl border border-[#2a2a3a]">
            <button
              onClick={() => setOpen(open === a.id ? null : a.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]">
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: a.audio ? "rgba(61,220,132,0.15)" : "rgba(255,176,61,0.15)",
                         color: a.audio ? "#3ddc84" : "#ffb03d" }}>
                {a.audio ? `${a.sec ?? "?"}s` : "no audio"}
              </span>
              <span className="text-sm font-mono">{a.id}</span>
              <span className="text-xs text-muted truncate flex-1">
                {a.topic || (a.vo || "").slice(0, 60)}
              </span>
              <span className="text-[10px] text-muted">{(a.intent || []).length} intents</span>
            </button>

            {open === a.id && (
              <div className="px-3 pb-3 flex flex-col gap-2 border-t border-[#2a2a3a] pt-3">
                <div className="flex gap-2 flex-wrap">
                  <label className="text-[11px] text-muted">
                    id
                    <input className={inp + " mt-1 w-40 font-mono"} value={a.id}
                      onChange={e => patch(a.id, { id: e.target.value })} />
                  </label>
                  <label className="text-[11px] text-muted flex-1 min-w-[160px]">
                    topic
                    <input className={inp + " mt-1"} value={a.topic || ""} placeholder="the objection this answers"
                      onChange={e => patch(a.id, { topic: e.target.value })} />
                  </label>
                  <label className="text-[11px] text-muted">
                    character
                    <select className={inp + " mt-1 w-52"} value={a.voice || ""}
                      onChange={e => patch(a.id, { voice: e.target.value || undefined })}>
                      {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] text-muted">
                    who they are
                    <input className={inp + " mt-1 w-36"} value={a.character || ""} placeholder="the promoter"
                      onChange={e => patch(a.id, { character: e.target.value })} />
                  </label>
                  <label className="text-[11px] text-muted">
                    jump to beat
                    <input className={inp + " mt-1 w-24 font-mono"} value={a.jump_to || ""} placeholder="b7"
                      onChange={e => patch(a.id, { jump_to: e.target.value })} />
                  </label>
                </div>

                <label className="text-[11px] text-muted">
                  how people ask it — one per line
                  <textarea className={inp + " mt-1"} rows={3}
                    value={(a.intent || []).join("\n")}
                    placeholder={"how does it pay\nwhat's the margin\nwhere does the money come from"}
                    onChange={e => patch(a.id, { intent: e.target.value.split("\n") })} />
                </label>

                <label className="text-[11px] text-muted">
                  the answer — must stand alone in any order
                  <textarea className={inp + " mt-1"} rows={5} value={a.vo}
                    onChange={e => patch(a.id, { vo: e.target.value })} />
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[11px] text-muted">
                    grounds
                    <input className={inp + " mt-1 w-40 font-mono"} value={(a.grounds || []).join(", ")}
                      placeholder="s03, s05"
                      onChange={e => patch(a.id, { grounds: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
                  </label>
                  {a.audio && (
                    <audio controls src={`/roadietv/${ep}/${a.audio}`} className="h-8 mt-4" />
                  )}
                  <div className="ml-auto flex gap-2 mt-4 flex-wrap">
                    <button className="btn" onClick={() => render(a.id)} disabled={!!busy || !a.vo.trim()}>
                      {a.audio ? "Re-voice" : "Voice it"}
                    </button>

                    {rec?.id === a.id ? (
                      <>
                        <button className="btn btn-neon" onClick={() => stopRec("revoice")}>
                          Stop → show&apos;s voice
                        </button>
                        <button className="btn" onClick={() => stopRec("use")}>Stop → keep mine</button>
                      </>
                    ) : (
                      <button className="btn" onClick={() => startRec(a.id)} disabled={!!busy || !!rec}>
                        Record
                      </button>
                    )}

                    <label className="btn cursor-pointer">
                      Upload
                      <input type="file" hidden accept="audio/*"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) sendAudio(a.id, f, "use");
                          e.currentTarget.value = "";
                        }} />
                    </label>
                    <button className="btn" onClick={() => {
                      setAtoms(x => x.filter(k => k.id !== a.id)); setDirty(true);
                    }}>Remove</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
