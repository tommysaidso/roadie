"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Users, Check, Mail } from "lucide-react";

// The lineup — who's in the band, and how far along they are.
//
// Two things this has to make obvious at a glance, because they are the two
// questions a controller actually has:
//
//   1. Who have I invited who hasn't shown up yet?  (amber, "waiting")
//   2. Who is fully set up?                         (green tick)
//
// And one thing it has to say out loud when you remove someone: their account
// survives. A band cannot delete a person — they go back to being a solo
// artist with their own profile and their own songs.

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

export default function BandLineup({ bandId, bandName }: { bandId: number; bandName?: string }) {
  const [members, setMembers] = useState<any[] | null>(null);
  const [canControl, setCanControl] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [f, setF] = useState({ email: "", name: "", instrument: "" });
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/bands/members?band=${bandId}`).then(r => r.json()).catch(() => null);
    if (!r) { setMembers([]); return; }
    setMembers(r.members || []); setCanControl(!!r.can_control);
  }, [bandId]);
  useEffect(() => { load(); }, [load]);

  async function post(payload: any) {
    setBusy(true); setNote(null);
    const r = await fetch("/api/bands/members", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ band: bandId, ...payload }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(false);
    if (r?.error) { setNote(r.error); return null; }
    if (r.members) setMembers(r.members);
    return r;
  }

  if (members === null) return null;

  const waiting = members.filter(m => m.status === "invited").length;

  return (
    <div className="mt-3 rounded-xl border border-[#2a2a3a]">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03]">
        <Users size={15} style={{ color: "#3df0ff" }} />
        <span className="font-semibold text-sm">Lineup</span>
        <span className="pill text-[10px]">{members.length}</span>
        {waiting > 0 && (
          <span className="pill text-[10px]" style={{ color: "#ffb03d" }}>{waiting} waiting</span>
        )}
        <span className="ml-auto text-xs text-muted">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-[#2a2a3a] pt-3 flex flex-col gap-2">
          {note && <div className="text-xs" style={{ color: "#e0899c" }}>{note}</div>}

          {members.map(m => {
            const p = m.progress || {};
            const name = m.name || m.user_name || m.email;
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                {/* Green only when they are actually set up and active. */}
                <span title={p.complete ? "all set" : `${p.done ?? 0} of ${p.total ?? 4} done`}
                  style={{
                    width: 8, height: 8, borderRadius: 99, flex: "0 0 auto",
                    background: p.complete ? "#3ddc84"
                      : m.status === "invited" ? "#ffb03d"
                      : m.status === "inactive" ? "#5a5a6a" : "#4cc9f0",
                  }} />
                <span className={"truncate " + (m.status === "inactive" ? "text-muted line-through" : "")}>
                  {name}
                </span>
                {m.instrument && <span className="text-[11px] text-muted truncate">{m.instrument}</span>}
                {m.role === "controller" && <span className="pill text-[9px]">runs it</span>}
                {m.status === "invited" && (
                  <span className="pill text-[9px]" style={{ color: "#ffb03d" }}>
                    <Mail size={9} className="inline mr-0.5" />waiting
                  </span>
                )}

                {canControl && m.role !== "controller" && (
                  <div className="ml-auto flex gap-1 shrink-0">
                    <button className="pill text-[9px] hover:border-neon" disabled={busy}
                      onClick={() => post({ action: "status", member: m.id,
                        status: m.status === "inactive" ? "active" : "inactive" })}>
                      {m.status === "inactive" ? "bring back" : "sit out"}
                    </button>
                    {confirmRemove === m.id ? (
                      <button className="pill text-[9px]" style={{ color: "#e05c7a" }} disabled={busy}
                        onClick={async () => {
                          const r = await post({ action: "remove", member: m.id });
                          setConfirmRemove(null);
                          if (r?.note) setNote(r.note);
                        }}>really remove</button>
                    ) : (
                      <button className="pill text-[9px] hover:border-neon"
                        onClick={() => setConfirmRemove(m.id)}>remove</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!members.length && <div className="text-sm text-muted">Just you so far.</div>}

          {canControl && (
            <>
              <div className="grid sm:grid-cols-3 gap-2 mt-1">
                <input className={inp} placeholder="their email" value={f.email}
                  onChange={e => setF(s => ({ ...s, email: e.target.value }))} />
                <input className={inp} placeholder="name" value={f.name}
                  onChange={e => setF(s => ({ ...s, name: e.target.value }))} />
                <input className={inp} placeholder="plays" value={f.instrument}
                  onChange={e => setF(s => ({ ...s, instrument: e.target.value }))} />
              </div>
              <button className="btn btn-neon self-start" disabled={busy || !f.email.trim()}
                onClick={async () => {
                  const r = await post({ action: "invite", ...f });
                  if (r) {
                    setF({ email: "", name: "", instrument: "" });
                    setNote(r.mailed ? "Invited — they've been emailed a link."
                      : r.already ? "Already on the list."
                      : "Added. (No email went out — mail isn't configured here.)");
                  }
                }}>
                Add to the band
              </button>
              <p className="text-[11px] text-muted">
                They get their own profile and their own songs stay theirs. Removing someone never
                deletes their account — they go back to being a solo artist.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
