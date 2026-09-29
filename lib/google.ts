// Google Workspace service layer — Gmail (send) + Drive (upload).
// OAuth2 with a refresh token (generate once; store in .env). All calls are
// env-gated: if Google isn't configured, callers get a clear, non-fatal error
// so the rest of ROADIE keeps working offline.
import { google } from "googleapis";
import { smtpSend, smtpConfigured } from "./mailer";

export function googleConfigured(){
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

/**
 * Can this server send mail at all?
 *
 * Every caller used to ask googleConfigured() before offering a Send button,
 * which meant the whole platform believed it was mute whenever the OAuth flow
 * was not set up — even with a perfectly good mailbox sitting there. The
 * question they actually want answered is "can mail go out", so that is what
 * this is, and SMTP counts.
 */
export function mailConfigured(){
  return smtpConfigured() || googleConfigured();
}

function oauth(){
  const o = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "https://developers.google.com/oauthplayground",
  );
  o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return o;
}

export async function sendEmail(opts:{ to:string; subject:string; html:string; from?:string; cc?:string; replyTo?:string }){
  // SMTP first. ROADIE is the front of house for mymymy, not a separate
  // product, so its mail leaves from the same mailbox everything else does.
  if (smtpConfigured()) {
    await smtpSend(opts);
    return { id: null as string | null, via: "smtp" as const };
  }
  if(!googleConfigured()) throw new Error("No mail configured — set SMTP_HOST/USER/PASSWORD (or the Google OAuth trio) in .env");
  const gmail = google.gmail({ version:"v1", auth:oauth() });
  const from = opts.from || process.env.GOOGLE_SEND_FROM || "me";
  const raw = Buffer.from(
    `From: ${from}\r\nTo: ${opts.to}\r\nSubject: ${opts.subject}\r\n` +
    `MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${opts.html}`
  ).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const r = await gmail.users.messages.send({ userId:"me", requestBody:{ raw } });
  return { id: r.data.id, via: "gmail" as const };
}

export async function uploadToDrive(opts:{ name:string; mimeType:string; dataBase64:string; folderId?:string }){
  if(!googleConfigured()) throw new Error("Google not configured — set GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN in .env");
  const drive = google.drive({ version:"v3", auth:oauth() });
  const buf = Buffer.from(opts.dataBase64, "base64");
  const { Readable } = await import("node:stream");
  const r = await drive.files.create({
    requestBody:{ name:opts.name, parents: opts.folderId? [opts.folderId] : (process.env.GOOGLE_DRIVE_FOLDER_ID? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined) },
    media:{ mimeType:opts.mimeType, body: Readable.from(buf) },
    fields:"id,webViewLink",
  });
  return { id:r.data.id, link:r.data.webViewLink };
}
