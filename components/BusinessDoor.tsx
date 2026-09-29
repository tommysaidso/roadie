"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Video, BadgeDollarSign, X } from "lucide-react";

// THE BUSINESS DOOR — an express lane off the front page.
//
// The homepage is built for bands and fans, which is correct: they are most of
// the traffic. But it means a business owner who came to spend money lands on
// venue counts and a tour map and has to go hunting. That is the one visitor we
// cannot afford to make work for it.
//
// So this sits above everything with two doors and nothing else. No signup, no
// wizard, no "which are you" — a business does not want an account, they want
// to know what it costs and who to talk to.
//
// Order is deliberate: ADVERTISING first, because it is the product most of
// them actually want and the one they have a budget for. Sponsorship second.
//
// Dismissible, and it stays dismissed. A band who lives on this page should see
// it once and never again.

const KEY = "roadie.businessdoor.dismissed";

// Two wordings, so the split can be measured rather than guessed at. Which one
// a visitor sees is stable for that visitor — flipping copy on reload would
// make the numbers meaningless.
const VARIANTS = [
  {
    id: "a",
    head: "Here to advertise or sponsor?",
    sub: "Skip the tour. Two doors, straight to it.",
  },
  {
    id: "b",
    head: "Own a business? Start here.",
    sub: "We make your ad and run it — or back a band from your own town.",
  },
] as const;

export default function BusinessDoor() {
  const [show, setShow] = useState(false);
  const [v, setV] = useState<(typeof VARIANTS)[number]>(VARIANTS[0]);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      // Sticky per visitor so an A/B read means something.
      let pick = localStorage.getItem("roadie.businessdoor.v");
      if (pick !== "a" && pick !== "b") {
        pick = Math.random() < 0.5 ? "a" : "b";
        localStorage.setItem("roadie.businessdoor.v", pick);
      }
      setV(VARIANTS.find(x => x.id === pick) || VARIANTS[0]);
      setShow(true);
    } catch { setShow(true); }
  }, []);

  // Which door got used, and under which wording. Fire-and-forget: a failed
  // beacon must never get between a buyer and the page they asked for.
  const tap = (door: string) => {
    try {
      navigator.sendBeacon?.(
        "/api/track",
        new Blob([JSON.stringify({ what: "business_door", door, variant: v.id })],
          { type: "application/json" }));
    } catch {}
  };

  if (!show) return null;

  return (
    <section className="rounded-2xl border p-4 md:p-5 relative"
      style={{
        borderColor: "#ff3d6e",
        background: "linear-gradient(180deg,rgba(255,61,110,0.08),transparent 85%)",
      }}>
      <button
        onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setShow(false); }}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted hover:text-white">
        <X size={16} />
      </button>

      <div className="text-lg md:text-xl font-black pr-6">{v.head}</div>
      <p className="text-sm text-muted mt-1">{v.sub}</p>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <Link href="/advertising" onClick={() => tap("advertising")}
          className="card-h border border-edge rounded-xl p-4 hover:border-neon flex items-start gap-3">
          <Video size={22} style={{ color: "#ff3d6e" }} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-bold">I want to advertise</div>
            <div className="text-xs text-muted mt-0.5">
              We write, shoot and run your commercial — and you keep every file. Comes out of
              the ad budget you already have.
            </div>
          </div>
        </Link>

        <Link href="/sponsors" onClick={() => tap("sponsor")}
          className="card-h border border-edge rounded-xl p-4 hover:border-neon flex items-start gap-3">
          <BadgeDollarSign size={22} style={{ color: "#b33dff" }} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-bold">I want to sponsor</div>
            <div className="text-xs text-muted mt-0.5">
              Put your name on the ring — or back a band from your own town for the season.
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
