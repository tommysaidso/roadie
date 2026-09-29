import { NextRequest, NextResponse } from "next/server";
import { userForToken, SESSION_COOKIE } from "./auth";
import { isOperator } from "./roles";

// Route-level auth guards. ROADIE is public through the Cloudflare tunnel, so
// every mutation must prove a session. Reads stay open (front-of-house).
//
// Usage in a route:
//   const g = requireUser(req); if (g.deny) return g.deny;
//   ... g.user is the signed-in user row ...

export function requireUser(req: NextRequest) {
  const user = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return {
      user: null as any,
      deny: NextResponse.json(
        { error: "Sign in required. Create a free account via Get Started." },
        { status: 401 },
      ),
    };
  }
  return { user, deny: null as null };
}

// Must agree with lib/roles.ts, which is the only thing that GRANTS roles.
// A local ["admin","operator"] set used to live here — but grantedRole() only
// ever issues "super_admin" or "manager", so the set matched nobody and every
// elevated bypass below was dead: the platform owner failed his own ownership
// checks and never saw the owner UI. Defer to roles.ts so the two can't drift.
export function isElevated(u: any) { return isOperator(u); }

// Ownership checks — elevated roles bypass. A user owns the profile their
// account is linked to (users.band_id / venue_id / sponsor_id via /api/auth/link).
//
// Ownership is the UNION of every profile the user holds, not whichever hat
// they happen to be wearing. Someone running two businesses and a band still
// owns all three while looking at one of them; making this depend on the active
// profile would lock people out of their own records mid-switch.
//
// The legacy users.band_id column is still honoured so nothing depends on the
// backfill having run.
function holds(u: any, kind: "band" | "venue" | "sponsor", id: any) {
  const want = Number(id);
  if (!want) return false;
  try {
    // Imported lazily: guard.ts is pulled into every route, and profiles.ts
    // touches the DB at import time.
    const { ownedIds } = require("./profiles");
    if (ownedIds(u, kind).includes(want)) return true;
  } catch { /* schema not up yet — fall through to the legacy column */ }
  return false;
}

export function ownsBand(u: any, bandId: any)      { return isElevated(u) || (!!u?.band_id    && Number(u.band_id)    === Number(bandId))    || holds(u, "band", bandId); }
export function ownsVenue(u: any, venueId: any)    { return isElevated(u) || (!!u?.venue_id   && Number(u.venue_id)   === Number(venueId))   || holds(u, "venue", venueId); }
export function ownsSponsor(u: any, sponsorId: any){ return isElevated(u) || (!!u?.sponsor_id && Number(u.sponsor_id) === Number(sponsorId)) || holds(u, "sponsor", sponsorId); }

export function forbid(msg = "You can only act on your own profile.") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

// Naive in-memory rate limiter for the few endpoints that stay anonymous
// (fan follows/questions). Per-IP fixed window; resets on process restart —
// good enough to stop drive-by floods, not a DDoS shield.
const hits = new Map<string, { n: number; t: number }>();
export function rateLimit(req: NextRequest, key: string, max = 20, windowMs = 60 * 60 * 1000) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const h = hits.get(k);
  if (!h || now - h.t > windowMs) { hits.set(k, { n: 1, t: now }); return null; }
  h.n++;
  if (h.n > max) return NextResponse.json({ error: "Too many requests — try again later." }, { status: 429 });
  return null;
}
