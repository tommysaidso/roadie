// Direct claim links.
//
// Ben's rule: "provide the direct to claim link or do not use". A prospect
// should land on THEIR page — their name, the video, the packages, one button —
// not a generic signup form they have to find themselves in.
//
// The token carries the business, signed with the SSO_SECRET that ROADIE and
// mymymy already share. That matters because the email is composed in mymymy's
// CRM (postgres) and the landing page is served by ROADIE (sqlite): a signed
// payload crosses that gap with no cross-database lookup and no shared table.
//
// Long-lived on purpose. This goes in a marketing email that may sit unread for
// weeks, so the 5-minute window used for SSO would break it. It grants nothing
// by itself — it only decides whose name is on the page. Claiming still goes
// through the normal account flow, so a leaked link can't take a listing over.

import crypto from "node:crypto";

export const CLAIM_SCOPE = "claim";
export const CLAIM_TTL_DAYS = 180;

export type ClaimPayload = {
  name: string;             // business name, as it appears in the email
  city?: string;
  region?: string;
  email?: string;           // who we wrote to
  kind?: string;            // venue | sponsor | vendor
  cid?: string;             // CRM contact id, so a claim can be traced back
  campaign?: string;
};

function secret() {
  return process.env.SSO_SECRET || "";
}

/** Sign a claim link payload. Returns "" when no secret is configured. */
export function signClaim(p: ClaimPayload): string {
  const s = secret();
  if (!s) return "";
  const body = Buffer.from(JSON.stringify({ ...p, scope: CLAIM_SCOPE, ts: Date.now() }))
    .toString("base64url");
  const sig = crypto.createHmac("sha256", s).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * Verify and unpack. Returns null on any doubt — a bad signature, the wrong
 * scope, or an expired link. Never partially trusts a token.
 */
export function readClaim(token: string): (ClaimPayload & { ts: number }) | null {
  const s = secret();
  if (!s || !token) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", s).update(body).digest("base64url");
  // Constant-time: a length mismatch would throw, so guard it first.
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let p: any;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }

  // A login token must not double as a claim link, or the reverse.
  if (p?.scope !== CLAIM_SCOPE) return null;
  if (!p?.name) return null;
  if (Date.now() - Number(p.ts || 0) > CLAIM_TTL_DAYS * 24 * 60 * 60 * 1000) return null;
  return p;
}

/** The full URL to put in an email. */
export function claimUrl(p: ClaimPayload, base?: string) {
  const root = (base || process.env.ROADIE_PUBLIC_URL || "https://roadie.mymymy.studio")
    .replace(/\/+$/, "");
  const t = signClaim(p);
  return t ? `${root}/claim/${t}` : `${root}/setup`;
}
