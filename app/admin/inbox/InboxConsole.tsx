"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mail, RefreshCw, Send, User, Building2, Music, CheckCircle2, Clock } from "lucide-react";

// THE INBOX — read and reply without leaving the platform.
//
// Two panes on purpose: the list of conversations on the left, the conversation
// itself on the right. That is the shape every mail client has settled on
// because it is the one that lets you work a queue rather than open one letter
// at a time.
//
// The bit that makes it a CRM rather than a mail client is the match: a reply
// from a venue shows up tied to that venue, with an owner, so "who is chasing
// The Doc Marten" has an answer.

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

const KIND_ICON: Record<string, any> = { venue: Building2, band: Music, tester: User };

export default function InboxConsole() {
  const [data, setData] = useState<any>(null);
  const [thread, setThread] = useState<any>(null);
  const [mine, setMine] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async (m = mine) => {
    const r = await fetch(`/api/admin/inbox?mine=${m ? 1 : 0}`).then(r => r.json()).catch(() => null);
    if (!r) { setNote("Couldn't load the inbox."); return; }
    if (r.error) { setNote(r.error); return; }
    setData(r);
  }, [mine]);

  useEffect(() => { load(); }, [load]);

  async function open(id: number) {
    const r = await fetch(`/api/admin/inbox?thread=${id}`).then(r => r.json()).catch(() => null);
    if (r?.thread) {
      setThread(r.thread); setReply("");
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 60);
      // Opening it clears the unread dot in the list too.
      setData((d: any) => d && ({ ...d, threads: d.threads.map((t: any) => t.id === id ? { ...t, unread: 0 } : t) }));
    }
  }

  async function post(payload: any, label: string) {
    setBusy(label); setNote(null);
    const r = await fetch("/api/admin/inbox", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(null);
    if (r?.error) { setNote(r.error); return null; }
    if (r.thread) setThread(r.thread);
    if (r.threads) setData((d: any) => ({ ...d, threads: r.threads }));
    return r;
  }

  if (!data) {
    return <div className="card p-4 text-sm text-muted">{note || "Opening the mailbox…"}</div>;
  }

  const threads: any[] = data.threads || [];

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <button className="btn btn-neon flex items-center gap-1" disabled={!!busy}
          onClick={async () => {
            const r = await post({ action: "sync" }, "Fetching…");
            if (r) setNote(r.imported ? `${r.imported} new.` : r.error || "Nothing new.");
          }}>
          <RefreshCw size={14} className={busy === "Fetching…" ? "animate-spin" : ""} />
          {busy === "Fetching…" ? "Fetching…" : "Get mail"}
        </button>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mine}
            onChange={e => { setMine(e.target.checked); load(e.target.checked); }} />
          Only mine
        </label>

        <span className="text-[11px] text-muted">
          {data.imap?.configured
            ? <>reading <b>{data.imap.user}</b></>
            : <span style={{ color: "#e05c7a" }}>IMAP not configured</span>}
        </span>
        {data.admin_cc && (
          <span className="text-[11px] text-muted">· replies cc <b>{data.admin_cc}</b></span>
        )}
        {note && <span className="text-[11px] ml-auto" style={{ color: "#9fdfea" }}>{note}</span>}
      </div>

      <div className="grid lg:grid-cols-[340px,1fr] gap-3">
        {/* conversations */}
        <div className="card p-2 flex flex-col gap-1" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {!threads.length && (
            <div className="p-3 text-sm text-muted">
              {mine ? "Nothing assigned to you. Untick “only mine” to see everything."
                    : "No conversations yet — hit Get mail."}
            </div>
          )}
          {threads.map(t => {
            const Icon = KIND_ICON[t.match_kind] || Mail;
            const on = thread?.id === t.id;
            return (
              <button key={t.id} onClick={() => open(t.id)}
                className="text-left rounded-lg px-2.5 py-2 hover:bg-white/[0.04]"
                style={{ background: on ? "rgba(255,61,110,0.10)" : t.unread ? "rgba(255,255,255,0.035)" : "transparent" }}>
                <div className="flex items-center gap-2">
                  {t.unread ? <span style={{ width: 7, height: 7, borderRadius: 99, background: "#ff3d6e" }} /> : null}
                  <span className={"text-sm truncate " + (t.unread ? "font-semibold" : "")}>
                    {t.with_name || t.with_email}
                  </span>
                  <span className="text-[10px] text-muted ml-auto shrink-0">
                    {t.last_at ? new Date(t.last_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="text-xs text-muted truncate mt-0.5">{t.subject || "(no subject)"}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {t.match_name && (
                    <span className="pill text-[9px] flex items-center gap-1">
                      <Icon size={9} />{t.match_name}
                    </span>
                  )}
                  {t.assignee_name && <span className="pill text-[9px]">{t.assignee_name}</span>}
                  {t.status !== "open" && (
                    <span className="pill text-[9px]" style={{ color: t.status === "done" ? "#3ddc84" : "#ffb03d" }}>
                      {t.status}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* the conversation */}
        <div className="card p-4 flex flex-col" style={{ maxHeight: "70vh" }}>
          {!thread ? (
            <div className="text-sm text-muted">Pick a conversation.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-[#2a2a3a]">
                <div className="min-w-0">
                  <div className="font-bold truncate">{thread.subject || "(no subject)"}</div>
                  <div className="text-xs text-muted truncate">
                    {thread.with_name ? `${thread.with_name} · ` : ""}{thread.with_email}
                    {thread.match_name ? ` · ${thread.match_kind} ${thread.match_name}` : ""}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <select className={inp + " w-auto py-1 text-xs"} value={thread.assigned_to || ""}
                    onChange={e => post({ action: "assign", thread: thread.id, user_id: e.target.value || null }, "Assigning…")}>
                    <option value="">unassigned</option>
                    {(data.staff || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.display_name || s.email}</option>
                    ))}
                  </select>
                  <button className="btn px-2 py-1 text-[11px] flex items-center gap-1"
                    onClick={() => post({ action: "status", thread: thread.id, status: thread.status === "done" ? "open" : "done" }, "…")}>
                    {thread.status === "done" ? <><Clock size={11} />reopen</> : <><CheckCircle2 size={11} />done</>}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-3">
                {(thread.messages || []).map((m: any) => (
                  <div key={m.id} className="rounded-xl p-3"
                    style={{
                      background: m.direction === "out" ? "rgba(255,61,110,0.07)" : "rgba(255,255,255,0.03)",
                      marginLeft: m.direction === "out" ? 32 : 0,
                      marginRight: m.direction === "out" ? 0 : 32,
                    }}>
                    <div className="text-[11px] text-muted mb-1">
                      {m.direction === "out" ? "you" : (m.from_name || m.from_email)}
                      {" · "}{m.at ? new Date(m.at).toLocaleString() : ""}
                      {m.has_attachments ? " · has attachments" : ""}
                    </div>
                    {/* Their HTML is shown as text on purpose — rendering a
                        stranger's markup inside our admin is not worth it. */}
                    <div className="text-sm whitespace-pre-wrap">
                      {m.body_text?.trim() || stripHtml(m.body_html || "")}
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>

              <div className="pt-2 border-t border-[#2a2a3a]">
                <textarea className={inp} rows={4} value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder={`Reply to ${thread.with_name || thread.with_email}…`} />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-muted">
                    goes out as {data.imap?.user}{data.admin_cc ? ` · cc ${data.admin_cc}` : ""}
                  </span>
                  <button className="btn btn-neon ml-auto flex items-center gap-1"
                    disabled={!!busy || !reply.trim() || !data.can_send}
                    onClick={async () => {
                      const r = await post({ action: "reply", thread: thread.id, body: reply }, "Sending…");
                      if (r) { setReply(""); setNote("Sent."); load(); }
                    }}>
                    <Send size={14} />{busy === "Sending…" ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Their markup, as readable text. Never dangerouslySetInnerHTML on inbound mail. */
function stripHtml(h: string) {
  return String(h || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").trim();
}
