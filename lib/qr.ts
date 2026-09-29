// QR file generation for share-token regeneration — see lib/shareTokens.ts.
//
// Writes into public/, which is already bind-mounted into the container and
// served statically by Next.js with zero extra route code. The QR itself is
// never sensitive: it only ever encodes a link meant to be handed to a
// stranger, so there is nothing to gate here beyond "generate the right PNG."

import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_QR_DIR = path.join(process.cwd(), "public", "crowdcam_qr");
const ARCHIVE_DIR = path.join(PUBLIC_QR_DIR, "archive");

export function qrPngPath(stopId: number) {
  return path.join(PUBLIC_QR_DIR, `qr-stop-${stopId}.png`);
}

export async function writeStopQr(stopId: number, url: string) {
  fs.mkdirSync(PUBLIC_QR_DIR, { recursive: true });
  await QRCode.toFile(qrPngPath(stopId), url, { errorCorrectionLevel: "H", margin: 4 });
}

/**
 * Moves whatever PNG is currently live for a stop into an archive
 * subfolder instead of overwriting it in place — the record Ben asked to
 * keep. The archived file still sits under public/ (harmless: its embedded
 * link is either token-less-and-still-valid, or already revoked by the
 * regeneration that's about to happen), it's just no longer at the path
 * anyone's printed material or the admin console points at.
 */
export function archiveExistingQr(stopId: number) {
  const src = qrPngPath(stopId);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.renameSync(src, path.join(ARCHIVE_DIR, `qr-stop-${stopId}-${stamp}.png`));
}
