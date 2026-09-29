import { NextRequest, NextResponse } from "next/server";
import { requireUser, forbid } from "@/lib/guard";
import { usesMymymy } from "@/lib/roles";
import { ensureProfileSchema, activeProfile, PROFILE_COOKIE } from "@/lib/profiles";
import { ssoToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The band's radio switch, driven from ROADIE but decided by mymymy.
//
// We mint a short-lived, radio-scoped token naming the signed-in user and hand
// it to mymymy's /svc/radio. It resolves that email itself and applies its own
// station-ownership rules. ROADIE says who is asking; mymymy says what they may
// do. Nothing long-lived is stored on this side, and a bug here can't widen a
// band's guarantee.

// NOT MYMYMY_API_URL. That points at the NAS container, which is a stale
// backup with no radio module in it at all — calls would 404 forever and look
// like a broken feature. The live mymymy is the GCP deployment behind the
// public hostname. The /api prefix matters too: the Next front end only
// forwards /api, /auth, /billing, /go and /sso to the API, so /svc/... alone
// lands on the web app and 404s.
const BASE = (process.env.MYMYMY_SVC_URL || process.env.MYMYMY_PUBLIC_URL ||
  "https://app.mymymy.studio").replace(/\/+$/, "");
const SVC = "/api/svc/radio";

function actingToken(user: any) {
  // scope pins it to the radio: mymymy's /sso refuses a scoped token as a
  // login, and /svc/radio refuses an unscoped one as a control call.
  return ssoToken({ email: user.email, scope: "radio" });
}

async function call(path: string, body: any) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
      cache: "no-store",
    });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { ok: r.ok, status: r.status, data, text };
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  // Hiding the button isn't a control. Fans, host sites and sponsors hold no
  // catalog, so they never get a token minted for them at all. The active
  // profile decides — the same login wearing a sponsor hat has no business here.
  ensureProfileSchema();
  const kind = activeProfile(g.user, req.cookies.get(PROFILE_COOKIE)?.value)?.kind || null;
  if (!usesMymymy(g.user, kind)) return NextResponse.json({ stations: [], no_account: true });

  const token = actingToken(g.user);
  if (!token) {
    return NextResponse.json({
      error: "The link to mymymy isn't configured on this server (SSO_SECRET missing).",
      stations: [],
    }, { status: 503 });
  }

  try {
    const r = await call(`${SVC}/stations`, { token });
    if (!r.ok) {
      // 404 just means they've never signed into mymymy — not an error worth
      // shouting about, it's the normal state for a new band.
      if (r.status === 404) return NextResponse.json({ stations: [], no_account: true });
      return NextResponse.json({
        error: r.data?.detail || `mymymy said ${r.status}`, stations: [],
      }, { status: 502 });
    }
    return NextResponse.json({ stations: r.data?.stations || [] });
  } catch (e: any) {
    return NextResponse.json({
      error: `Couldn't reach mymymy: ${e?.message || e}`, stations: [],
    }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  ensureProfileSchema();
  const kind = activeProfile(g.user, req.cookies.get(PROFILE_COOKIE)?.value)?.kind || null;
  if (!usesMymymy(g.user, kind)) return forbid("Switch to your artist profile to manage radio stations.");

  const b = await req.json().catch(() => ({}));
  const slug = String(b?.slug || "").trim();
  if (!slug) return NextResponse.json({ error: "Pass a station slug." }, { status: 400 });

  const token = actingToken(g.user);
  if (!token) {
    return NextResponse.json({ error: "The link to mymymy isn't configured on this server." }, { status: 503 });
  }

  try {
    const r = await call(`${SVC}/station/${encodeURIComponent(slug)}/public`,
      { token, is_public: !!b?.is_public });
    if (!r.ok) {
      return NextResponse.json({ error: r.data?.detail || `mymymy said ${r.status}` }, { status: r.status });
    }
    return NextResponse.json(r.data);
  } catch (e: any) {
    return NextResponse.json({ error: `Couldn't reach mymymy: ${e?.message || e}` }, { status: 502 });
  }
}
