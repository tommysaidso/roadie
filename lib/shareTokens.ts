// Per-show share tokens — the "in case we get compromised" lock for a Crowd
// Cam link.
//
// Deliberately opt-in: a stop with share_token = NULL keeps accepting its
// bare /shoot?stop=<id> link exactly as it always has. Shipping this feature
// must never invalidate a QR or link that's already printed, posted, or sent
// for a show that hasn't had a problem. The moment a stop's first
// regeneration happens, that stop is opted in and its OLD link (whatever
// anyone did with it) stops working from then on — that's the point.
//
// The old token is kept, not discarded — see stop_qr_archive in schema.sql —
// so there's a real record of what was ever valid and when it was revoked.

import crypto from "node:crypto";
import { one, run } from "@/lib/db";
import { archiveExistingQr, writeStopQr } from "@/lib/qr";

export function shootUrlFor(stopId: number, token?: string | null) {
  const base = (process.env.ROADIE_PUBLIC_URL || "https://roadie.mymymy.studio").replace(/\/+$/, "");
  return token ? `${base}/shoot?stop=${stopId}&k=${token}` : `${base}/shoot?stop=${stopId}`;
}

/** True if this stop hasn't opted in yet, or the provided token matches. */
export function verifyShareToken(stopId: number, provided: string | null | undefined) {
  const stop = one<any>(`SELECT share_token FROM stops WHERE id=?`, stopId);
  if (!stop || !stop.share_token) return true;
  return !!provided && provided === stop.share_token;
}

export async function regenerateShareToken(stopId: number) {
  const stop = one<any>(`SELECT id, share_token FROM stops WHERE id=?`, stopId);
  if (!stop) return { ok: false as const, error: "No such show." };

  if (stop.share_token) {
    run(`UPDATE stop_qr_archive SET revoked_at=datetime('now')
          WHERE stop_id=? AND token=? AND revoked_at IS NULL`, stopId, stop.share_token);
  }

  const token = crypto.randomBytes(9).toString("base64url");
  run(`INSERT INTO stop_qr_archive (stop_id, token) VALUES (?, ?)`, stopId, token);
  run(`UPDATE stops SET share_token=? WHERE id=?`, token, stopId);

  archiveExistingQr(stopId);
  const url = shootUrlFor(stopId, token);
  await writeStopQr(stopId, url);

  return { ok: true as const, token, url };
}
