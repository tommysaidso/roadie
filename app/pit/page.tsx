"use client";
/**
 * THE PIT — fan/media entrance to the ROADIE ring.
 *
 * Free access. No instrument required.
 * The Wire plays, RoadieTV rolls, ring notices land,
 * filmmakers register, fans get in.
 */
import { useEffect, useRef, useState } from "react";
import TheWire from "@/components/TheWire";
import RoadieTvEmbed from "@/components/RoadieTvEmbed";
import ShootPopout from "@/components/ShootPopout";

// ---- Types ----
type Notice = { id: number; title: string; body?: string; kind?: string; city?: string; date_from?: string };
type FilmKind = "filmmaker" | "photographer" | "equipment" | "other";

// ---- Fan Registration ----
function FanRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!email.trim() || !email.includes("@")) { setErr("Need a real email."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/fan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "signup", name: name.trim(), email: email.trim(), body: "PIT fan registration" }),
      });
      if (!r.ok) throw new Error("server error");
      setDone(true);
    } catch { setErr("Something broke — try again."); }
    finally { setBusy(false); }
  };

  if (done) return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center space-y-1">
      <div className="text-lg font-medium text-white">You're in.</div>
      <div className="text-sm" style={{ color: "#888" }}>Ring notices hit your email when a stop drops near you.</div>
    </div>
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6 space-y-4">
      <div>
        <div className="text-[9px] uppercase tracking-[0.5em]" style={{ color: "#666" }}>Free access</div>
        <h2 className="mt-1 text-xl font-light text-white">Get into The PIT</h2>
        <p className="mt-1 text-sm" style={{ color: "#666" }}>
          No subscription. Just drop your email — ring stops, shows, and callouts find you.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
          onKeyDown={e => e.key === "Enter" && submit()}
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
        <button onClick={submit} disabled={busy || !email}
          className="rounded-xl px-6 py-2.5 text-sm font-medium transition"
          style={{ background: "rgba(255,61,110,0.20)", border: "1px solid rgba(255,61,110,0.40)", color: "#ff3d6e" }}>
          {busy ? "…" : "IN"}
        </button>
      </div>
      {err && <div className="text-xs" style={{ color: "#e05050" }}>{err}</div>}
    </div>
  );
}

// ---- Ring Notices ----
function RingNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    fetch("/api/notices").then(r => r.json()).then(d => setNotices((d.notices || []).slice(0, 6))).catch(() => {});
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
      <h2 className="text-base font-medium text-white">Ring notices</h2>
      {notices.length === 0 && (
        <p className="text-sm" style={{ color: "#555" }}>Nothing posted yet — check back before the next leg.</p>
      )}
      <div className="space-y-2">
        {notices.map(n => (
          <div key={n.id} className="flex items-start gap-3 text-sm">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#ff3d6e" }} />
            <div>
              <span className="text-white">{n.title}</span>
              {n.city && <span className="ml-2 text-xs" style={{ color: "#555" }}>{n.city}</span>}
              {n.body && <div className="text-xs mt-0.5" style={{ color: "#666" }}>{n.body.slice(0, 120)}</div>}
            </div>
          </div>
        ))}
      </div>
      <a href="/ring" className="block text-xs transition" style={{ color: "#ff3d6e" }}>
        Full ring schedule →
      </a>
    </div>
  );
}

