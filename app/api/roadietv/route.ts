import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { rateLimit } from "@/lib/guard";
export const dynamic = "force-dynamic";

// The interrupt handler.
//
// Order of preference, and it matters:
//   1. a cached ATOM whose intent matches -> audio already on disk, plays instantly
//   2. a live answer, grounded strictly in the plan -> slower, cached on the way out
//   3. the honest "the plan doesn't cover that" connector
//
// It will never introduce a number, partner, date or claim that is not in the
// source. In front of a label, a confident wrong answer is worse than none.

const EP_DIR = path.join(process.cwd(), "public", "roadietv", "ep01");
const HOST = "https://generativelanguage.googleapis.com/v1beta";

function manifest(): any | null {
  try { return JSON.parse(fs.readFileSync(path.join(EP_DIR, "manifest.json"), "utf8")); }
  catch { return null; }
}

const STOP = new Set(["the","a","an","is","are","do","does","you","your","we","our","i","it","to",
  "of","and","or","for","in","on","at","this","that","what","how","why","who","can","will","would",
  "about","with","if","so","me","my","tell","more","much","many"]);

/** Crude singular/tense fold so "venue says no" still matches "venue say no". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && (w.endsWith("ing") || w.endsWith("ers"))) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function terms(s: string): string[] {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
}

/** Score an atom against the question by intent phrases first, then topic/body. */
function scoreAtom(a: any, q: string, qt: string[]): number {
  const ql = q.toLowerCase();
  let s = 0;
  for (const phrase of a.intent || []) {
    const p = String(phrase).toLowerCase();
    if (ql.includes(p)) s += 6;                       // whole intent phrase present
    else {
      const pt = terms(p);
      const hit = pt.filter(t => qt.includes(t)).length;
      if (pt.length && hit === pt.length) s += 4;      // all words, any order
      else s += hit * 1.2;
    }
  }
  for (const t of terms(a.topic)) if (qt.includes(t)) s += 2.5;
  const body = terms(a.vo);
  s += qt.filter(t => body.includes(t)).length * 0.35;
  return s;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "roadietv", 90); if (limited) return limited;
  const m = manifest();
  if (!m) return NextResponse.json({ error: "Episode not rendered yet." }, { status: 503 });

  const { question, played = [] } = await req.json().catch(() => ({} as any));
  const q = String(question || "").trim();
  if (!q) return NextResponse.json({ error: "Ask something." }, { status: 400 });

  const qt = terms(q);
  const ranked = (m.atoms || [])
    .filter((a: any) => a.audio)
    .map((a: any) => ({ a, score: scoreAtom(a, q, qt) }))
    .sort((x: any, y: any) => y.score - x.score);

  const conn = (id: string) => (m.connectors || []).find((c: any) => c.id === id) || null;

  // --- 1. cached pathway -------------------------------------------------
  if (ranked.length && ranked[0].score >= 4) {
    const picks = [ranked[0].a];
    // a clearly-related second atom makes the reply feel composed, not retrieved
    if (ranked[1] && ranked[1].score >= Math.max(3, ranked[0].score * 0.55)) picks.push(ranked[1].a);

    const parts: any[] = [];
    const opener = conn(picks.length > 1 ? "c_ack" : "c_right");
    if (opener?.audio) parts.push({ kind: "connector", ...opener });
    parts.push({ kind: "atom", ...picks[0] });
    if (picks[1]) {
      const mid = conn("c_and");
      if (mid?.audio) parts.push({ kind: "connector", ...mid });
      parts.push({ kind: "atom", ...picks[1] });
    }
    const resume = conn("c_resume");
    if (resume?.audio) parts.push({ kind: "connector", ...resume });

    return NextResponse.json({
      source: "cached",
      parts,
      text: picks.map((p: any) => p.vo).join(" "),
      reorder: reorderFor(m, picks, played),
      topics: picks.map((p: any) => p.topic),
    });
  }

  // --- 2. live, grounded -------------------------------------------------
  const live = await answerFromPlan(q, m);
  if (live) {
    return NextResponse.json({
      source: "live", parts: [], text: live,
      reorder: reorderFor(m, [], played),
      note: "Spoken by the browser while this answer is cached for next time.",
    });
  }

  // --- 3. say so ---------------------------------------------------------
  const nope = conn("c_nope");
  return NextResponse.json({
    source: "unknown",
    parts: nope?.audio ? [{ kind: "connector", ...nope }] : [],
    text: "The plan doesn't cover that one, so I won't guess at it — Benjamin Easterday is the person to ask.",
    reorder: reorderFor(m, [], played),
  });
}

/** Play the beats that match what they just asked about next. */
function reorderFor(m: any, picks: any[], played: string[]): string[] {
  const grounds = new Set(picks.flatMap((p: any) => p.grounds || []));
  const left = (m.beats || []).filter((b: any) => !played.includes(b.id));
  if (!grounds.size) return left.map((b: any) => b.id);
  const hot = left.filter((b: any) => (b.grounds || []).some((g: string) => grounds.has(g)));
  const rest = left.filter((b: any) => !hot.includes(b));
  return [...hot, ...rest].map((b: any) => b.id);
}

async function answerFromPlan(q: string, m: any): Promise<string | null> {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean) as string[];
  if (!keys.length) return null;
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

  // The plan, as the ONLY source of truth available to the model.
  const source = [
    ...(m.beats || []).map((b: any) => `${b.cue}: ${b.vo}`),
    ...(m.atoms || []).map((a: any) => `${String(a.topic).toUpperCase()}: ${a.vo}`),
  ].join("\n");

  const system =
    "You are the narrator of RoadieTV, answering a visitor mid-episode. " +
    "Answer ONLY from the SOURCE below. You may reference a well-known outside example to " +
    "explain an idea, but you must come straight back to the source and never let the example " +
    "add facts. NEVER state a number, partner, date, place or claim that is not in the SOURCE. " +
    "If the SOURCE does not answer it, reply exactly: NOT_IN_PLAN. " +
    "Two or three sentences, spoken aloud, plain and dry. No lists, no markdown.";

  for (const key of keys) {
    try {
      const r = await fetch(`${HOST}/models/${model}:generateContent?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: `SOURCE:\n${source}\n\nVISITOR: ${q}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const txt = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).join("").trim();
      if (!txt || txt.includes("NOT_IN_PLAN")) return null;
      return txt;
    } catch { /* next key */ }
  }
  return null;
}
