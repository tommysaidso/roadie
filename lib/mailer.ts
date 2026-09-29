// SMTP — ROADIE sends through the same mailbox as mymymy.
//
// ROADIE is not a separate product with its own voice; it is the front of house
// for the same thing. So its mail goes out of welcome@mymymy.studio like
// everything else, rather than a second sender nobody recognises.
//
// Written against the socket rather than pulling in nodemailer, for one
// practical reason: lib/ is bind-mounted into the container, so this ships with
// a restart. A new npm dependency would need the image rebuilt, and the whole
// point was to get invites working today.
//
// It is deliberately small and only does what we send: one recipient, optional
// cc, an HTML body, UTF-8. The fiddly parts of SMTP that actually bite are all
// handled — CRLF line endings, dot-stuffing, base64 auth, header encoding for
// non-ASCII subjects, and a hard timeout so a hung server can never wedge a
// request.

import net from "node:net";
import tls from "node:tls";

export type MailOpts = {
  to: string; subject: string; html: string;
  from?: string; cc?: string; replyTo?: string; text?: string;
};

function cfg() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user;
  return { host, port, user, pass, from };
}

export function smtpConfigured() {
  const c = cfg();
  return !!(c.host && c.user && c.pass);
}

export function mailerStatus() {
  const c = cfg();
  return { configured: smtpConfigured(), host: c.host, port: c.port, from: c.from };
}

/** RFC 2047 — so an em-dash in a subject line doesn't arrive as mojibake. */
function encodeHeader(s: string) {
  return /^[\x20-\x7E]*$/.test(s)
    ? s
    : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

/** A line-oriented SMTP conversation over one socket. */
function talk(sock: net.Socket, timeoutMs: number) {
  let buf = "";
  const waiters: { re: RegExp; resolve: (s: string) => void; reject: (e: Error) => void }[] = [];

  sock.setEncoding("utf8");
  sock.on("data", (chunk: string) => {
    buf += chunk;
    // A reply ends on a line whose 4th char is a space: "250 OK".
    const m = buf.match(/^\d{3} [^\n]*\r?\n/m);
    if (!m) return;
    const reply = buf;
    buf = "";
    const w = waiters.shift();
    if (w) w.resolve(reply);
  });

  const expect = (codes: number[]) => new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SMTP timed out waiting for the server")), timeoutMs);
    waiters.push({
      re: /./,
      resolve: (s) => {
        clearTimeout(t);
        const code = Number(s.trim().slice(0, 3));
        if (codes.includes(code)) resolve(s);
        else reject(new Error(`SMTP ${code}: ${s.trim().split("\n").pop()}`));
      },
      reject: (e) => { clearTimeout(t); reject(e); },
    });
  });

  const send = (line: string) => { sock.write(line + "\r\n"); };
  return { expect, send };
}

/**
 * Send one message.
 *
 * Throws on failure so callers can log WHY — every caller here records the
 * error against the recipient, which is the whole point of a send log.
 */
export async function smtpSend(opts: MailOpts): Promise<{ ok: true }> {
  const c = cfg();
  if (!smtpConfigured()) throw new Error("SMTP isn't configured on this server.");

  const from = opts.from || c.from;
  const rcpts = [opts.to, ...(opts.cc ? opts.cc.split(",") : [])]
    .map(s => s.trim()).filter(Boolean);
  if (!rcpts.length) throw new Error("No recipient.");

  const TIMEOUT = 25000;
  const sock: net.Socket = await new Promise((resolve, reject) => {
    const s = net.connect({ host: c.host, port: c.port });
    s.setTimeout(TIMEOUT, () => { s.destroy(); reject(new Error("SMTP connect timed out")); });
    s.once("connect", () => resolve(s));
    s.once("error", reject);
  });

  let io = talk(sock, TIMEOUT);
  let active: net.Socket | tls.TLSSocket = sock;

  try {
    await io.expect([220]);
    io.send("EHLO roadie.mymymy.studio");
    await io.expect([250]);

    // 587 is STARTTLS; 465 is implicit TLS and would have needed a TLS socket
    // from the start. We only ever use 587, but fail loudly rather than send a
    // password in the clear if that ever changes.
    if (c.port !== 465) {
      io.send("STARTTLS");
      await io.expect([220]);
      const sec: tls.TLSSocket = await new Promise((resolve, reject) => {
        const t = tls.connect({ socket: sock, servername: c.host }, () => resolve(t));
        t.once("error", reject);
      });
      active = sec;
      io = talk(sec as any, TIMEOUT);
      io.send("EHLO roadie.mymymy.studio");
      await io.expect([250]);
    } else {
      throw new Error("Port 465 needs implicit TLS — use 587.");
    }

    io.send("AUTH LOGIN");
    await io.expect([334]);
    io.send(Buffer.from(c.user, "utf8").toString("base64"));
    await io.expect([334]);
    io.send(Buffer.from(c.pass, "utf8").toString("base64"));
    await io.expect([235]);

    io.send(`MAIL FROM:<${from.replace(/.*<|>.*/g, "") || c.user}>`);
    await io.expect([250]);
    for (const r of rcpts) {
      io.send(`RCPT TO:<${r.replace(/.*<|>.*/g, "")}>`);
      await io.expect([250, 251]);
    }

    io.send("DATA");
    await io.expect([354]);

    const headers = [
      `From: ${from}`,
      `To: ${opts.to}`,
      ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
      ...(opts.replyTo ? [`Reply-To: ${opts.replyTo}`] : []),
      `Subject: ${encodeHeader(opts.subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      `Date: ${new Date().toUTCString()}`,
    ].join("\r\n");

    // Dot-stuffing: a line that is just "." would end the message early.
    const body = String(opts.html || "")
      .replace(/\r?\n/g, "\r\n")
      .replace(/^\./gm, "..");

    active.write(headers + "\r\n\r\n" + body + "\r\n.\r\n");
    await io.expect([250]);

    io.send("QUIT");
    try { await io.expect([221]); } catch { /* some servers just close */ }
    return { ok: true };
  } finally {
    try { active.destroy(); } catch {}
    try { sock.destroy(); } catch {}
  }
}
