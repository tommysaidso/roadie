"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Save, Check, Download, Send, AlertTriangle } from "lucide-react";

type PitchConfig = {
  password: string;
  venues_count: string;
  venues_label: string;
  phone_count: string;
  gdp: string;
  jobs: string;
  swing: string;
  live_now: string;
  moat: string;
  competition: string;
  ask_hospitality: string;
  ask_sponsor: string;
  ask_founding: string;
  ask_capital: string;
};

const D: PitchConfig = {
  password: "haveWilltravelfar@",
  venues_count: "1,516",
  venues_label: "venues in the corridor CRM",
  phone_count: "61",
  gdp: "$10.92B",
  jobs: "101,640",
  swing: "$4,778",
  live_now: "Booking engine · AI matcher · auto-contracts · tour map · border kit · posters · fan capture · claim flow · 1,516-venue CRM · CWR registration against an 81-work catalogue · owned GPU generation · fan carpool board · local talent spotlight · stop demand signals · pop-up show model (free entry / suggested donation / 25% community split) · stop safety info per stop",
  moat: "Proprietary live-music calendar truth from claimed venues. Every booking teaches the AI matcher. Every room-night builds the hotel pitch. The dataset nobody else collects: small-room live-music economics.",
  competition: "Side Door takes a share of the door. Prism sells software to pro rooms. Sonicbids charges the artist. Nobody funds the tour. <b>ROADIE competes for marketing budget — a different buyer, a different line item, a far larger pool.</b>",
  ask_hospitality: "Claim your properties. Host and sponsor where it fits. Hotel lane, casino showroom, patio — any room that can hold a crowd.",
  ask_sponsor: "Buy a tiered route pool instead of a billboard. Sourced deliberately outside each corridor's own competitive set. Tourism boards, out-of-market brands, vehicle and fuel categories.",
  ask_founding: "A founding economic and hospitality partner to anchor a corridor. PDG first — Snuneymuxw First Nation's portfolio across gaming, hospitality, tourism and transport. No funding requested to begin.",
  ask_capital: `Fund the claim-outreach push — turning {venues_count} scraped corridor listings, {phone_count} with direct phones, into a live claimed-venue network. Seed: $185,000 CAD converts the top-300 rooms within 12 months. UARX MIXEDREALITY CORP (CDN Federal #1695020-5).`,
};

