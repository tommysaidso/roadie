"use client";
import { useEffect, useState } from "react";

type Client = { name?: string; email?: string; phone?: string; city?: string; note?: string };

const HEAD = ["name", "email", "phone", "city", "note"];

function parseClients(text: string): Client[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  // detect header row
  let start = 0;
  const first = lines[0].toLowerCase();
  if (HEAD.some(h => first.includes(h))) start = 1;
  const out: Client[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map(p => p.trim());
    const [name, email, phone, city, note] = parts;
    if (!name && !email && !phone) continue;
    out.push({ name, email, phone, city, note });
  }
  return out;
}

const inputCls = "w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm";

export default function VendorSetup() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>({
    name: "", headline: "", city: "", phone: "", address: "", hours: "",
    website: "", year_est: "", services: "", tags: "", bio: "",
  });
  const [part, setPart] = useState<any>(null);
  const [clientsText, setClientsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) { setErr("No setup link token found. Use the link from your email."); setLoading(false); return; }
    fetch(`/api/pros/onboard?token=${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); return; }
        setForm((f: any) => ({ ...f, ...d.pro }));
        setPart(d.participation);
      })
      .catch(() => setErr("Could not load your listing. Try the link again."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));
  const clients = parseClients(clientsText);

  async function onFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setClientsText(await file.text());
  }

  async function submit() {
    setSubmitting(true); setErr("");
    try {
      const r = await fetch("/api/pros/onboard", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...form, clients }),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); setSubmitting(false); return; }
      setDone(d);
    } catch { setErr("Save failed — try again."); }
    setSubmitting(false);
  }

  if (loading) return <Shell><p className="text-muted">Loading your listing…</p></Shell>;
  if (err && !form.name) return <Shell><p className="text-amber">{err}</p></Shell>;
  if (done) return (
    <Shell>
      <div className="text-2xl font-black mb-2">You're all set. 🎸</div>
      <p className="text-muted mb-4">
        {form.name} is live on ROADIE with your details{done.clients_added ? ` and ${done.clients_added} clients imported` : ""}.
        Your 90-day full-tools trial just started — everything's free while ROADIE works for you.
      </p>
      <a href="/community" className="btn btn-neon">See your listing →</a>
    </Shell>
  );

  const steps = ["Business", "What you do", "Client list", "Review"];
  return (
    <Shell>
      <div className="mb-1 text-sm text-neon">Drop D Music · vendor setup</div>
      <h1 className="text-2xl font-black mb-1">{form.name || "Your business"}</h1>
      <p className="text-muted text-sm mb-4">
        A few details so bands and locals can find you. Free to list — you only ever pay if ROADIE earns you money past the threshold.
      </p>

      <div className="flex gap-2 mb-5">
        {steps.map((s, i) => (
          <div key={i} className={`pill ${i === step ? "" : "opacity-60"}`}
            style={i === step ? { borderColor: "#35d0c8", color: "#35d0c8" } : {}}>{i + 1}. {s}</div>
        ))}
      </div>

      {err && <div className="text-amber text-sm mb-3">{err}</div>}

      {step === 0 && (
        <div className="card p-5 space-y-3">
          <Field label="Business name"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
          <Field label="One-line headline"><input className={inputCls} value={form.headline} onChange={set("headline")} placeholder="Custom guitars · repairs · gear" /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set("phone")} /></Field>
            <Field label="City"><input className={inputCls} value={form.city} onChange={set("city")} /></Field>
          </div>
          <Field label="Address"><input className={inputCls} value={form.address} onChange={set("address")} /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Hours"><input className={inputCls} value={form.hours} onChange={set("hours")} placeholder="Tue–Sat 10–6" /></Field>
            <Field label="Established (year)"><input className={inputCls} value={form.year_est} onChange={set("year_est")} /></Field>
          </div>
          <Field label="Website (optional)"><input className={inputCls} value={form.website} onChange={set("website")} placeholder="https://" /></Field>
        </div>
      )}

      {step === 1 && (
        <div className="card p-5 space-y-3">
          <Field label="Services — what you offer">
            <textarea className={inputCls} rows={4} value={form.services} onChange={set("services")}
              placeholder="Custom builds, repairs & setups, gear rental, school guitar clinics…" />
          </Field>
          <Field label="Tags (comma-separated)">
            <input className={inputCls} value={form.tags} onChange={set("tags")}
              placeholder="custom_guitars,repairs,bass,gear,school_clinics" />
          </Field>
          <Field label="About (short bio)">
            <textarea className={inputCls} rows={4} value={form.bio} onChange={set("bio")} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5 space-y-3">
          <p className="text-sm text-muted">
            Paste or upload your client / sales list — one per line as <span className="text-neon">name, email, phone, city, note</span>.
            It stays private to your account; we never sell or spam it. Great for inviting past customers to follow your shows and specials.
          </p>
          <input type="file" accept=".csv,.txt" onChange={onFile} className="text-sm" />
          <textarea className={inputCls} rows={8} value={clientsText} onChange={e => setClientsText(e.target.value)}
            placeholder={"name, email, phone, city, note\nJane Doe, jane@email.com, 250-555-0100, Kelowna, bought a Tele"} />
          <div className="text-sm text-muted">{clients.length} client{clients.length === 1 ? "" : "s"} detected.</div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-5 space-y-2 text-sm">
          <Row k="Business" v={form.name} />
          <Row k="Headline" v={form.headline} />
          <Row k="Phone" v={form.phone} />
          <Row k="City / address" v={[form.city, form.address].filter(Boolean).join(" · ")} />
          <Row k="Hours" v={form.hours} />
          <Row k="Website" v={form.website} />
          <Row k="Services" v={form.services} />
          <Row k="Tags" v={form.tags} />
          <Row k="Clients to import" v={String(clients.length)} />
          <p className="text-muted pt-2">Submitting starts your free 90-day full-tools trial.</p>
        </div>
      )}

      <div className="flex justify-between mt-5">
        <button className="pill" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>← Back</button>
        {step < 3
          ? <button className="btn btn-neon" onClick={() => setStep(s => s + 1)}>Next →</button>
          : <button className="btn btn-neon" disabled={submitting} onClick={submit}>{submitting ? "Saving…" : "Finish setup"}</button>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: any }) {
  return <div className="max-w-2xl mx-auto px-4 py-10">{children}</div>;
}
function Field({ label, children }: { label: string; children: any }) {
  return <label className="block"><div className="label mb-1">{label}</div>{children}</label>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-3"><div className="text-muted w-40 shrink-0">{k}</div><div className="flex-1">{v || "—"}</div></div>;
}
