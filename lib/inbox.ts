// THE INBOX — one shared mailbox, worked by the people running production.
//
// Outreach without replies is a megaphone. The venue list is 1,516 rows and
// every one of them can write back; until now that went to a mailbox nobody
// opened from inside the platform, so a "contacted" flag was the end of the
// story rather than the start of it.
//
// Shape, decided with Ben:
//
//   * ONE shared mailbox — welcome@mymymy.studio, the same one everything
//     sends from. Two inboxes would mean two versions of what a venue said.
//   * ASSIGNMENT filters the view. Dewey's calls stay Dewey's: whoever reached
//     out owns the follow-up, and by default you see yours. Nothing is hidden —
//     you can always look at everything — but the default is your own list.
//   * MATCHED to the record. An incoming address is looked up against venues,
//     bands and testers so a reply lands ON the venue rather than in a pile.
//
// Read is IMAP against the same account SMTP uses. Reply goes back out through
// lib/mailer, so there is exactly one way mail leaves this platform.

import { getDb, all, one, run } from "./db";

let ready = false;

export function ensureInboxSchema() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS mail_threads (
      id INTEGER PRIMARY KEY,
      -- The mail world's own thread key, so replies group the way the sender
      -- expects rather than by subject-line guessing.
      thread_key TEXT NOT NULL UNIQUE,
      subject TEXT DEFAULT '',
      with_email TEXT DEFAULT '',      -- the human on the other end
      with_name TEXT DEFAULT '',
      -- What this conversation is ABOUT, resolved once and kept.
      match_kind TEXT DEFAULT '',      -- venue | band | tester | unknown
      match_id INTEGER,
      match_name TEXT DEFAULT '',
      assigned_to INTEGER,             -- whoever owns the follow-up
      status TEXT DEFAULT 'open',      -- open | waiting | done
      unread INTEGER DEFAULT 1,
      last_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mail_messages (
      id INTEGER PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES mail_threads(id),
      message_id TEXT UNIQUE,          -- RFC Message-ID; stops double-imports
      direction TEXT NOT NULL,         -- in | out
      from_email TEXT DEFAULT '',
      from_name TEXT DEFAULT '',
      to_email TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      body_text TEXT DEFAULT '',
      body_html TEXT DEFAULT '',
      has_attachments INTEGER DEFAULT 0,
      sent_by INTEGER,                 -- our user, when direction='out'
      at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mail_thread ON mail_messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_thread_assigned ON mail_threads(assigned_to);
  `);
  ready = true;
}

/** Who may work the inbox: production staff, not every admin by accident. */
export const canUseInbox = (u: any) =>
  !!u && ["super_admin", "manager", "admin", "operator"].includes(String(u.role || ""));

function imapCfg() {
  return {
    host: process.env.IMAP_HOST || process.env.SMTP_HOST?.replace(/^smtp\./, "imap.") || "",
    port: Number(process.env.IMAP_PORT || 993),
    user: process.env.IMAP_USER || process.env.SMTP_USER || "",
    pass: process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "",
  };
}

export function imapConfigured() {
  const c = imapCfg();
  return !!(c.host && c.user && c.pass);
}

export function imapStatus() {
  const c = imapCfg();
  return { configured: imapConfigured(), host: c.host, port: c.port, user: c.user };
}

const addr = (a: any) => String(a?.value?.[0]?.address || a?.text || "").toLowerCase().trim();
const nameOf = (a: any) => String(a?.value?.[0]?.name || "").trim();

/**
 * Who is this? Looked up across everything that can write to us.
 *
 * Resolved once when the thread is created and then kept, so renaming a venue
 * later does not silently re-point an old conversation at something else.
 */
export function matchContact(email: string) {
  ensureInboxSchema();
  const e = String(email || "").toLowerCase().trim();
  if (!e) return { kind: "unknown", id: null as number | null, name: "" };
  try {
    const v = one<any>("SELECT id,name FROM venues WHERE lower(contact) LIKE ?", `%${e}%`);
    if (v) return { kind: "venue", id: v.id, name: v.name };
  } catch {}
  try {
    const u = one<any>("SELECT id,display_name,band_id FROM users WHERE lower(email)=?", e);
    if (u?.band_id) {
      const b = one<any>("SELECT id,name FROM bands WHERE id=?", u.band_id);
      if (b) return { kind: "band", id: b.id, name: b.name };
    }
    if (u) return { kind: "tester", id: u.id, name: u.display_name || e };
  } catch {}
  try {
    const m = one<any>("SELECT team_id,name FROM beta_members WHERE lower(email)=?", e);
    if (m) return { kind: "tester", id: m.team_id, name: m.name || e };
  } catch {}
  return { kind: "unknown", id: null, name: "" };
}

/** Whoever did the outreach owns the reply. */
function suggestAssignee(kind: string, id: number | null) {
  if (!id) return null;
  try {
    if (kind === "venue" || kind === "band") {
      const t = kind === "venue" ? "venues" : "bands";
      const r = one<any>(`SELECT assigned_to, last_contacted_by FROM ${t} WHERE id=?`, id);
      return r?.assigned_to || r?.last_contacted_by || null;
    }
  } catch {}
  return null;
}

/**
 * Pull new mail.
 *
 * Only ever reads and marks nothing on the server — the mailbox stays usable
 * from a phone or a normal client, which matters because this is a real
 * mailbox people already use.
 */
export async function syncInbox(limit = 60): Promise<{ imported: number; error?: string }> {
  ensureInboxSchema();
  if (!imapConfigured()) return { imported: 0, error: "IMAP isn't configured on this server." };
  const c = imapCfg();

  let client: any;
  try {
    const { ImapFlow } = await import("imapflow");
    const { simpleParser } = await import("mailparser");
    client = new ImapFlow({
      host: c.host, port: c.port, secure: c.port === 993,
      auth: { user: c.user, pass: c.pass },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    let imported = 0;
    try {
      const total = client.mailbox?.exists || 0;
      if (!total) return { imported: 0 };
      const from = Math.max(1, total - limit + 1);
      for await (const msg of client.fetch(`${from}:*`, { source: true, envelope: true })) {
        const parsed: any = await simpleParser(msg.source);
        const messageId = String(parsed.messageId || "").trim();
        if (!messageId) continue;
        if (one<any>("SELECT 1 x FROM mail_messages WHERE message_id=?", messageId)) continue;

        const fromEmail = addr(parsed.from);
        // Our own outgoing copies are not incoming mail.
        if (fromEmail === c.user.toLowerCase()) continue;

        // Group by References/In-Reply-To when present; otherwise this message
        // starts its own thread.
        const refs = String(parsed.references || parsed.inReplyTo || "").split(/\s+/).filter(Boolean);
        const key = refs[0] || messageId;

        let thread = one<any>("SELECT * FROM mail_threads WHERE thread_key=?", key)
          || one<any>("SELECT * FROM mail_threads WHERE with_email=? AND subject=?",
               fromEmail, String(parsed.subject || "").replace(/^(re|fwd):\s*/i, "").trim());

        if (!thread) {
          const m = matchContact(fromEmail);
          const r = run(`INSERT INTO mail_threads(thread_key,subject,with_email,with_name,
                           match_kind,match_id,match_name,assigned_to,last_at,unread)
                         VALUES(?,?,?,?,?,?,?,?,?,1)`,
            key, String(parsed.subject || "").slice(0, 300), fromEmail, nameOf(parsed.from),
            m.kind, m.id, m.name, suggestAssignee(m.kind, m.id),
            (parsed.date || new Date()).toISOString());
          thread = one<any>("SELECT * FROM mail_threads WHERE id=?", Number(r.lastInsertRowid));
        }

        run(`INSERT INTO mail_messages(thread_id,message_id,direction,from_email,from_name,
               to_email,subject,body_text,body_html,has_attachments,at)
             VALUES(?,?,'in',?,?,?,?,?,?,?,?)`,
          thread.id, messageId, fromEmail, nameOf(parsed.from), c.user,
          String(parsed.subject || "").slice(0, 300),
          String(parsed.text || "").slice(0, 20000),
          String(parsed.html || "").slice(0, 60000),
          (parsed.attachments?.length || 0) > 0 ? 1 : 0,
          (parsed.date || new Date()).toISOString());

        run("UPDATE mail_threads SET unread=1, status='open', last_at=? WHERE id=?",
          (parsed.date || new Date()).toISOString(), thread.id);
        imported++;
      }
    } finally { lock.release(); }
    return { imported };
  } catch (e: any) {
    return { imported: 0, error: `IMAP: ${e?.message || e}` };
  } finally {
    try { await client?.logout(); } catch {}
  }
}

export function threads(opts: { assignedTo?: number | null; mine?: boolean; status?: string } = {}) {
  ensureInboxSchema();
  const where: string[] = [];
  const args: any[] = [];
  if (opts.mine && opts.assignedTo) { where.push("assigned_to=?"); args.push(opts.assignedTo); }
  if (opts.status) { where.push("status=?"); args.push(opts.status); }
  const sql = `SELECT t.*,
      (SELECT COUNT(*) FROM mail_messages m WHERE m.thread_id=t.id) msg_count,
      u.display_name assignee_name
    FROM mail_threads t LEFT JOIN users u ON u.id=t.assigned_to
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY t.unread DESC, COALESCE(t.last_at, t.created_at) DESC LIMIT 200`;
  return all<any>(sql, ...args);
}

export function threadWith(id: number) {
  ensureInboxSchema();
  const t = one<any>("SELECT * FROM mail_threads WHERE id=?", id);
  if (!t) return null;
  return { ...t, messages: all<any>("SELECT * FROM mail_messages WHERE thread_id=? ORDER BY id", id) };
}

export function markRead(id: number) {
  ensureInboxSchema();
  run("UPDATE mail_threads SET unread=0 WHERE id=?", id);
}

export function assign(id: number, userId: number | null) {
  ensureInboxSchema();
  run("UPDATE mail_threads SET assigned_to=? WHERE id=?", userId, id);
}

export function setThreadStatus(id: number, status: string) {
  ensureInboxSchema();
  const ok = ["open", "waiting", "done"].includes(status);
  if (ok) run("UPDATE mail_threads SET status=? WHERE id=?", status, id);
}

/** Record our own reply so the thread reads as a conversation. */
export function logOutgoing(threadId: number, o: {
  to: string; subject: string; html: string; text?: string; sentBy: number; messageId?: string;
}) {
  ensureInboxSchema();
  run(`INSERT INTO mail_messages(thread_id,message_id,direction,from_email,to_email,
         subject,body_text,body_html,sent_by,at)
       VALUES(?,?,'out',?,?,?,?,?,?,datetime('now'))`,
    threadId, o.messageId || `out-${threadId}-${Date.now()}`,
    process.env.SMTP_FROM || process.env.SMTP_USER || "", o.to,
    o.subject.slice(0, 300), String(o.text || "").slice(0, 20000), o.html.slice(0, 60000), o.sentBy);
  run("UPDATE mail_threads SET status='waiting', unread=0, last_at=datetime('now') WHERE id=?", threadId);
}