function buildHtml(c: PitchConfig): string {
  const askCapital = c.ask_capital
    .replace("{venues_count}", c.venues_count)
    .replace("{phone_count}", c.phone_count);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RING ROAD — ROADIE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#161826;--surface:#232532;--text:#e9e9ed;--accent:#9184d9;--accent-300:#d2cefd;--accent-700:#5d5294;--accent-900:#2b2741;--n400:#b2b6ca;--n500:#9397ab;--n600:#75798c;--n800:#3f424d;--r:8px;--r-lg:12px}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-y:auto}
#gate{position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px}
#gate-inner{width:100%;max-width:300px}
#gate h1{font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:var(--accent);margin-bottom:28px}
#gate p{font-size:13px;color:var(--n400);margin-bottom:14px}
#gate input{width:100%;padding:12px 14px;background:var(--surface);border:1px solid var(--n800);border-radius:var(--r);color:var(--text);font-size:15px;font-family:inherit;outline:none;margin-bottom:10px}
#gate input:focus{border-color:var(--accent)}
#gate button{width:100%;padding:12px;background:var(--accent-900);border:1px solid var(--accent-700);border-radius:var(--r);color:var(--accent-300);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit}
#gate button:hover{background:var(--accent-700)}
#gate-err{font-size:12px;color:#ff8a80;margin-top:8px;min-height:16px}
#app{display:none}
header{position:sticky;top:0;z-index:100;background:rgba(22,24,38,0.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--n800);padding:13px 16px;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:var(--accent)}
.dots{display:flex;gap:5px;align-items:center}
.dot{width:6px;height:6px;border-radius:50%;background:var(--n800);transition:background 0.2s}
.dot.on{background:var(--accent)}
main{max-width:480px;margin:0 auto;padding:0 16px 80px}
.section{padding:28px 0;border-bottom:1px solid var(--n800)}
.section:last-child{border-bottom:none}
.eyebrow{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
.heading{font-size:26px;font-weight:500;line-height:1.18;letter-spacing:-0.4px;margin-bottom:12px}
.lead{font-size:14px;color:var(--n400);line-height:1.65}
.lead b,.lead strong{color:var(--text);font-weight:600}
.card{background:var(--surface);border:1px solid var(--n800);border-radius:var(--r);padding:13px 14px}
.cards{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.step{display:flex;gap:12px;align-items:flex-start}
.step-n{min-width:24px;height:24px;border-radius:6px;background:var(--accent-900);border:1px solid var(--accent-700);color:var(--accent);font-weight:600;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-t{font-size:13px;line-height:1.55}
.step-t b{font-weight:600}
.note{background:var(--surface);border-radius:var(--r);padding:12px 14px;margin-top:8px;border:1px solid var(--n800);font-size:12px;color:var(--n500);line-height:1.6}
.note b{color:var(--text);font-weight:600}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.stat{background:var(--surface);border-radius:var(--r);padding:14px;border:1px solid var(--n800)}
.stat.hi{border-color:var(--accent-700)}
.snum{font-size:22px;font-weight:500;color:var(--n400)}
.stat.hi .snum{color:var(--accent)}
.slbl{font-size:11px;color:var(--n500);margin-top:5px;line-height:1.4}
.arcs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.arc{background:var(--surface);border-radius:var(--r);padding:12px;border:1px solid var(--n800)}
.arc-lbl{font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;font-weight:500;margin-bottom:5px}
.arc-stops{font-size:11px;color:var(--n500);line-height:1.5}
.tier{background:var(--surface);border:1px solid var(--n800);border-radius:var(--r);padding:13px 14px}
.tier.sel{border-color:var(--accent-700);background:var(--accent-900)}
.tier-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.tier-name{font-size:13px;font-weight:500}
.tier-price{font-size:16px;font-weight:500;color:var(--accent)}
.tier-sub{font-size:11px;color:var(--n500);margin-top:3px}
.tier-detail{background:var(--accent-900);border:1px solid var(--accent-700);border-radius:var(--r);padding:14px;margin-top:10px}
.tier-dlbl{font-size:12px;font-weight:500;color:var(--accent-300);margin-bottom:6px}
.tier-dbody{font-size:13px;color:var(--text);line-height:1.6}
.tier-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.tier-chip{border:1px solid var(--accent-700);border-radius:999px;padding:3px 10px;font-size:11px;color:var(--accent-300)}
.calc{background:var(--surface);border-radius:var(--r-lg);padding:16px;margin-top:14px;border:1px solid var(--n800)}
.calc-row{margin-bottom:14px}
.calc-lbl{display:flex;justify-content:space-between;font-size:12px;color:var(--n400);margin-bottom:6px}
.calc-lbl b{color:var(--text);font-weight:600}
input[type="range"]{accent-color:var(--accent);width:100%;cursor:pointer}
.calc-results{border-top:1px solid var(--n800);padding-top:12px;display:flex;flex-direction:column;gap:7px}
.calc-line{display:flex;justify-content:space-between;font-size:13px}
.calc-line span{color:var(--n400)}
.calc-total{background:var(--accent-900);border:1px solid var(--accent-700);border-radius:var(--r);padding:12px 14px;margin-top:12px;display:flex;justify-content:space-between;align-items:baseline}
.calc-total-lbl{font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent);font-weight:500}
.calc-total-num{font-size:26px;font-weight:500;color:var(--accent)}
.calc-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.metric{background:var(--bg);border-radius:var(--r);padding:11px;border:1px solid var(--n800);text-align:center}
.metric-num{font-size:18px;font-weight:500}
.metric-lbl{font-size:11px;color:var(--n500);margin-top:3px}
.cta-block{background:var(--accent-900);border:1px solid var(--accent-700);border-radius:var(--r);padding:16px;margin-top:12px;text-align:center}
.cta-name{font-size:14px;font-weight:500;color:var(--accent-300)}
.cta-org{font-size:12px;color:var(--n400);margin-top:4px}
.cta-url{font-size:12px;color:var(--accent);margin-top:4px}
.way-title{font-size:13px;font-weight:600;margin-bottom:4px}
.way-body{font-size:12px;color:var(--n400);line-height:1.6}
</style>
</head>
<body>

<div id="gate">
  <div id="gate-inner">
    <h1>Ring Road</h1>
    <p>Investor access only.</p>
    <input type="password" id="pw" placeholder="Password" autocomplete="current-password">
    <button onclick="checkPw()">Continue</button>
    <div id="gate-err"></div>
  </div>
</div>

<div id="app">
  <header>
    <span class="brand">Ring Road — ROADIE</span>
    <div class="dots">
      <div class="dot on"></div><div class="dot"></div><div class="dot"></div>
      <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
  </header>
  <main>

    <section class="section" id="s01">
      <div class="eyebrow">01 · The problem</div>
      <div class="heading">A BC Interior band loses $1,359 per person. Per tour.</div>
      <p class="lead">The average 4-piece BC Interior band self-funds a 6-stop Interior run at <b>−$1,359 per member</b>. A sponsor-funded ring runs the same route at <b>+$3,419 per member</b>. Nobody has built the ring.</p>
      <div class="stats">
        <div class="stat hi"><div class="snum">−$1,359</div><div class="slbl">per member, self-funded 6-stop run</div></div>
        <div class="stat hi"><div class="snum">+$3,419</div><div class="slbl">per member, sponsor-funded ring</div></div>
        <div class="stat"><div class="snum">${c.swing}</div><div class="slbl">swing per person, same route</div></div>
        <div class="stat"><div class="snum">${c.gdp}</div><div class="slbl">live-music GDP, Canadian market</div></div>
      </div>
      <div class="note">
        The swing is <b>${c.swing} per person</b>. That's precisely why the Interior — ${c.venues_count} ${c.venues_label}, ${c.gdp} live-music GDP market, ${c.jobs} jobs that depend on it — is one of the most under-served corridors in Canada. The infrastructure isn't missing. The funding model is.
      </div>
    </section>

    <section class="section" id="s02">
      <div class="eyebrow">02 · The fix</div>
      <div class="heading">The tour is already paid before the van rolls.</div>
      <p class="lead">Route sponsors — not the door — escrow artist guarantees at a <b>$3,000/night floor</b>. The venue keeps its door and bar. The band is paid before leaving. The platform takes no booking fee. Nobody eats off the same plate.</p>
      <div class="cards">
        <div class="card"><div class="step"><span class="step-n">1</span><div class="step-t"><b>Sponsor pool closes first.</b> Guarantees escrowed in full. No pool = no route. Never underfunded.</div></div></div>
        <div class="card"><div class="step"><span class="step-n">2</span><div class="step-t"><b>Then bands and venues are matched.</b> AI scores genre, draw, distance. Books with one click. Auto-contracts carry the detail.</div></div></div>
        <div class="card"><div class="step"><span class="step-n">3</span><div class="step-t"><b>The van rolls, already paid.</b> Door and bar settle against a written baseline. Platform takes no cut of either.</div></div></div>
        <div class="card"><div class="step"><span class="step-n">4</span><div class="step-t"><b>You get quarterly attribution by property.</b> Posters, blasts, fan lists, trackable merch links. The platform creates the advertising — you approve it.</div></div></div>
      </div>
    </section>

    <section class="section" id="s03">
      <div class="eyebrow">03 · What you're sponsoring</div>
      <div class="heading">The Interior Ring — one closed loop, four arc products.</div>
      <p class="lead">~3,000 km. Same distance a six-show out-and-back burns — but a ring carries <b>12–16 shows</b> because it never backtracks. Road cost per show drops 15–20%.</p>
      <div class="arcs">
        <div class="arc"><div class="arc-lbl">&#9312; North Spoke</div><div class="arc-stops">Kelowna · Kamloops · Cariboo · Prince George</div></div>
        <div class="arc"><div class="arc-lbl">&#9313; East Arc</div><div class="arc-stops">Prince George · Jasper · Hinton · Edmonton</div></div>
        <div class="arc"><div class="arc-lbl">&#9314; QE2 South</div><div class="arc-stops">Edmonton · Red Deer · Calgary · Lethbridge</div></div>
        <div class="arc"><div class="arc-lbl">&#9315; Bottom Arc</div><div class="arc-stops">Lethbridge · Crowsnest · Cranbrook · Osoyoos · home</div></div>
      </div>
      <div class="note">The ring crosses the BC–AB border twice every lap. <b>A BC brand sponsors the Alberta side. An Alberta brand sponsors the BC side.</b> The geography enforces the non-competing sponsor rule by itself. Arc: $13.8k–$18.4k. Full ring: $55k–$74k with one Ring Title Partner.</div>
    </section>

    <section class="section" id="s04">
      <div class="eyebrow">04 · Your tier</div>
      <div class="heading">One pool. Four tiers. Pick yours.</div>
      <p class="lead">Every tier contributes to the same route budget. Your spend sets your profile. The platform generates all advertising — you approve it.</p>
      <div class="cards">
        <div class="tier sel"><div class="tier-row"><span class="tier-name">Route Title Partner</span><span class="tier-price">$12,000</span></div><div class="tier-sub">1 per route — carries your name everywhere</div></div>
        <div class="tier"><div class="tier-row"><span class="tier-name">Corridor Partner</span><span class="tier-price">$5,000</span></div><div class="tier-sub">2 per route</div></div>
        <div class="tier"><div class="tier-row"><span class="tier-name">Market Partner</span><span class="tier-price">$1,500</span></div><div class="tier-sub">3 per route — own your market's night</div></div>
        <div class="tier"><div class="tier-row"><span class="tier-name">Local Supporter</span><span class="tier-price">$550</span></div><div class="tier-sub">2 per route — the entry rung</div></div>
      </div>
      <div class="tier-detail">
        <div class="tier-dlbl">Route Title Partner</div>
        <div class="tier-dbody">Name on every poster, every market, every mailing blast, a TOUR MOOSE feature, and quarterly attribution by property. The route carries your brand end to end.</div>
        <div class="tier-chips"><span class="tier-chip">$6.67 / attendee</span><span class="tier-chip">$2,000 / show</span><span class="tier-chip">quarterly report</span></div>
      </div>
      <div class="note">Sponsors are sourced <b>outside the corridor's own competitive set</b> — you are never in the same room as a direct competitor. One sponsor per category per arc, always.</div>
    </section>

    <section class="section" id="s05">
      <div class="eyebrow">05 · Your numbers</div>
      <div class="heading">Adjust the sliders. See exactly what you're buying.</div>
      <p class="lead">All figures from the plan's real rates. Adjust shows and guarantee floor to match the route you're considering.</p>
      <div class="calc">
        <div class="calc-row"><div class="calc-lbl"><span>Shows on the route</span><b id="sv">6</b></div><input type="range" id="shows" min="3" max="16" step="1" value="6" oninput="upd()"></div>
        <div class="calc-row" style="margin-bottom:0"><div class="calc-lbl"><span>Guarantee floor per night</span><b id="fv">$3,000</b></div><input type="range" id="floor" min="2000" max="5000" step="250" value="3000" oninput="upd()"></div>
        <div class="calc-results" style="margin-top:14px">
          <div class="calc-line"><span>Artist guarantees (100% escrowed)</span><b id="rg">$18,000</b></div>
          <div class="calc-line"><span>Venue promo + platform activation</span><b id="rp">$9,600</b></div>
          <div class="calc-line"><span>Total seats across the run</span><b id="rs">1,800</b></div>
        </div>
        <div class="calc-total"><span class="calc-total-lbl">Total sponsor pool</span><span class="calc-total-num" id="rt">$27,600</span></div>
        <div class="calc-metrics">
          <div class="metric"><div class="metric-num" id="ra">$15.33</div><div class="metric-lbl">your cost per attendee</div></div>
          <div class="metric"><div class="metric-num" id="rps">$4,600</div><div class="metric-lbl">pool cost per show</div></div>
        </div>
      </div>
      <div class="note">FACTOR domestic touring support — up to <b>$15,000</b> — auto-applies from routing data the platform already holds, reducing the pool you need to fill. No charge to you.</div>
    </section>

    <section class="section" id="s06">
      <div class="eyebrow">06 · Already real</div>
      <div class="heading">The system is built and running. It needs fuel.</div>
      <p class="lead">Both apps are deployed on owned infrastructure. Every feature described in this pitch is live today.</p>
      <div class="cards">
        <div class="card">
          <div class="way-title">Live right now</div>
          <div class="way-body" style="color:var(--n400)">${c.live_now}</div>
        </div>
        <div class="card">
          <div class="way-title">The moat</div>
          <div class="way-body">${c.moat}</div>
        </div>
        <div class="card">
          <div class="way-title">The competition</div>
          <div class="way-body">${c.competition}</div>
        </div>
      </div>
    </section>

    <section class="section" id="s07">
      <div class="eyebrow">07 · The ask</div>
      <div class="heading">Four ways in. Start anywhere.</div>
      <p class="lead">The system is built. The CRM has ${c.venues_count} ${c.venues_label}. The route map is drawn. What it needs now is partners.</p>
      <div class="cards">
        <div class="card"><div class="way-title">Corridor hospitality</div><div class="way-body">${c.ask_hospitality}</div></div>
        <div class="card"><div class="way-title">Regional sponsor</div><div class="way-body">${c.ask_sponsor}</div></div>
        <div class="card"><div class="way-title">Founding partner</div><div class="way-body">${c.ask_founding}</div></div>
        <div class="card"><div class="way-title">Capital</div><div class="way-body">${askCapital}</div></div>
      </div>
      <div class="cta-block">
        <div class="cta-name">Ben Easterday</div>
        <div class="cta-org">EV Entertainment &amp; Production Group</div>
        <div class="cta-url">roadie.mymymy.studio</div>
        <div class="cta-tag">The ring is built. The first sponsors set the route.</div>
      </div>
    </section>

  </main>
</div>

<script>
(function(){var p=document.getElementById('pw');p.addEventListener('keydown',function(e){if(e.key==='Enter')checkPw();});})();
function checkPw(){var v=document.getElementById('pw').value;if(v==='${c.password}'){document.getElementById('gate').style.display='none';var a=document.getElementById('app');a.style.display='block';initDots();}else{document.getElementById('gate-err').textContent='Incorrect password.';}}
function fmt(n){return '$'+Math.round(n).toLocaleString('en-US');}
function upd(){var s=parseInt(document.getElementById('shows').value);var f=parseInt(document.getElementById('floor').value);document.getElementById('sv').textContent=s;document.getElementById('fv').textContent=fmt(f);var g=s*f;var p=s*1600;var t=s*300;var x=g+p;document.getElementById('rg').textContent=fmt(g);document.getElementById('rp').textContent=fmt(p);document.getElementById('rs').textContent=t.toLocaleString('en-US');document.getElementById('rt').textContent=fmt(x);document.getElementById('ra').textContent='$'+(x/t).toFixed(2);document.getElementById('rps').textContent=fmt(x/s);}
function initDots(){var ss=document.querySelectorAll('.section');var dd=document.querySelectorAll('.dot');var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var i=Array.prototype.indexOf.call(ss,e.target);dd.forEach(function(d,j){d.classList.toggle('on',i===j);});}});},{threshold:0.35});ss.forEach(function(s){io.observe(s);});}
</script>
</body>
</html>`;
}

function Field({ label, field, value, onChange, multiline = false, rows = 2, mono = false }: {
  label: string; field: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; rows?: number; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label text-xs">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
          className={`bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon resize-y ${mono ? "font-mono text-xs" : ""}`} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          className={`bg-ink border border-edge rounded-xl px-3 py-2 text-sm outline-none focus:border-neon ${mono ? "font-mono" : ""}`} />
      )}
    </div>
  );
}

export default function PitchHtmlEditor() {
  const [cfg, setCfg] = useState<PitchConfig>(D);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok?: boolean; error?: string; firewall_needed?: boolean } | null>(null);
  const [preview, setPreview] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/api/admin/push-pitch").then(r => r.json()).then(d => {
      if (d.config && Object.keys(d.config).length) setCfg({ ...D, ...d.config });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const set = useCallback((k: keyof PitchConfig, v: string) => {
    setCfg(prev => ({ ...prev, [k]: v }));
    setSaved(false);
    setPushResult(null);
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/admin/push-pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", config: cfg }),
      });
      setSaved(true);
    } finally { setSaving(false); }
  }

  function download() {
    const html = buildHtml(cfg);
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pitch.html";
    a.click();
  }

  async function push() {
    const html = buildHtml(cfg);
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch("/api/admin/push-pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "push", html }),
      });
      const d = await res.json();
      setPushResult(d);
    } catch (e: any) {
      setPushResult({ error: String(e?.message || e) });
    } finally { setPushing(false); }
  }

  function showPreview() {
    setPreview(v => !v);
    if (!preview && previewRef.current) {
      const html = buildHtml(cfg);
      previewRef.current.srcdoc = html;
    }
  }

  useEffect(() => {
    if (preview && previewRef.current) {
      previewRef.current.srcdoc = buildHtml(cfg);
    }
  }, [cfg, preview]);

  if (!loaded) return <div className="text-sm text-muted">Loading...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={save} disabled={saving}
          className="btn btn-neon flex items-center gap-1.5 text-sm">
          {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
        </button>
        <button onClick={download} className="btn flex items-center gap-1.5 text-sm">
          <Download size={14} /> Download HTML
        </button>
        <button onClick={push} disabled={pushing}
          className="btn flex items-center gap-1.5 text-sm">
          <Send size={14} /> {pushing ? "Pushing..." : "Push to GCP"}
        </button>
        <button onClick={showPreview} className="btn flex items-center gap-1.5 text-sm">
          {preview ? "Hide preview" : "Preview"}
        </button>
      </div>

      {pushResult && (
        <div className={`rounded-xl p-3 text-sm flex items-start gap-2 ${pushResult.ok ? "bg-moss/10 border border-moss/30 text-moss" : "bg-neon/10 border border-neon/30 text-neon"}`}>
          {pushResult.ok ? (
            <><Check size={14} className="mt-0.5 shrink-0" /> Pushed live to app.mymymy.studio/pitch.html</>
          ) : (
            <div>
              <div className="flex items-center gap-1.5"><AlertTriangle size={14} className="shrink-0" /> {pushResult.error}</div>
              {pushResult.firewall_needed && (
                <div className="mt-2 text-xs text-muted">
                  To open the port: GCP Console &rarr; VPC Network &rarr; Firewall &rarr; Create Rule &rarr; Allowed ports: tcp:8765
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-edge overflow-hidden">
          <div className="px-3 py-2 text-xs text-muted border-b border-edge">Live preview</div>
          <iframe ref={previewRef} className="w-full" style={{ height: 600, background: "#161826" }} sandbox="allow-scripts" />
        </div>
      )}

      <div className="grid gap-5">
        <div className="label text-xs border-b border-edge pb-1">Access</div>
        <Field label="Password (gate)" field="password" value={cfg.password} onChange={v => set("password", v)} mono />

        <div className="label text-xs border-b border-edge pb-1 mt-2">Key numbers</div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Venues count" field="venues_count" value={cfg.venues_count} onChange={v => set("venues_count", v)} />
          <Field label="Venues label" field="venues_label" value={cfg.venues_label} onChange={v => set("venues_label", v)} />
          <Field label="Phone count" field="phone_count" value={cfg.phone_count} onChange={v => set("phone_count", v)} />
          <Field label="GDP figure" field="gdp" value={cfg.gdp} onChange={v => set("gdp", v)} />
          <Field label="Jobs figure" field="jobs" value={cfg.jobs} onChange={v => set("jobs", v)} />
          <Field label="Swing per person" field="swing" value={cfg.swing} onChange={v => set("swing", v)} />
        </div>

        <div className="label text-xs border-b border-edge pb-1 mt-2">Section 06</div>
        <Field label="Live right now (dot-separated features)" field="live_now" value={cfg.live_now} onChange={v => set("live_now", v)} multiline rows={4} />
        <Field label="The moat" field="moat" value={cfg.moat} onChange={v => set("moat", v)} multiline rows={3} />
        <Field label="The competition" field="competition" value={cfg.competition} onChange={v => set("competition", v)} multiline rows={3} />

        <div className="label text-xs border-b border-edge pb-1 mt-2">Section 07 — The ask</div>
        <Field label="Corridor hospitality" field="ask_hospitality" value={cfg.ask_hospitality} onChange={v => set("ask_hospitality", v)} multiline rows={2} />
        <Field label="Regional sponsor" field="ask_sponsor" value={cfg.ask_sponsor} onChange={v => set("ask_sponsor", v)} multiline rows={2} />
        <Field label="Founding partner" field="ask_founding" value={cfg.ask_founding} onChange={v => set("ask_founding", v)} multiline rows={2} />
        <Field label="Capital (use {venues_count} and {phone_count} as tokens)" field="ask_capital" value={cfg.ask_capital} onChange={v => set("ask_capital", v)} multiline rows={3} />
      </div>

      <div className="flex gap-2 flex-wrap mt-2">
        <button onClick={save} disabled={saving} className="btn btn-neon flex items-center gap-1.5 text-sm">
          {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
        </button>
        <button onClick={download} className="btn flex items-center gap-1.5 text-sm">
          <Download size={14} /> Download HTML
        </button>
        <button onClick={push} disabled={pushing} className="btn flex items-center gap-1.5 text-sm">
          <Send size={14} /> {pushing ? "Pushing..." : "Push to GCP"}
        </button>
      </div>
    </div>
  );
}
