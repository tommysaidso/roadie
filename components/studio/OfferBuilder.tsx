"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Help, { Field } from "./Help";

// Sponsor offers. What you actually put in front of a business: a priced,
// dated package with the promo attached and a status you can see at a glance.

const TIERS = [
  { key: "local", label: "Local — one stop", blurb: "One town, one night. The easy yes." },
  { key: "route", label: "Route — a run of stops", blurb: "A string of dates through their territory." },
  { key: "ring", label: "Ring — the whole loop", blurb: "Every stop on the ring for the season." },
  { key: "title", label: "Title — name on it", blurb: "Their name in the name. One per season." },
];

const STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "negotiating", label: "Talking" },
  { key: "signed", label: "Signed" },
  { key: "passed", label: "Passed" },
];

// Starting points, not rules. Every one is editable before it goes out.
const STARTERS: Record<string, { deliverables: string[]; pitch: string }> = {
  local: {
    deliverables: ["Logo on the night's poster", "Named in the stage announcement", "Table at the venue", "One promo clip for their own channels"],
    pitch: "One night in your town. Your name on the poster, a table at the door, and a clip you can post yourself.",
  },
  route: {
    deliverables: ["Logo on every poster in the run", "Named from stage at each stop", "Table at each venue", "Promo clip cut for the run", "Listed on the ROADIE route page"],
    pitch: "A run of dates through your territory. Same night after night, in front of the people who already drive past your door.",
  },
  ring: {
    deliverables: ["Logo on every poster, all stops", "Named from stage at every stop", "Table at every venue", "Custom promo clip", "Route page placement", "First refusal on next season"],
    pitch: "The whole loop for the season. You're on every poster and every stage, and you get first call on next year.",
  },
  title: {
    deliverables: ["Name in the tour name", "Front position on every poster and clip", "Named from stage every night", "Custom promo package", "Route page headline placement", "First refusal on next season"],
    pitch: "Your name in the name. Everything the ring does for a season goes out with you on the front of it.",
  },
};

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

const money = (n: any) =>
  Number.isFinite(Number(n)) && Number(n) > 0
    ? `$${Number(n).toLocaleString("en-CA")}`
    : "—";

function blank() {
  return {
    id: null as number | null, sponsor_id: "" as number | "", title: "", tier: "local",
    pitch: "", deliverables: [] as string[], price: "" as number | "",
    term: "", in_kind: "", project_id: "" as number | "", status: "draft", notes: "",
  };
}

