import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, one, all, run } from "./db";

// Vendor pages: one template (content/vendor-template/page.html) + one facts file per
// vendor (content/vendors/<slug>.json) + that vendor's images in public/vendors/<slug>/.
// A new vendor is a new JSON file and a folder of photos; nothing else changes.
// Sections whose key is missing from the JSON drop out of the page.

const ROOT = process.cwd();
const SLUG_RE = /^[a-z0-9-]{2,40}$/;

export type Vendor = Record<string, any> & { slug: string; name: string; owner: string };

export function loadVendor(slug: string): Vendor | null {
  if (!SLUG_RE.test(slug)) return null;
  const p = path.join(ROOT, "content", "vendors", slug + ".json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

export function listVendors(): Vendor[] {
  const dir = path.join(ROOT, "content", "vendors");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".json"))
    .map(f => loadVendor(f.slice(0, -5))).filter(Boolean) as Vendor[];
}

// Text in the JSON is trusted (written by us), but names and notes still go through this
// so a stray quote cannot break an attribute.
const attr = (s: any) => String(s ?? "").replace(/"/g, "&quot;");

export function renderVendorPage(v: Vendor, origin: string): string {
  const tpl = fs.readFileSync(path.join(ROOT, "content", "vendor-template", "page.html"), "utf8");
  const img = (f: string) => (f.startsWith("/") ? f : `/vendors/${v.slug}/${f}`);
  const payBadges = (v.pay || []).map((p: any) =>
    `<span class="badge${p.accent ? " red" : ""}" data-note="${attr(p.note)}">${p.label}</span>`).join("");
  const wall = (v.wall || []).map((g: any) => ({ ...g, img: img(g.img) }));
  const n = wall.length;

  const fields: Record<string, string> = {
    NAME: v.name, OWNER: v.owner, CITY: v.city || "", PLACE: v.place || v.city || "",
    WORD1: v.word1 || v.name, WORD2: v.word2 || "", TAGLINE: v.tagline || "",
    MEMBER_LABEL: v.member_label || "Member vendor", MEMBER_NOTE: attr(v.member_note || ""),
    BG: img(v.images?.bg || ""), HERO: img(v.images?.hero || ""), MARK: v.images?.mark ? img(v.images.mark) : "",
    CANONICAL: `${origin}/vendors/${v.slug}`,
    WALL_COUNT: `${n} ${n === 1 ? "instrument" : "instruments"}`, WALL_NOTE: v.wall_note || "", PAY_BADGES: payBadges,
    PARTS_SUMMARY: v.parts?.summary || "",
    PARTS_TILES: (v.parts?.tiles || []).map((t: any) =>
      `<div class="tile"><b>${t.title}</b><p>${t.text}</p><button class="btn inline trace" data-req="${attr(t.title)}">Request an order</button></div>`).join(""),
    BODIES_LABEL: v.build?.bodies_label || "Body", BODIES_NOTE: v.build?.bodies_note || "",
    BODY_CARDS: (v.build?.bodies || []).map((b: any, i: number) =>
      `<button type="button" class="bodycard trace" aria-pressed="${i === 0}" id="b${i + 1}" data-note="${attr(b.note)}">` +
      `<span class="bimg"><img class="front" src="${img(b.front)}" alt="${attr(b.name)}, front"><img class="back" src="${img(b.back || b.front)}" alt="${attr(b.name)}, back"></span>` +
      `<b>${b.name}</b><small>${b.detail || ""}</small></button>`).join(""),
    TOP_PILLS: (v.build?.tops || []).map((t: any, i: number) =>
      `<button type="button" class="pill" aria-pressed="${i === 0}" id="w${i + 1}" data-note="${attr(t.note)}">${t.label}</button>`).join(""),
    LESSONS_TEXT: v.lessons?.text || "",
    SERVICES: (v.lessons?.services || []).map((s: any) => `<details><summary>${s.title}</summary><p>${s.text}</p></details>`).join(""),
    SIG_TITLE: v.signature?.title || "", SIG_SUMMARY: v.signature?.summary || "", SIG_TEXT: v.signature?.text || "",
    SIG_LINK: v.signature?.link || "", SIG_LINK_LABEL: v.signature?.link_label || "Meet the artist",
    PROG_TITLE: v.program?.title || "", PROG_SUMMARY: v.program?.summary || "",
    PROG_STATS: (v.program?.stats || []).map(([b, s]: [string, string]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join(""),
    SHOW_SUMMARY: v.showcase?.summary || "",
    SHOW_CARDS: (v.showcase?.cards || []).map((c: any, i: number) =>
      `<div class="mcard trace" style="background-image:url('${img(c.img)}')" data-media="m${i}" data-src="${img(c.img)}" tabindex="0"><span>${c.label}</span></div>`).join(""),
    FOOTER_LINKS: (v.footer_links || []).map((l: string) => `<code>${l}</code>`).join(""),
    FOOTER_NOTE: v.footer_note || "",
    VENDOR_JSON: JSON.stringify({ slug: v.slug, owner: v.owner, wall, pay_badges: payBadges }).replace(/</g, "\\u003c"),
  };
  const on: Record<string, boolean> = {
    mark: !!v.images?.mark, build: !!v.build, lessons: !!v.lessons, parts: !!v.parts,
    signature: !!v.signature, sig_link: !!v.signature?.link, program: !!v.program,
  };
  let html = tpl.replace(/<!--if:(\w+)-->([\s\S]*?)<!--\/if:\1-->/g, (_m, k, body) => (on[k] ? body : ""));
  html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, k) => fields[k] ?? "");
  return html;
}

// ---- requests and floor clips ------------------------------------------------

export function ensureVendorSchema() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS vendor_requests(id INTEGER PRIMARY KEY, vendor_slug TEXT NOT NULL, kind TEXT, summary TEXT,
    name TEXT, contact TEXT, message TEXT, ip_hash TEXT, status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS vendor_media(id INTEGER PRIMARY KEY, vendor_slug TEXT NOT NULL, file TEXT NOT NULL, mime TEXT,
    bytes INTEGER, ad_consent INTEGER DEFAULT 0, status TEXT DEFAULT 'live', created_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS vendor_keys(vendor_slug TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const ipHash = (ip: string) => sha("roadie-vendor:" + ip).slice(0, 24);

/** The vendor's private key opens their capture page and their request inbox. Issued by scripts/vendor-key.mjs. */
export function vendorKeyOk(slug: string, key: string | null | undefined): boolean {
  if (!key || key.length < 20) return false;
  ensureVendorSchema();
  const row = one<any>("SELECT key_hash FROM vendor_keys WHERE vendor_slug=?", slug);
  if (!row) return false;
  const a = Buffer.from(row.key_hash), b = Buffer.from(sha(key));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function mediaDir(slug: string) {
  const d = path.join(ROOT, "data", "vendor_media", slug);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function recentRequestCount(ipH: string) {
  return Number(one<any>("SELECT COUNT(*) n FROM vendor_requests WHERE ip_hash=? AND created_at > datetime('now','-1 hour')", ipH)?.n || 0);
}

export { all, run, one };
