"use client";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";

const ROLE_BLURB: Record<string, string> = {
  super_admin: "Super admin — full run of the platform.",
  manager: "Manager — you can staff stops and hand work to members.",
  member: "Member — you'll be assigned work by a manager.",
};

export default function SetPassword() {
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);
    if (!t) { setInfo({ valid: false }); return; }
    fetch(`/api/auth/invite?t=${encodeURIComponent(t)}`)
      .then(r => r.json()).then(setInfo)
      .catch(() => setInfo({ valid: false }));
  }, []);

  async function submit() {
    setErr("");
    if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
    if (pw !== pw2) { setErr("The two passwords don't match."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/invite", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: pw, name }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not set your password."); return; }
      window.location.href = "/";
    } finally { setBusy(false); }
  }

  if (!info) return <div className="card p-6 text-sm text-muted">Checking your link…</div>;

  if (!info.valid) {
    return (
      <div className="card p-6">
        <div className="text-lg font-black">That link isn&rsquo;t valid</div>
        <p className="text-sm text-muted mt-2">
          It may have expired or already been used. Ask whoever invited you for a fresh one,
          or <a href="/signin" className="text-cyan hover:underline">sign in</a> if you already have a password.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-md space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <ShieldCheck size={16} className="text-neon" />
        <span className="text-muted">Setting up</span>
        <b>{info.email}</b>
      </div>
      {ROLE_BLURB[info.role] && <div className="text-xs text-muted">{ROLE_BLURB[info.role]}</div>}

      {!info.existing && (
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
      )}
      <input type="password" value={pw} onChange={e => setPw(e.target.value)}
        placeholder="Choose a password (8+ characters)" autoComplete="new-password"
        className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />
      <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
        placeholder="Type it again" autoComplete="new-password"
        onKeyDown={e => e.key === "Enter" && submit()}
        className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm" />

      {err && <div className="text-xs" style={{ color: "#e05c7a" }}>{err}</div>}

      <button onClick={submit} disabled={busy}
        className="btn btn-neon w-full flex items-center justify-center gap-2 disabled:opacity-40">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
        {busy ? "Setting it…" : "Set my password & sign in"}
      </button>
      <div className="text-[11px] text-muted">
        Only you ever see this password — it is never emailed, and nobody can read it back out.
      </div>
    </div>
  );
}