export default function OfferBuilder() {
  const [offers, setOffers] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [f, setF] = useState(blank());
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/offers").then(r => r.json()).catch(() => null);
    if (!r) return;
    setOffers(r.offers || []);
    setSponsors(r.sponsors || []);
    setProjects(r.projects || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  function applyTier(tier: string) {
    const s = STARTERS[tier] || STARTERS.local;
    setF(p => ({
      ...p, tier,
      // Only fill blanks — nobody wants their typed pitch wiped by a dropdown.
      pitch: p.pitch.trim() ? p.pitch : s.pitch,
      deliverables: p.deliverables.length ? p.deliverables : [...s.deliverables],
    }));
  }

  function edit(o: any) {
    let d: string[] = [];
    try { d = JSON.parse(o.deliverables || "[]"); } catch {}
    setF({
      id: o.id, sponsor_id: o.sponsor_id || "", title: o.title, tier: o.tier,
      pitch: o.pitch || "", deliverables: d, price: o.price ?? "",
      term: o.term || "", in_kind: o.in_kind || "", project_id: o.project_id || "",
      status: o.status, notes: o.notes || "",
    });
    setCopied(false);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(status?: string) {
    setMsg(null);
    if (!f.title.trim()) { setMsg("Give it a title — that's the subject line they read."); return; }
    const body = { ...f, status: status || f.status, price: f.price === "" ? null : f.price,
                   sponsor_id: f.sponsor_id || null, project_id: f.project_id || null };
    const r = await fetch("/api/admin/offers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(r.error); return; }
    setF(p => ({ ...p, id: r.id, status: status || p.status }));
    setMsg("Saved.");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/offers?id=${id}`, { method: "DELETE" });
    if (f.id === id) setF(blank());
    load();
  }

  /** The offer as words you can paste into an email or read down the phone. */
  function asText() {
    const sponsor = sponsors.find(s => s.id === Number(f.sponsor_id));
    const tier = TIERS.find(t => t.key === f.tier);
    return [
      sponsor ? `For: ${sponsor.name}` : "",
      f.title,
      "",
      f.pitch,
      "",
      f.deliverables.length ? "What you get:" : "",
      ...f.deliverables.map(d => `  - ${d}`),
      "",
      f.price !== "" ? `Price: ${money(f.price)} CAD` : "",
      f.term ? `Term: ${f.term}` : "",
      f.in_kind ? `Or in kind: ${f.in_kind}` : "",
      tier ? `\n(${tier.label})` : "",
    ].filter(l => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function copy() {
    // Never sends anything — it puts the words on your clipboard and you send it.
    try { await navigator.clipboard.writeText(asText()); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setMsg("Clipboard blocked — select the preview text and copy it."); }
  }

  const project = projects.find(p => p.id === Number(f.project_id));

  return (
    <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
      {/* builder */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="label">{f.id ? `Editing offer #${f.id}` : "New offer"}</span>
          {f.id && <button className="btn" onClick={() => { setF(blank()); setMsg(null); }}>Start a new one</button>}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Sponsor" help={<>Who this goes to. Add businesses on the sponsor
            console first; leave it blank to draft an offer before you know who it&apos;s for.</>}>
            <select className={inp} value={f.sponsor_id}
              onChange={e => set("sponsor_id", e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">— nobody yet —</option>
              {sponsors.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.city ? ` · ${s.city}` : ""}{s.budget_monthly ? ` · ${money(s.budget_monthly)}/mo` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Package" help={<>How much of the ring they&apos;re buying. Picking one
            fills in a starting pitch and deliverables — all of it editable.</>}>
            <select className={inp} value={f.tier} onChange={e => applyTier(e.target.value)}>
              {TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Title" help={<>The line they see first. Concrete beats clever:
          &quot;Three nights in the Kootenays, your name on all of it.&quot;</>}>
          <input className={inp} value={f.title} onChange={e => set("title", e.target.value)}
            placeholder="Three nights in the Kootenays — your name on all of it" />
        </Field>

        <Field label="The pitch" help={<>What you&apos;d actually say. Keep it plain and short.
          This is the body of the email.</>}>
          <textarea className={inp + " h-24 resize-y"} value={f.pitch}
            onChange={e => set("pitch", e.target.value)} />
        </Field>

        <Field label="What they get" help={<>One line each. These are the promises — if it&apos;s
          on this list somebody has to deliver it, so don&apos;t pad it.</>}>
          <div className="flex flex-col gap-2">
            {f.deliverables.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input className={inp} value={d}
                  onChange={e => set("deliverables", f.deliverables.map((x, j) => (j === i ? e.target.value : x)))} />
                <button className="btn shrink-0"
                  onClick={() => set("deliverables", f.deliverables.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button className="btn self-start" onClick={() => set("deliverables", [...f.deliverables, ""])}>
              + add a line
            </button>
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Price (CAD)" help={<>Total for the whole term, not per month —
            one number is easier to say yes to.</>}>
            <input type="number" className={inp} value={f.price}
              onChange={e => set("price", e.target.value === "" ? "" : Number(e.target.value))} placeholder="1500" />
          </Field>
          <Field label="Term" help={<>What window it covers, in words: &quot;3 stops, Aug–Oct 2026&quot;.</>}>
            <input className={inp} value={f.term} onChange={e => set("term", e.target.value)}
              placeholder="3 stops, Aug–Oct 2026" />
          </Field>
        </div>

        <Field label="Or in kind" help={<>What they could give instead of cash — rooms, a van,
          gear, meals. Plenty of small businesses can&apos;t write a cheque but can hand you
          something worth more than the cheque.</>}>
          <input className={inp} value={f.in_kind} onChange={e => set("in_kind", e.target.value)}
            placeholder="4 hotel nights + a cube van for the run" />
        </Field>

        <Field label="Promo attached" help={<>The clip you cut in the studio. Sending an offer
          with a promo already made is the whole point — they can see it, not imagine it.</>}>
          <div className="flex gap-2">
            <select className={inp} value={f.project_id}
              onChange={e => set("project_id", e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">— none —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Link href="/admin/studio" className="btn shrink-0 whitespace-nowrap">Make one →</Link>
          </div>
        </Field>

        <Field label="Private notes" help={<>Yours only. Who you talked to, what they said,
          when to chase. Never goes out with the offer.</>}>
          <textarea className={inp + " h-16 resize-y"} value={f.notes} onChange={e => set("notes", e.target.value)} />
        </Field>

        <div className="flex flex-wrap gap-2 items-center pt-1">
          <button className="btn btn-neon" onClick={() => save()}>Save</button>
          <button className="btn" onClick={() => save("sent")}>Mark as sent</button>
          <button className="btn" onClick={() => save("signed")}>Signed</button>
          <button className="btn" onClick={() => save("passed")}>Passed</button>
          {msg && <span className="text-sm text-[#8a8aa0]">{msg}</span>}
        </div>
      </div>

      {/* preview + board */}
      <div className="flex flex-col gap-4">
        <div className="card p-4">
          <div className="label mb-2 flex items-center gap-1.5">
            What they see
            <Help title="Send it yourself">
              This copies the offer to your clipboard as plain text so you can paste it
              into your own email and send it in your own words. ROADIE never sends
              anything on your behalf.
            </Help>
          </div>
          {project?.poster && (
            <img src={project.poster} alt="" className="w-full rounded-lg border border-[#2a2a3a] mb-3" />
          )}
          <pre className="whitespace-pre-wrap text-sm text-[#c9c9da] font-sans
                          bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg p-3 min-h-[140px]">
            {asText() || "Fill the form and the offer writes itself here."}
          </pre>
          <button className="btn btn-neon mt-3 w-full" onClick={copy}>
            {copied ? "Copied — paste it into your email" : "Copy the offer"}
          </button>
        </div>

        <div className="card p-4">
          <div className="label mb-3">Offers on the table</div>
          {!offers.length && <div className="text-sm text-[#8a8aa0]">Nothing yet.</div>}
          <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scroll">
            {offers.map(o => (
              <div key={o.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-[#2a2a3a] hover:border-[#ff3d6e]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{o.title}</div>
                  <div className="text-xs text-[#8a8aa0] truncate">
                    {o.sponsor_current_name || o.sponsor_name || "no sponsor"} · {money(o.price)}
                    {o.term ? ` · ${o.term}` : ""}
                  </div>
                </div>
                <span className="pill shrink-0">{STATUSES.find(s => s.key === o.status)?.label || o.status}</span>
                <button className="btn shrink-0" onClick={() => edit(o)}>Open</button>
                <button className="btn shrink-0" onClick={() => remove(o.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
