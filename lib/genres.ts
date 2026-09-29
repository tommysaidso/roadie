// Genre compatibility for bill-building.
//
// The old matcher compared genre strings with `includes()`, which cannot tell
// you that folk and death metal don't belong on the same night — and treated
// "any" as a pass for everyone. Filling a bill that way produces the thing we
// are specifically trying to avoid: a headliner and a support act the same
// room's crowd would not sit through.
//
// The rule: a bill stays inside a family, or steps to an ADJACENT family. It
// never crosses to a distant one unless the stop or route explicitly asks for a
// blend. Blending is a deliberate booking choice, never a default.

export type Family =
  | "roots" | "rock" | "heavy" | "electronic" | "urban"
  | "jazzblues" | "pop" | "world" | "experimental";

// Tag → family. Substrings, matched longest-first, so "alt country" lands in
// roots rather than being caught by "alt".
const TAGS: [string, Family][] = [
  // roots
  ["alt country", "roots"], ["alt-country", "roots"], ["americana", "roots"], ["bluegrass", "roots"],
  ["folk", "roots"], ["country", "roots"], ["singer songwriter", "roots"], ["singer-songwriter", "roots"],
  ["celtic", "roots"], ["maritime", "roots"], ["western", "roots"], ["roots", "roots"],
  // rock
  ["indie rock", "rock"], ["classic rock", "rock"], ["alt rock", "rock"], ["alternative", "rock"],
  ["garage", "rock"], ["psych", "rock"], ["surf", "rock"], ["grunge", "rock"], ["indie", "rock"], ["rock", "rock"],
  // heavy
  ["hardcore", "heavy"], ["post-hardcore", "heavy"], ["metalcore", "heavy"], ["death metal", "heavy"],
  ["black metal", "heavy"], ["doom", "heavy"], ["sludge", "heavy"], ["thrash", "heavy"],
  ["punk", "heavy"], ["metal", "heavy"],
  // electronic
  ["synthwave", "electronic"], ["drum and bass", "electronic"], ["dnb", "electronic"], ["techno", "electronic"],
  ["house", "electronic"], ["edm", "electronic"], ["dubstep", "electronic"], ["electronic", "electronic"], ["synth", "electronic"],
  // urban
  ["hip hop", "urban"], ["hip-hop", "urban"], ["rap", "urban"], ["r&b", "urban"], ["rnb", "urban"],
  ["soul", "urban"], ["funk", "urban"], ["reggae", "urban"], ["dancehall", "urban"],
  // jazz / blues
  ["jazz", "jazzblues"], ["blues", "jazzblues"], ["swing", "jazzblues"], ["big band", "jazzblues"],
  // pop
  ["pop punk", "heavy"], ["power pop", "rock"], ["pop", "pop"], ["top 40", "pop"], ["dance pop", "pop"],
  // world / other
  ["latin", "world"], ["cumbia", "world"], ["afrobeat", "world"], ["bhangra", "world"], ["world", "world"],
  ["experimental", "experimental"], ["noise", "experimental"], ["ambient", "experimental"], ["drone", "experimental"],
];

// Families that share a crowd. Symmetric; anything not listed is distant.
const ADJACENT: Record<Family, Family[]> = {
  roots:        ["rock", "jazzblues", "pop", "world"],
  rock:         ["roots", "heavy", "pop", "electronic"],
  heavy:        ["rock", "experimental"],
  electronic:   ["rock", "pop", "urban", "experimental"],
  urban:        ["pop", "electronic", "jazzblues"],
  jazzblues:    ["roots", "urban", "world"],
  pop:          ["rock", "roots", "urban", "electronic"],
  world:        ["roots", "jazzblues", "pop"],
  experimental: ["heavy", "electronic"],
};

export function familyOf(genre?: string | null): Family | null {
  const g = String(genre || "").toLowerCase();
  if (!g.trim()) return null;
  for (const [tag, fam] of TAGS) if (g.includes(tag)) return fam;
  return null;
}

/** Every family named in a comma-separated genre string. */
export function familiesOf(genres?: string | null): Family[] {
  const out = new Set<Family>();
  for (const part of String(genres || "").split(/[,/|]/)) {
    const f = familyOf(part);
    if (f) out.add(f);
  }
  if (!out.size) { const f = familyOf(genres); if (f) out.add(f); }
  return [...out];
}

export type Fit = { score: number; verdict: "same" | "adjacent" | "distant" | "unknown"; why: string };

/**
 * How well a candidate act sits under/over another act on one bill.
 *
 * 1.0 same family · 0.6 adjacent · 0 distant (a hard block unless blending is
 * explicitly allowed) · 0.5 unknown, because an untagged act shouldn't be
 * silently promoted OR silently binned — it needs a human glance.
 */
export function billFit(headliner?: string | null, candidate?: string | null): Fit {
  const a = familiesOf(headliner), b = familiesOf(candidate);
  if (!a.length || !b.length) return { score: 0.5, verdict: "unknown", why: "genre not tagged — needs a look" };
  for (const x of a) if (b.includes(x)) return { score: 1, verdict: "same", why: `same lane (${x})` };
  for (const x of a) for (const y of b) if (ADJACENT[x]?.includes(y)) {
    return { score: 0.6, verdict: "adjacent", why: `${y} sits next to ${x}` };
  }
  return { score: 0, verdict: "distant", why: `${b.join("/")} does not belong under ${a.join("/")}` };
}

/** Would this pairing be allowed on a bill? Blend must be asked for. */
export function billAllowed(headliner?: string | null, candidate?: string | null, allowBlend = false): boolean {
  const f = billFit(headliner, candidate);
  if (f.verdict === "distant") return allowBlend;
  return true;
}
