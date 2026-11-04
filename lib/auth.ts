import crypto from "node:crypto";
import { getDb, one, run } from "./db";
import { grantedRole } from "./roles";

export const SESSION_COOKIE = "roadie_session";
// Idle timeout: a sign-in ends after 24 hours without use. Any visit inside that
// window carries on and resets the clock, so nobody is asked to sign in again
// while they keep using it.
export const SESSION_MS = 24*60*60*1000;
const TOUCH_MS = 5*60*1000;  // refresh last_seen at most every 5 minutes

// Idempotent: ensure auth columns/tables exist on any DB (fresh or older seed).
export function ensureAuthSchema(){
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS auth_sessions(token TEXT PRIMARY KEY, user_id INTEGER, expires TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  try{ db.exec(`ALTER TABLE auth_sessions ADD COLUMN last_seen TEXT`); }catch{}
  for(const col of ["pass_hash TEXT","pass_salt TEXT","band_id INTEGER","venue_id INTEGER","sponsor_id INTEGER"]){
    try{ db.exec(`ALTER TABLE users ADD COLUMN ${col}`); }catch{}
  }
}

export function hashPassword(pw:string){
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return { salt, hash };
}
export function verifyPassword(pw:string, salt:string, hash:string){
  try{ const h = crypto.scryptSync(pw, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(h,"hex"), Buffer.from(hash,"hex")); }
  catch{ return false; }
}

export function findUserByEmail(email:string){ return one<any>("SELECT * FROM users WHERE lower(email)=?", String(email||"").toLowerCase()); }

export function createUser(o:{email:string;password:string;name?:string;role?:string}){
  const { salt, hash } = hashPassword(o.password);
  const r = run("INSERT INTO users(email,display_name,role,pass_hash,pass_salt) VALUES(?,?,?,?,?)",
    o.email.toLowerCase(), o.name||"", o.role||"fan", hash, salt);
  return Number(r.lastInsertRowid);
}
/** Set (or reset) a password. Used by the first-login invite flow so nobody
 *  is ever emailed a credential — they choose their own on the way in. */
export function setPassword(userId:number, password:string){
  const { salt, hash } = hashPassword(password);
  run("UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?", hash, salt, userId);
}

export function linkProfile(userId:number, role:string, recordId:number){
  const col = role==="band"?"band_id":role==="venue"?"venue_id":role==="sponsor"?"sponsor_id":null;
  if(col) run(`UPDATE users SET ${col}=?, role=? WHERE id=?`, recordId, role, userId);
}

export function newSession(userId:number){
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now()+SESSION_MS).toISOString();
  run("INSERT INTO auth_sessions(token,user_id,expires) VALUES(?,?,?)", token, userId, expires);
  return token;
}
let lastSeenReady = false;
export function userForToken(token?:string|null){
  if(!token) return null;
  if(!lastSeenReady){ try{ getDb().exec(`ALTER TABLE auth_sessions ADD COLUMN last_seen TEXT`); }catch{} lastSeenReady = true; }
  const s = one<any>("SELECT * FROM auth_sessions WHERE token=?", token);
  if(!s) return null;
  if(new Date(s.expires) < new Date()){ run("DELETE FROM auth_sessions WHERE token=?", token); return null; }
  // Sessions from before idle tracking have no last_seen: judge them by when they began.
  const lastUse = s.last_seen ? new Date(s.last_seen).getTime() : Date.parse(String(s.created_at).replace(" ","T")+"Z");
  if(Date.now()-lastUse > SESSION_MS){ run("DELETE FROM auth_sessions WHERE token=?", token); return null; }
  if(!s.last_seen || Date.now()-lastUse > TOUCH_MS){
    const now = new Date();
    try{ run("UPDATE auth_sessions SET expires=?, last_seen=? WHERE token=?", new Date(now.getTime()+SESSION_MS).toISOString(), now.toISOString(), token); }catch{}
  }
  const u = one<any>("SELECT id,email,display_name,role,band_id,venue_id,sponsor_id FROM users WHERE id=?", s.user_id) || null;
  if(!u) return null;
  // Admin comes from the email list in lib/roles, evaluated every request, so
  // the code is the source of truth and no stored row has to be patched.
  // Only ever raises access — a stored role is never lowered here.
  const granted = grantedRole(u.email);
  if(granted) u.role = granted;
  return u;
}
export function destroySession(token?:string|null){ if(token) run("DELETE FROM auth_sessions WHERE token=?", token); }


export function ssoToken(payload:Record<string,any>){
  const secret = process.env.SSO_SECRET || ""; if(!secret) return "";
  const body = Buffer.from(JSON.stringify({ ...payload, ts:Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}
export function verifySsoToken(token:string){
  const secret = process.env.SSO_SECRET || ""; if(!secret || !token) return null;
  const [body,sig] = String(token).split("."); if(!body || !sig) return null;
  const exp = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if(exp !== sig) return null;
  try{ const p = JSON.parse(Buffer.from(body,"base64url").toString()); if(Date.now()-p.ts > 5*60000) return null; return p; }catch{ return null; }
}

export function cookieOpts(req?: { headers: { get(n:string):string|null }, nextUrl?: { protocol?: string } }){
  // Secure cookies die on plain-http LAN visits (http://192.168.x.x:3001) —
  // the browser silently drops them and the user is "forgotten" every visit.
  // So: mark Secure only when this request actually arrived over https
  // (Cloudflare tunnel sets x-forwarded-proto). No req → old behavior.
  const proto = req?.headers?.get("x-forwarded-proto") || req?.nextUrl?.protocol?.replace(":","") || "";
  const secure = proto ? proto === "https" : process.env.NODE_ENV==="production";
  return { httpOnly:true as const, sameSite:"lax" as const, path:"/", secure,
    ...(process.env.COOKIE_DOMAIN? { domain: process.env.COOKIE_DOMAIN } : {}), maxAge: 30*86400 };  // the server enforces the 24-hour idle limit
}
