"use client";
import { useEffect, useState } from "react";

const DEPARTMENTS = [
  "audio", "lighting", "video", "stage", "backline", "rigging", "power",
  "transport", "accommodation", "catering", "medical", "security",
  "box_office", "merch", "production", "camera", "editorial", "photo",
  "marketing", "hospitality", "site", "sanitation",
];

const STAGES = [
  { v: "working",      l: "Working in the industry now" },
  { v: "semi_retired", l: "Semi-retired / occasional" },
  { v: "retired",      l: "Retired from it" },
  { v: "returning",    l: "Coming back to it" },
];

const RANGES = [
  { v: "local",    l: "My town and nearby only" },
  { v: "runout",   l: "Will drive a few hours" },
  { v: "full_run", l: "Will travel the whole run" },
];

const CA_REGIONS = ["BC", "AB", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU"];
const US_REGIONS = ["WA", "OR", "CA", "ID", "MT", "NV", "AZ", "UT", "CO", "WY", "AK", "other"];

export default function CrewSignup() {
  const [f, setF] = useState<any>({
    country: "CA", region: "BC", career_stage: "working",
    travel_range: "local", rate_unit: "day", departments: [] as string[],
  });
  const [juris, setJuris] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [err, setErr] = useState("");

  // Show the real paperwork for wherever they are, rather than a Canada-shaped
  // assumption — a US contractor's obligations are genuinely different.
  useEffect(() => {
    fetch(`/api/crew?country=${f.country}&region=${f.region}`)
      .then(r => r.json()).then(d => setJuris(d.jurisdiction)).catch(() => {});
  }, [f.country, f.region]);

  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const toggleDept = (d: string) =>
    setF((s: any) => ({
      ...s,
      departments: s.departments.includes(d)
        ? s.departments.filter((x: string) => x !== d)
        : [...s.departments, d],
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/crew", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Could not save that.");
      else setDone(d);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="card p-6 space-y-3 text-sm leading-relaxed">
        <div className="text-neon text-lg">You&rsquo;re in the pool.</div>
        <p>{done.message}</p>
        {done.paperwork_when_hired?.length > 0 && (
          <>
            <div className="text-muted pt-2">Paperwork if you get the call:</div>
            <ul className="list-disc pl-5 space-y-1 text-muted">
              {done.paperwork_when_hired.map((p: string, i: number) => <li key={i}>{p}</li>)}
            </ul>
          </>
        )}
      </div>
    );
  }

  const regions = f.country === "CA" ? CA_REGIONS : US_REGIONS;

  return (
    <form onSubmit={submit} className="card p-6 space-y-5 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-muted">Name *</div>
          <input className="input w-full" required value={f.name || ""}
                 onChange={e => set("name", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Email *</div>
          <input className="input w-full" type="email" required value={f.email || ""}
                 onChange={e => set("email", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Phone</div>
          <input className="input w-full" value={f.phone || ""}
                 onChange={e => set("phone", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Your town *</div>
          <input className="input w-full" required placeholder="Smithers"
                 value={f.city || ""} onChange={e => set("city", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Country</div>
          <select className="input w-full" value={f.country}
                  onChange={e => { set("country", e.target.value);
                                   set("region", e.target.value === "CA" ? "BC" : "WA"); }}>
            <option value="CA">Canada</option>
            <option value="US">United States</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-muted">Province / State</div>
          <select className="input w-full" value={f.region}
                  onChange={e => set("region", e.target.value)}>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-muted">Departments you can work *</div>
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map(d => (
            <button type="button" key={d} onClick={() => toggleDept(d)}
              className={`pill ${f.departments.includes(d) ? "bg-neon/20 text-neon" : ""}`}>
              {d.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-muted">Roles / what you actually do</div>
          <input className="input w-full" placeholder="FOH, monitor eng, gaffer, editor"
                 value={f.roles || ""} onChange={e => set("roles", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Years in it</div>
          <input className="input w-full" type="number" min={0} max={70}
                 value={f.years_exp || ""} onChange={e => set("years_exp", e.target.value)} />
        </label>
      </div>

      <label className="space-y-1 block">
        <div className="text-muted">
          What you&rsquo;ve worked on — tours, venues, productions, labels
        </div>
        <textarea className="input w-full h-24"
          placeholder="This is the part that matters. Twenty years ago still counts."
          value={f.prior_credits || ""} onChange={e => set("prior_credits", e.target.value)} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-muted">Where you&rsquo;re at</div>
          <select className="input w-full" value={f.career_stage}
                  onChange={e => set("career_stage", e.target.value)}>
            {STAGES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-muted">How far you&rsquo;ll travel</div>
          <select className="input w-full" value={f.travel_range}
                  onChange={e => set("travel_range", e.target.value)}>
            {RANGES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-muted">Day rate ({juris?.currency || "CAD"}) — negotiable</div>
          <input className="input w-full" type="number" min={0} value={f.rate || ""}
                 onChange={e => set("rate", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Vehicle</div>
          <input className="input w-full" placeholder="3/4 ton, cargo van, nothing"
                 value={f.vehicle || ""} onChange={e => set("vehicle", e.target.value)} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-muted">Gear you bring</div>
          <input className="input w-full" value={f.gear || ""}
                 onChange={e => set("gear", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Tickets / certs</div>
          <input className="input w-full" placeholder="fall arrest, forklift, first aid"
                 value={f.tickets || ""} onChange={e => set("tickets", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">Availability</div>
          <input className="input w-full" placeholder="weekends, summer only, anytime"
                 value={f.availability || ""} onChange={e => set("availability", e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-muted">
            Workers&rsquo; comp account {f.country === "CA" ? "(WCB)" : "(state)"}
          </div>
          <input className="input w-full" value={f.wcb || ""}
                 onChange={e => set("wcb", e.target.value)} />
        </label>
      </div>

      {juris && (
        <div className="card p-4 space-y-2 text-xs leading-relaxed"
             style={{ borderColor: "rgba(255,200,60,0.3)" }}>
          <div className="text-muted uppercase tracking-widest">
            If you&rsquo;re hired in {juris.country === "US" ? "the USA" : "Canada"}
          </div>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            {juris.paperwork?.map((p: string, i: number) => <li key={i}>{p}</li>)}
          </ul>
          {juris.review?.length > 0 && (
            <div className="pt-1 text-muted">
              <b className="text-neon">Needs a conversation:</b> {juris.review[0]}
            </div>
          )}
          <div className="pt-1">
            We never collect tax or identity numbers here.
          </div>
        </div>
      )}

      {err && <div className="text-sm" style={{ color: "#fca5a5" }}>{err}</div>}

      <button className="btn" disabled={busy} type="submit">
        {busy ? "Sending…" : "Put my name down"}
      </button>
    </form>
  );
}
