"use client";
import React, { useCallback, useEffect, useState } from "react";

// The beta-team console.
//
// Owner-scoped: you see your teams, nobody else's. Built around the question
// Dewey actually has — "did my people get told?" — so the send log is a
// first-class part of the page rather than a debug view.

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

export default function BetaConsole() {
  const [teams, setTeams] = useState<any[] | null>(null);
  const [team, setTeam] = useState<number>(0);
  const [d, setD] = useState<any>(null);
  const [emailReady, setEmailReady] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newTeam, setNewTeam] = useState("");
  const [paste, setPaste] = useState("");
  const [addBand, setAddBand] = useState<number | "">("");
  const [addLevel, setAddLevel] = useState<number | "">("");

  const [toBand, setToBand] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const loadTeams = useCallback(async () => {
    const r = await fetch("/api/admin/beta").then(r => r.json()).catch(() => null);
    if (!r) { setTeams([]); return; }
    if (r.error) { setNote(r.error); setTeams([]); return; }
    setTeams(r.teams || []); setEmailReady(r.email_ready !== false);
    if (r.teams?.length && !team) setTeam(r.teams[0].id);
  }, [team]);

  const loadTeam = useCallback(async (id: number) => {
    if (!id) return;
    const r = await fetch(`/api/admin/beta?team=${id}`).then(r => r.json()).catch(() => null);
    if (r && !r.error) { setD(r); setEmailReady(r.email_ready !== false); }
  }, []);

  useEffect(() => { loadTeams(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadTeam(team); }, [team, loadTeam]);

  async function post(payload: any, label: string) {
    setBusy(label); setNote(null);
    const r = await fetch("/api/admin/beta", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ team, ...payload }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error) { setNote(r.error); return null; }
    return r;
  }

  /**
   * Take a pasted list. One per line, "Name <email>" or just an email —
   * because that is how a list actually arrives, out of a phone or a thread.
   */
  function parsePaste(text: string) {
    return text.split(/\n|,/).map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(.*?)[<\s]*([^\s<>,]+@[^\s<>,]+)>?$/);
      if (!m) return null;
      return {
        name: (m[1] || "").replace(/["']/g, "").trim(),
        email: m[2].toLowerCase(),
        band_id: addBand || null,
        level_id: addLevel || null,
      };
    }).filter(Boolean) as any[];
  }

  if (teams === null) return <div className="card p-4 text-sm text-muted">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      {!emailReady && (
        <div className="card p-3 text-sm" style={{ borderColor: "#e05c7a", color: "#e0899c" }}>
          Email isn&apos;t configured on this server, so sending is disabled. Everything else works.
        </div>
      )}
      {note && <div className="card p-3 text-sm" style={{ color: "#e0899c" }}>{note}</div>}

      {/* teams */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-muted">
          Team
          <select className={inp + " mt-1 w-56"} value={team} onChange={e => setTeam(Number(e.target.value))}>
            {!teams.length && <option value={0}>No teams yet</option>}
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.members} in, {t.joined} joined</option>
            ))}
          </select>
        </label>
        <input className={inp + " w-56"} value={newTeam} onChange={e => setNewTeam(e.target.value)}
          placeholder="New team name" />
        <button className="btn btn-neon" disabled={!newTeam.trim() || !!busy}
          onClick={async () => {
            const r = await post({ action: "create_team", name: newTeam.trim() }, "Creating…");
            if (r?.team) { setNewTeam(""); await loadTeams(); setTeam(r.team.id); }
          }}>Create team</button>
      </div>

      {!!team && d && (
        <>
          {/* levels — what a tester gets, and for how long */}
          <div className="card p-4">
            <div className="label mb-1">What testers get</div>
            <p className="text-xs text-muted mb-3">
              You decide the length and the reward. A founding tester and someone who joined
              last week aren&apos;t owed the same thing.
            </p>
            <div className="flex flex-col gap-2">
              {(d.levels || []).map((l: any) => (
                <div key={l.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-[#2a2a3a] p-3">
                  <label className="text-[11px] text-muted">
                    Level
                    <input className={inp + " mt-1 w-40"} defaultValue={l.name}
                      onBlur={e => post({ action: "save_level", level: { ...l, name: e.target.value } }, "Saving…")
                        .then(r => r && setD((x: any) => ({ ...x, levels: r.levels })))} />
                  </label>
                  <label className="text-[11px] text-muted">
                    Free months
                    <input type="number" min={0} max={24} step={0.5} className={inp + " mt-1 w-24"} defaultValue={l.free_months}
                      onBlur={e => post({ action: "save_level", level: { ...l, free_months: e.target.value } }, "Saving…")
                        .then(r => r && setD((x: any) => ({ ...x, levels: r.levels })))} />
                  </label>
                  <label className="text-[11px] text-muted">
                    Per referral
                    <input type="number" min={0} max={24} step={0.5} className={inp + " mt-1 w-24"} defaultValue={l.referral_bonus_months}
                      onBlur={e => post({ action: "save_level", level: { ...l, referral_bonus_months: e.target.value } }, "Saving…")
                        .then(r => r && setD((x: any) => ({ ...x, levels: r.levels })))} />
                  </label>
                  <label className="text-[11px] text-muted flex-1 min-w-[200px]">
                    Anything else they get
                    <input className={inp + " mt-1"} defaultValue={l.perks}
                      onBlur={e => post({ action: "save_level", level: { ...l, perks: e.target.value } }, "Saving…")
                        .then(r => r && setD((x: any) => ({ ...x, levels: r.levels })))} />
                  </label>
                  <span className="pill text-[10px]">{l.members} on this</span>
                  <button className="btn" onClick={async () => {
                    const r = await post({ action: "delete_level", id: l.id }, "Removing…");
                    if (r) setD((x: any) => ({ ...x, levels: r.levels, members: r.members }));
                  }}>Remove</button>
                </div>
              ))}
              <button className="btn self-start" onClick={async () => {
                const r = await post({ action: "save_level", level: { name: "New level", free_months: 3, referral_bonus_months: 1 } }, "Adding…");
                if (r) setD((x: any) => ({ ...x, levels: r.levels }));
              }}>Add a level</button>
            </div>
          </div>

          {/* members */}
          <div className="card p-4">
            <div className="label mb-1">Testers <span className="pill text-[10px] ml-1">{(d.members || []).length}</span></div>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <label className="text-[11px] text-muted flex-1 min-w-[240px]">
                Paste them in — one per line, &quot;Name &lt;email&gt;&quot; or just the email
                <textarea className={inp + " mt-1"} rows={3} value={paste} onChange={e => setPaste(e.target.value)} />
              </label>
              <label className="text-[11px] text-muted">
                Their band
                <select className={inp + " mt-1 w-44"} value={addBand}
                  onChange={e => setAddBand(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— none —</option>
                  {(d.allBands || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-muted">
                Level
                <select className={inp + " mt-1 w-40"} value={addLevel}
                  onChange={e => setAddLevel(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— none —</option>
                  {(d.levels || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <button className="btn btn-neon" disabled={!paste.trim() || !!busy}
                onClick={async () => {
                  const members = parsePaste(paste);
                  if (!members.length) { setNote("Couldn't find an email in that."); return; }
                  const r = await post({ action: "add_members", members }, "Adding…");
                  if (r) { setPaste(""); setNote(`${r.added} added, ${r.updated} updated.`); loadTeam(team); }
                }}>Add</button>
            </div>

            <div className="flex flex-col gap-1">
              {(d.members || []).map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-white/[0.03]">
                  <span className="pill text-[9px]"
                    style={{ color: m.status === "joined" ? "#3ddc84" : "#8a8aa0" }}>{m.status}</span>
                  <span className="truncate">{m.name || m.email}</span>
                  {m.name && <span className="text-xs text-muted truncate">{m.email}</span>}
                  {m.band && <span className="pill text-[9px]">{m.band}</span>}
                  {m.level && <span className="pill text-[9px]" style={{ color: "#ffb03d" }}>
                    {m.level}{m.free_months ? ` · ${m.free_months}mo` : ""}</span>}
                </div>
              ))}
              {!(d.members || []).length && <div className="text-sm text-muted">Nobody yet.</div>}
            </div>
          </div>

          {/* send */}
          <div className="card p-4">
            <div className="label mb-1">Tell them something</div>
            <p className="text-xs text-muted mb-3">
              Sends from the platform, one at a time, and logs every one. Anyone who hasn&apos;t joined
              yet gets their own sign-up link in the mail. Nothing here sends itself — this only
              goes when you press it.
            </p>
            <div className="flex flex-wrap items-end gap-2 mb-2">
              <label className="text-[11px] text-muted">
                Send to
                <select className={inp + " mt-1 w-52"} value={toBand}
                  onChange={e => setToBand(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Everyone in the team ({(d.members || []).length})</option>
                  {(d.bands || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.n})</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-muted flex-1 min-w-[240px]">
                Subject
                <input className={inp + " mt-1"} value={subject} onChange={e => setSubject(e.target.value)} />
              </label>
            </div>
            <textarea className={inp} rows={6} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write it the way you'd say it. Blank line between paragraphs." />
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] text-muted">
                {toBand
                  ? `${(d.bands || []).find((b: any) => b.id === toBand)?.n ?? 0} recipient(s)`
                  : `${(d.members || []).length} recipient(s)`}
              </span>
              <button className="btn btn-neon ml-auto"
                disabled={!emailReady || !subject.trim() || !body.trim() || !!busy}
                onClick={async () => {
                  const r = await post({ action: "send", band: toBand || null, subject, body }, "Sending…");
                  if (r) {
                    setNote(`Sent to ${r.ok} of ${r.sent_to}${r.fail ? ` — ${r.fail} failed` : ""}.`);
                    setSubject(""); setBody(""); loadTeam(team);
                  }
                }}>
                {busy === "Sending…" ? "Sending…" : "Send"}
              </button>
            </div>
          </div>

          {/* what went out */}
          <div className="card p-4">
            <div className="label mb-2">What you&apos;ve sent</div>
            <div className="flex flex-col gap-1">
              {(d.history || []).map((h: any) => (
                <div key={h.id} className="text-sm px-2 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{h.subject}</span>
                    {h.band && <span className="pill text-[9px]">{h.band}</span>}
                    <span className="text-[11px]" style={{ color: "#3ddc84" }}>{h.sent_ok} delivered</span>
                    {!!h.sent_fail && <span className="text-[11px]" style={{ color: "#e05c7a" }}>{h.sent_fail} failed</span>}
                    <span className="text-[11px] text-muted ml-auto">{h.created_at}</span>
                  </div>
                  {h.failed_to && (
                    <div className="text-[11px] mt-0.5" style={{ color: "#e0899c" }}>didn&apos;t reach: {h.failed_to}</div>
                  )}
                </div>
              ))}
              {!(d.history || []).length && <div className="text-sm text-muted">Nothing sent yet.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