// ---- Filmmaker / Crew callout ----
function FilmmakerCall() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", kind: "filmmaker" as FilmKind, city: "", gear_notes: "", ring_pref: "any" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email) return;
    setBusy(true);
    try {
      await fetch("/api/filmmaker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      setDone(true);
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="py-4 text-sm text-white/60">
      On the list. ROADIE will reach out when a ring stop in your area needs crew.
    </div>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full rounded-xl border border-white/10 py-3 text-sm transition"
      style={{ color: "#aaa" }}>
      Register as filmmaker / crew / equipment →
    </button>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="grid grid-cols-2 gap-2">
        {(["filmmaker", "photographer", "equipment", "other"] as FilmKind[]).map(k => (
          <button key={k} onClick={() => set("kind", k)}
            className="rounded-lg border py-2 text-xs capitalize transition"
            style={{
              borderColor: form.kind === k ? "rgba(255,61,110,0.5)" : "rgba(255,255,255,0.08)",
              color: form.kind === k ? "#ff3d6e" : "#888",
              background: form.kind === k ? "rgba(255,61,110,0.10)" : "transparent",
            }}>
            {k === "equipment" ? "Equipment / Gear" : k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Name *" value={form.name} onChange={e => set("name", e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/20" />
        <input type="email" placeholder="Email *" value={form.email} onChange={e => set("email", e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/20" />
        <input placeholder="City" value={form.city} onChange={e => set("city", e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/20" />
        <input placeholder="Ring preference (or 'any')" value={form.ring_pref} onChange={e => set("ring_pref", e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/20" />
      </div>
      <textarea placeholder="What you bring — gear, skills, portfolio link…" value={form.gear_notes}
        onChange={e => set("gear_notes", e.target.value)} rows={2}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/20" />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-xs" style={{ color: "#666" }}>Cancel</button>
        <button onClick={submit} disabled={busy || !form.name || !form.email}
          className="flex-1 rounded-xl border py-2 text-xs transition"
          style={{ borderColor: "rgba(255,61,110,0.40)", background: "rgba(255,61,110,0.15)", color: "#ff3d6e" }}>
          {busy ? "…" : "Register"}
        </button>
      </div>
    </div>
  );
}

// ---- Main ----
export default function ThePit() {
  return (
    <div className="min-h-screen" style={{ background: "#0a0a0c" }}>
      <div className="mx-auto max-w-[900px] px-5 py-10 space-y-10">

        {/* ===== HEADER ===== */}
        <div>
          <div className="text-[9px] uppercase tracking-[0.6em]" style={{ color: "#444" }}>ROADIE</div>
          <h1 className="mt-1 text-5xl font-black tracking-tight" style={{ color: "#ff3d6e", letterSpacing: "-0.02em" }}>
            THE PIT
          </h1>
          <p className="mt-2 text-base" style={{ color: "#555" }}>
            Fan entrance. The ring is live — radio on, TV rolling, notices dropping.
          </p>
        </div>

        {/* ===== THE WIRE ===== */}
        <section>
          <div className="text-[9px] uppercase tracking-[0.5em] mb-3" style={{ color: "#444" }}>The Wire</div>
          <TheWire />
        </section>

        {/* ===== ROADIETV ===== */}
        <section className="rounded-3xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="px-6 pt-5 pb-3">
            <div className="text-[9px] uppercase tracking-[0.5em]" style={{ color: "#444" }}>Live now</div>
            <h2 className="mt-1 text-xl font-light text-white">RoadieTV</h2>
            <p className="text-sm mt-0.5" style={{ color: "#555" }}>Ring footage, live sets, road content.</p>
          </div>
          {/* Was an iframe of /roadietv, which is a full app page — so the
              whole shell (sidebar, hub badge, footer, a second Ask ROADIE)
              loaded inside this panel. The player renders directly now. */}
          <div className="px-6 pb-2"><RoadieTvEmbed /></div>
          <div className="flex items-center gap-4 px-6 py-4 border-t border-white/5">
            <a href="/roadietv" className="text-xs transition" style={{ color: "#ff3d6e" }}>Full screen →</a>
            <a href="/ring" className="text-xs" style={{ color: "#555" }}>Ring schedule</a>
            <a href="/map" className="text-xs" style={{ color: "#555" }}>Tour map</a>
          </div>
        </section>

        {/* ===== FROM THE FLOOR =====
            Placed straight after the TV panel on purpose: they have just
            watched ring footage, which is the moment sending in their own
            makes sense. A page of its own would lose them. */}
        <section>
          <div className="text-[9px] uppercase tracking-[0.5em] mb-3" style={{ color: "#444" }}>From the floor</div>
          <ShootPopout />
        </section>

        {/* ===== FAN REGISTER ===== */}
        <FanRegister />

        {/* ===== 2-COL: Notices | Filmmaker ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RingNotices />

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <div>
              <h2 className="text-base font-medium text-white">Film & crew call</h2>
              <p className="text-sm mt-1" style={{ color: "#555" }}>
                Filmmakers, photographers, and equipment providers — register your interest.
                When a ring stop near you needs crew, ROADIE reaches out.
              </p>
            </div>
            <FilmmakerCall />
          </div>
        </div>

        {/* ===== SPONSOR / SUPPORT ===== */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h2 className="text-base font-medium text-white">Back the ring</h2>
              <p className="mt-1 text-sm" style={{ color: "#555" }}>
                The ring runs on local sponsors. If your business wants a seat on the tour —
                a banner, a brand ident on The Wire, or a hosted stop — this is where it starts.
              </p>
              <p className="mt-2 text-xs" style={{ color: "#444" }}>
                Canadian homegrown. Started in a rink hall. Hollywood-level production behind it now.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-w-[160px]">
              <a href="/pitch"
                className="rounded-2xl border px-5 py-2.5 text-sm text-center transition"
                style={{ borderColor: "rgba(255,61,110,0.35)", background: "rgba(255,61,110,0.12)", color: "#ff3d6e" }}>
                Sponsor the ring →
              </a>
              <a href="/sponsors"
                className="rounded-2xl border border-white/10 px-5 py-2.5 text-sm text-center transition"
                style={{ color: "#666" }}>
                Who's backing it
              </a>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <div className="pb-4 text-center text-[9px] uppercase tracking-widest" style={{ color: "#2a2a2a" }}>
          ROADIE &nbsp;&middot;&nbsp; THE PIT &nbsp;&middot;&nbsp; UARX MIXEDREALITY CORP.
        </div>

      </div>
    </div>
  );
}
