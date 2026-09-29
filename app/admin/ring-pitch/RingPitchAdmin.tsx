"use client";
import { useState } from "react";
import { Copy, Check, ExternalLink, Send, Lock } from "lucide-react";
import PitchHtmlEditor from "@/components/PitchHtmlEditor";

const PITCH_URL = "https://app.mymymy.studio/pitch.html";
const INITIAL_PW = "haveWilltravelfar@";

export default function RingPitchAdmin() {
  const [pw] = useState(INITIAL_PW);
  const [tab, setTab] = useState<"share" | "edit">("share");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  async function copy(text: string, which: "link" | "pw" | "email") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "link") { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
      if (which === "pw") { setCopiedPw(true); setTimeout(() => setCopiedPw(false), 2000); }
      if (which === "email") { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }
    } catch {}
  }

  const emailBody = `Hi,

I wanted to share a quick look at what we're building with ROADIE.

The plan is at: ${PITCH_URL}
Password: ${pw}

The short version: we fix the touring math for the BC/Alberta Interior corridor, and we pay for it by selling advertising — not by passing a hat.

We're a production company that happens to run a circuit. We write, shoot and run commercials for the businesses in the towns we play, they keep every file, and because the ring is already going there the whole ring costs an advertiser less per town than buying one town. That's the revenue. Sponsorship sits underneath it and stays local — a shop backing a band from its own street.

Sections cover the problem, the fix, the route arcs, the advertising model, sponsor tiers, and the ask. The numbers calculator on page 5 lets you adjust shows and guarantee floor to see the exact economics.

Happy to walk through it — let me know.

Ben Easterday
EV Entertainment & Production Group
roadie.mymymy.studio`;

  const sections = [
    { n: "01", title: "The Problem", note: "−$1,359/member self-funded vs +$3,419/member sponsor-funded. $4,778 swing. 1,516 venues in the corridor CRM, $10.92B live-music GDP market." },
    { n: "02", title: "The Fix", note: "Sponsor pool closes first. Guarantees escrowed. $3,000/night floor. Platform takes no booking fee." },
    { n: "03", title: "The Interior Ring", note: "~3,000 km. 4 arcs: North Spoke (Kelowna→Kamloops→PG), East Arc (PG→Jasper→Edmonton), QE2 South (Edmonton→Calgary→Lethbridge), Bottom Arc (Lethbridge→Cranbrook→Osoyoos). Arc: $13.8k–$18.4k. Full ring: $55k–$74k." },
    { n: "04", title: "Advertising — the revenue", note: "We make the ad and run it; the client keeps every master. Marginal cost of adding a market is ~0, so ring-wide prices BELOW per-town — the opposite of a station, whose cost per market only rises. Advertising scales up (regional budgets, whole rings); sponsorship scales down (one shop, one band, one town). They stop competing for the same pocket." },
    { n: "04b", title: "Sponsor Tiers", note: "Route Title Partner $12k (1/route) \xb7 Corridor Partner $5k (2) \xb7 Market Partner $1.5k (3) \xb7 Local Supporter $550 (2). One sponsor per category per arc." },
    { n: "05", title: "Your Numbers", note: "Interactive calculator: adjust shows (3–16) and guarantee floor ($2k–$5k). FACTOR domestic touring support up to $15k auto-applies." },
    { n: "06", title: "Already Real", note: "Booking engine, AI matcher, auto-contracts, tour map, border kit, posters, fan capture, claim flow, 1,516-venue CRM, CWR registration against 81-work catalogue, owned GPU generation, fan carpool board, local talent spotlight, stop demand signals, pop-up show model." },
    { n: "07", title: "The Ask", note: "Corridor hospitality \xb7 Regional sponsor \xb7 Founding partner (PDG / Snuneymuxw portfolio) \xb7 Capital (fund the 1,516-venue claimed conversion, 61 direct phones)." },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1">
        {(["share", "edit"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? "bg-neon text-ink" : "text-muted hover:text-primary"}`}>
            {t === "share" ? "Share" : "Edit pitch"}
          </button>
        ))}
      </div>

      {tab === "share" && (
        <>
          {/* Share panel */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="label">Share with a shareholder or sponsor</div>

            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm text-muted">{PITCH_URL}</span>
              <button onClick={() => copy(PITCH_URL, "link")}
                className="pill text-xs flex items-center gap-1 hover:border-neon">
                {copiedLink ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy URL</>}
              </button>
              <a href={PITCH_URL} target="_blank" rel="noreferrer"
                className="pill text-xs flex items-center gap-1 hover:border-neon">
                <ExternalLink size={11} /> Open
              </a>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <span className="flex items-center gap-1 text-sm text-muted"><Lock size={13} /> Password:</span>
              <code className="text-sm" style={{ color: "#3df0ff" }}>{pw}</code>
              <button onClick={() => copy(pw, "pw")}
                className="pill text-xs flex items-center gap-1 hover:border-neon">
                {copiedPw ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>

            <div className="border-t border-edge pt-3">
              <div className="text-xs text-muted mb-2">Ready-to-send email — copy and paste into Gmail or wherever:</div>
              <pre className="text-xs text-muted bg-ink rounded-xl p-3 overflow-x-auto whitespace-pre-wrap" style={{ maxHeight: 180 }}>{emailBody}</pre>
              <button onClick={() => copy(emailBody, "email")}
                className="btn btn-neon mt-2 flex items-center gap-1.5 text-sm">
                {copiedEmail ? <><Check size={14} /> Copied!</> : <><Send size={14} /> Copy email</>}
              </button>
            </div>
          </div>

          {/* Section summary */}
          <div>
            <div className="label mb-3">Document sections at a glance</div>
            <div className="flex flex-col gap-2">
              {sections.map(s => (
                <div key={s.n} className="card p-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs" style={{ color: "#ffb33d" }}>{s.n}</span>
                    <span className="font-semibold text-sm">{s.title}</span>
                  </div>
                  <p className="text-xs text-muted">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "edit" && <PitchHtmlEditor />}
    </div>
  );
}
