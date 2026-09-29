"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import PromptStudio, { Shot } from "./PromptStudio";
import Timeline, { Doc, emptyDoc, newClip, migrateDoc } from "./Timeline";
import MotionLane, { MotionClip } from "./MotionLane";
import StockShelf, { StockItem } from "./StockShelf";
import Help from "./Help";
import AtomLane from "./AtomLane";
import Dock, { resetDockLayout } from "./Dock";
import { makeTransport, ClockPanel, ScrubPanel, VideoPanel } from "./Transport";

// The whole studio on one page: make pictures up top, cut them together below,
// export, then hang the result on a sponsor offer.

export default function StudioApp({ sponsors }: { sponsors: any[] }) {
  const [doc, setDoc] = useState<Doc>(emptyDoc());
  const [bpm, setBpm] = useState(120);
  const [name, setName] = useState("Untitled promo");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [sponsorId, setSponsorId] = useState<number | "">("");
  const [projects, setProjects] = useState<any[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [tab, setTab] = useState<"make" | "move" | "cut" | "ask">("make");

  // The shared playhead. Created once and never replaced — the panels hold this
  // exact object and read it on their own animation frame.
  const transport = useRef(makeTransport()).current;
  // Which floating panels are up. Remembered, so the room you set up is the
  // room you come back to.
  const [panels, setPanels] = useState<Record<string, boolean>>(
    { video: false, scrub: false, clock: false });
  useEffect(() => {
    try {
      const raw = localStorage.getItem("roadie.dock.open");
      if (raw) setPanels(p => ({ ...p, ...JSON.parse(raw) }));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("roadie.dock.open", JSON.stringify(panels)); } catch {}
  }, [panels]);
  const toggle = (k: string) => setPanels(p => ({ ...p, [k]: !p[k] }));

  const loadProjects = useCallback(async () => {
    const r = await fetch("/api/admin/studio/project").then(r => r.json()).catch(() => null);
    if (r?.projects) setProjects(r.projects);
  }, []);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Picking a shot arms the motion lane as well as dropping it on the timeline,
  // so "make it move" is one click away from the thing you just chose.
  /** End of a track — where the next clip should land when you add one. */
  function endOf(d: Doc, track = 0) {
    return d.clips.filter(c => c.track === track)
                  .reduce((a, c) => Math.max(a, c.start + c.dur), 0);
  }

  type Pick = { id: number; url: string; prompt: string };
  const [picked, setPicked] = useState<Pick | null>(null);
  const [endPick, setEndPick] = useState<Pick | null>(null);

  function useShot(s: Shot, url: string) {
    setPicked({ id: s.id, url, prompt: s.prompt });
    setDoc(d => ({ ...d, clips: [...d.clips, newClip(url, s.id, "image", undefined, endOf(d))] }));
    setTab("cut");
  }

  function useStock(i: StockItem) {
    // A licensed clip is already moving, so it goes on as a video. A still
    // behaves exactly like a generated plate — including as a motion start
    // frame, since the pool stages any local file the same way.
    setDoc(d => ({ ...d, clips: [...d.clips, newClip(i.url, undefined, i.kind === "video" ? "video" : "image", undefined, endOf(d))] }));
    setTab("cut");
  }

  function useClip(c: MotionClip) {
    if (!c.url) return;
    // Default the clip's hold to its real length so it plays once, whole.
    setDoc(d => ({ ...d, clips: [...d.clips, newClip(c.url!, c.id, "video", c.seconds || 4.84, endOf(d))] }));
    setTab("cut");
  }

  async function save() {
    const body = {
      id: projectId, name, bpm, doc,
      duration: doc.clips.reduce((a, c) => Math.max(a, c.start + c.dur), 0) || 1,
      sponsor_id: sponsorId || null,
    };
    const r = await fetch("/api/admin/studio/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setSaved(r.error); return; }
    setProjectId(r.id);
    setSaved(`Saved at ${new Date().toLocaleTimeString()}`);
    loadProjects();
  }

  async function open(id: number) {
    const r = await fetch(`/api/admin/studio/project?id=${id}`).then(r => r.json()).catch(() => null);
    if (!r?.project) return;
    const p = r.project;
    let parsed: Doc = emptyDoc();
    try { parsed = migrateDoc({ ...emptyDoc(), ...JSON.parse(p.doc || "{}") }); } catch {}
    setDoc(parsed);
    setBpm(p.bpm || 120);
    setName(p.name);
    setProjectId(p.id);
    setSponsorId(p.sponsor_id || "");
    setTab("cut");
  }

  const inp = "bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
              "focus:outline-none focus:border-[#ff3d6e]";

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input className={inp + " flex-1 min-w-[200px] font-semibold"} value={name}
          onChange={e => setName(e.target.value)} placeholder="Name this promo" />

        <select className={inp} value={sponsorId}
          onChange={e => setSponsorId(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">Not tied to a sponsor</option>
          {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button className="btn btn-neon" onClick={save}>Save</button>

        <select className={inp} value="" onChange={e => e.target.value && open(Number(e.target.value))}>
          <option value="">Open a saved promo…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <button className="btn" onClick={() => {
          setDoc(emptyDoc()); setProjectId(null); setName("Untitled promo"); setSponsorId(""); setTab("make");
        }}>New</button>

        {saved && <span className="text-sm text-[#8a8aa0]">{saved}</span>}
        <Help title="How this works">
          Make pictures in <b>Make</b>, then switch to <b>Cut</b> to put them in order,
          add music and export. Save keeps the whole edit so you can come back to it.
          Tie it to a sponsor and it shows up on their offer.
        </Help>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(["make", "move", "cut", "ask"] as const).map((t, i) => (
          <button key={t} onClick={() => setTab(t)}
            className={"btn " + (tab === t ? "btn-neon" : "")}>
            {t === "make" ? "1 · Make pictures"
              : t === "move" ? "2 · Make it move"
              : t === "cut" ? `3 · Cut it together${doc.clips.length ? ` (${doc.clips.length})` : ""}`
              : "4 · Answer bank"}
          </button>
        ))}

        {/* Floating panels. They sit over the whole studio, so they are useful
            from any step — check the clock while you are still generating. */}
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-[11px] text-[#8a8aa0]">panels</span>
          {([["video", "Video"], ["scrub", "Scrub"], ["clock", "Clock"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => toggle(k)}
              className={"btn px-2 py-1 text-[11px] " + (panels[k] ? "btn-neon" : "")}>{label}</button>
          ))}
          <button className="btn px-2 py-1 text-[11px]"
            title="Put every panel back where it started"
            onClick={() => { resetDockLayout(); setPanels({ video: true, scrub: true, clock: true }); location.reload(); }}>
            Reset layout
          </button>
          <Help title="Floating panels">
            Drag a panel by its title bar to move it, drag any edge or corner to size it.
            Double-click the title bar to roll it up. Where you put them is remembered.
            <br /><br />
            <b>Reset layout</b> puts them all back if one ever ends up somewhere awkward.
          </Help>
        </div>
      </div>

      {/* Both stay mounted: the timeline holds decoded images and an object-URL
          audio track, and unmounting to switch tabs would throw them away. */}
      <div className={tab === "make" ? "" : "hidden"}>
        <PromptStudio onUse={useShot} />
        {/* Before generating a plate, check whether a real licensed one exists. */}
        <div className="mt-4"><StockShelf onUse={useStock} brief={[name, sponsors.find(x=>x.id===sponsorId)?.name].filter(Boolean).join(" — ")} /></div>
      </div>
      <div className={tab === "move" ? "" : "hidden"}>
        <MotionLane still={picked} endStill={endPick} onUse={useClip}
          onClearEnd={() => setEndPick(null)} />
      </div>
      <div className={tab === "cut" ? "" : "hidden"}>
        <Timeline doc={doc} setDoc={setDoc} bpm={bpm} setBpm={setBpm} transport={transport} />
      </div>
      {/* The interactive half. Not mounted until opened — it reads episode
          sources off disk and there is no reason to do that while cutting. */}
      {tab === "ask" && <AtomLane />}

      <Dock id="video" title="Video window" open={panels.video} onClose={() => toggle("video")}
        initial={{ x: 60, y: 90, w: 520, h: 360 }}>
        <VideoPanel t={transport} />
      </Dock>
      <Dock id="clock" title="Clock" open={panels.clock} onClose={() => toggle("clock")}
        accent="#3ddc84" initial={{ x: 610, y: 90, w: 320, h: 190 }}>
        {/* container queries let the digits grow with the panel */}
        <div style={{ containerType: "inline-size", height: "100%" }}>
          <ClockPanel t={transport} />
        </div>
      </Dock>
      <Dock id="scrub" title="Scrub" open={panels.scrub} onClose={() => toggle("scrub")}
        accent="#4cc9f0" initial={{ x: 60, y: 470, w: 520, h: 130 }}>
        <ScrubPanel t={transport} />
      </Dock>
    </div>
  );
}
