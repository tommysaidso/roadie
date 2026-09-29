"use client";
import { useEffect, useState } from "react";
import { Phone, Mail, Users, MessageSquare, Plus, Check, Trash2, Calendar } from "lucide-react";

type Contact = {
  id: number;
  contact_name: string;
  contact_org: string | null;
  contact_email: string | null;
  method: string;
  notes: string | null;
  outcome: string;
  contacted_at: string;
  next_followup_at: string | null;
  created_by: string | null;
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  call:    <Phone size={13} />,
  email:   <Mail size={13} />,
  meeting: <Users size={13} />,
  text:    <MessageSquare size={13} />,
};

const OUTCOME_COLORS: Record<string, string> = {
  pending:    "text-yellow-400",
  interested: "text-green-400",
  declined:   "text-red-400",
  no_response:"text-muted",
  signed:     "text-neon",
};

function todayLocal() {
  const d = new Date();
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

export default function PitchContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    contact_name: "",
    contact_org: "",
    contact_email: "",
    method: "call",
    notes: "",
    outcome: "pending",
    contacted_at: todayLocal(),
    next_followup_at: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/pitch/contacts");
      const d = await r.json();
      setContacts(d.contacts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contact_name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/pitch/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          next_followup_at: form.next_followup_at || null,
          contact_org: form.contact_org || null,
          contact_email: form.contact_email || null,
        }),
      });
      setForm({ contact_name: "", contact_org: "", contact_email: "", method: "call",
                notes: "", outcome: "pending", contacted_at: todayLocal(), next_followup_at: "" });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: number, updates: Partial<Contact>) {
    await fetch("/api/admin/pitch/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    await load();
  }

  async function del(id: number) {
    if (!confirm("Remove this contact log entry?")) return;
    await fetch("/api/admin/pitch/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const overdue = contacts.filter(c =>
    c.next_followup_at && new Date(c.next_followup_at) < new Date() && c.outcome === "pending"
  );

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-edge">
        <Phone size={15} className="text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-black">Outreach log</div>
          <div className="text-xs text-muted">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            {overdue.length > 0 && (
              <span className="ml-2 text-yellow-400 font-semibold">
                · {overdue.length} follow-up{overdue.length !== 1 ? "s" : ""} overdue
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="btn btn-neon flex items-center gap-1.5 text-xs"
        >
          <Plus size={13} /> Log contact
        </button>
      </div>

      {/* Add form */}
      {open && (
        <form onSubmit={submit} className="grid gap-4 px-5 py-4 border-b border-edge bg-white/3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Name *</span>
              <input className="field-input" value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Darren Maharaj" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Org</span>
              <input className="field-input" value={form.contact_org}
                onChange={e => setForm(f => ({ ...f, contact_org: e.target.value }))}
                placeholder="CTV / CBC / Bell Media" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Email</span>
              <input className="field-input" type="email" value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Method</span>
              <select className="field-input" value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="text">Text</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Outcome</span>
              <select className="field-input" value={form.outcome}
                onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
                <option value="pending">Pending</option>
                <option value="interested">Interested</option>
                <option value="no_response">No response</option>
                <option value="declined">Declined</option>
                <option value="signed">Signed</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Contact date/time</span>
              <input className="field-input" type="datetime-local" value={form.contacted_at}
                onChange={e => setForm(f => ({ ...f, contacted_at: e.target.value }))} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Follow-up date</span>
              <input className="field-input" type="datetime-local" value={form.next_followup_at}
                onChange={e => setForm(f => ({ ...f, next_followup_at: e.target.value }))} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted uppercase tracking-wide">Notes</span>
            <textarea className="field-input" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What was discussed, what was sent, what they said…" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-neon flex items-center gap-1.5">
              <Check size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button>
          </div>
        </form>
      )}

      {/* Contact log list */}
      {loading ? (
        <div className="px-5 py-6 text-sm text-muted">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted">
          No contacts logged yet. Hit "Log contact" to record a call, email, or meeting.
        </div>
      ) : (
        <div className="divide-y divide-edge">
          {contacts.map(c => {
            const isOverdue = c.next_followup_at &&
              new Date(c.next_followup_at) < new Date() && c.outcome === "pending";
            return (
              <div key={c.id} className="flex gap-3 px-5 py-3 hover:bg-white/3 group">
                <div className="mt-0.5 text-muted shrink-0">
                  {METHOD_ICONS[c.method] ?? <Phone size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{c.contact_name}</span>
                    {c.contact_org && <span className="text-xs text-muted">{c.contact_org}</span>}
                    <span className={`text-xs font-semibold ${OUTCOME_COLORS[c.outcome] ?? "text-muted"}`}>
                      {c.outcome.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {new Date(c.contacted_at).toLocaleString("en-CA", {
                      timeZone: "America/Vancouver",
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit"
                    })} PT
                  </div>
                  {c.notes && <p className="text-sm mt-1 whitespace-pre-wrap">{c.notes}</p>}
                  {c.next_followup_at && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${isOverdue ? "text-yellow-400" : "text-muted"}`}>
                      <Calendar size={11} />
                      Follow-up: {new Date(c.next_followup_at).toLocaleString("en-CA", {
                        timeZone: "America/Vancouver",
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                      })} PT
                      {isOverdue && " — overdue"}
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2 opacity-0 group-hover:opacity-100 transition shrink-0">
                  {c.outcome === "pending" && (
                    <button
                      onClick={() => patch(c.id, { outcome: "interested" })}
                      className="btn text-xs py-0.5 px-2"
                      title="Mark interested"
                    >
                      Interested
                    </button>
                  )}
                  <button
                    onClick={() => del(c.id)}
                    className="btn text-xs py-0.5 px-2 text-red-400"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
