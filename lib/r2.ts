// R2 — object storage for anything too big to live beside the database.
//
// Why presigned URLs and not "upload to us, we forward it":
//
//   Cloudflare rejects any request body over 100 MB before it reaches our
//   origin. A phone video of one song is routinely bigger than that, so an
//   upload that goes through us is an upload that fails at 99% for the exact
//   people we most want to bother. A presigned PUT goes from the phone STRAIGHT
//   to R2 — our server never sees the bytes, the limit never applies, and we
//   are not paying to shuttle gigabytes through a container.
//
// Why the signing is written out here instead of pulling in @aws-sdk:
// lib/ is bind-mounted into the container, so anything in here ships with a
// restart. A new npm dependency needs the image rebuilt. Same reasoning as
// lib/mailer.ts, and SigV4 query presigning is about sixty lines.
//
// R2 is S3-compatible, region is always "auto", and presigned requests use
// UNSIGNED-PAYLOAD because the body is streamed by a browser we do not control.

import crypto from "node:crypto";

const SERVICE = "s3";
const REGION = "auto";

export type R2Config = {
  endpoint: string; accessKey: string; secretKey: string; bucket: string; prefix: string;
};

export function r2Config(): R2Config | null {
  const endpoint = (process.env.R2_ENDPOINT || "").replace(/\/$/, "");
  const accessKey = process.env.R2_ACCESS_KEY || "";
  const secretKey = process.env.R2_SECRET_KEY || "";
  const bucket = process.env.R2_BUCKET || "";
  if (!endpoint || !accessKey || !secretKey || !bucket) return null;
  return {
    endpoint, accessKey, secretKey, bucket,
    prefix: (process.env.R2_PREFIX || "roadie/fanclips").replace(/^\/|\/$/g, ""),
  };
}

export function r2Configured() { return !!r2Config(); }

const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
const hmac = (k: Buffer | string, s: string) => crypto.createHmac("sha256", k).update(s).digest();

/** Everything except unreserved characters, and NOT the slashes in a key path. */
function uriEncode(s: string, encodeSlash = true) {
  return s.replace(/[^A-Za-z0-9_.\-~/]/g, c =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))
    .replace(/\//g, encodeSlash ? "%2F" : "/");
}

function signingKey(secret: string, date: string) {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), REGION), SERVICE), "aws4_request");
}

/**
 * A presigned URL for one object and one method.
 *
 * `expiresIn` is seconds and is capped at 7 days by the algorithm itself.
 * Keep it short — a leaked upload URL is a writeable hole until it expires.
 */
export function presign(
  method: "PUT" | "GET" | "DELETE",
  key: string,
  opts: { expiresIn?: number; contentType?: string } = {},
): string | null {
  const cfg = r2Config();
  if (!cfg) return null;

  const url = new URL(cfg.endpoint);
  const host = url.host;
  const expires = Math.min(Math.max(opts.expiresIn ?? 900, 30), 604800);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");   // 20260813T101530Z
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;

  // R2 endpoints are path-style: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
  const canonicalUri = "/" + uriEncode(`${cfg.bucket}/${key}`, false);

  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(q).sort()
    .map(k => `${uriEncode(k)}=${uriEncode(q[k])}`).join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest),
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", signingKey(cfg.secretKey, date))
    .update(stringToSign).digest("hex");

  return `${url.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** The full object key for a fan clip, namespaced so nothing collides. */
export function fanClipKey(stopId: number, clipId: number, filename: string) {
  const cfg = r2Config();
  const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-100);
  return `${cfg?.prefix || "roadie/fanclips"}/${stopId}/${clipId}-${safe}`;
}
