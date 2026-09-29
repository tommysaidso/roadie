// LOCALJAMS BRIDGE — peer federation, no master.
//
// Properties (socaljams, future localjams towns) talk to ROADIE over one signed
// POST endpoint. Email is the member join key across properties; every message
// carries the sender's property slug and an HMAC so the wire needs no shared
// user database and no OAuth dance a small operator can't run.
//
// Signature: HMAC-SHA256( secret, `${property}.${timestamp}.${rawBody}` ),
// hex-encoded, in the `x-bridge-signature` header, with `x-bridge-property`
// and `x-bridge-timestamp` (unix seconds). Five-minute replay window.
//
// Dark unless ROADIE_BRIDGE_SECRETS is set — same doctrine as vendor offers:
// an unshipped surface answers 404, never 403.
//
// ROADIE_BRIDGE_SECRETS format: "property:secret,property2:secret2"

import crypto from "node:crypto";

const WINDOW_S = 300;

function secrets(): Record<string, string> {
  const raw = process.env.ROADIE_BRIDGE_SECRETS || "";
  const out: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
}

export function bridgeEnabled() {
  return Object.keys(secrets()).length > 0;
}

export function verifyBridge(
  property: string, timestamp: string, signature: string, rawBody: string,
): { ok: true } | { ok: false; error: string } {
  const secret = secrets()[property];
  if (!secret) return { ok: false, error: "Unknown property." };

  const ts = Number(timestamp);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > WINDOW_S) {
    return { ok: false, error: "Stale or missing timestamp." };
  }

  const expect = crypto
    .createHmac("sha256", secret)
    .update(`${property}.${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expect);
  const b = Buffer.from(String(signature || ""));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "Bad signature." };
  }
  return { ok: true };
}

/** Sign an OUTBOUND call to a peer property (same scheme, roles reversed). */
export function signOutbound(property: string, rawBody: string) {
  const secret = secrets()[property];
  if (!secret) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`roadie.${timestamp}.${rawBody}`)
    .digest("hex");
  return { timestamp, signature };
}
