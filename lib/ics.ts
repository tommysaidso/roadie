import { getDb, all, one, run } from "./db";

// Venue calendar ingest — a venue signs up and either PASTES/UPLOADS an .ics
// dump or saves a calendar URL (webcal://, Google Calendar share link, or a
// plain .ics link). We identify the flavor, normalize to a fetchable ICS URL,
// parse VEVENTs (no deps), and land them in venue_slots with source='ics'.
//
// Heuristic: an event whose summary looks like an OPEN night ("open", "avail",
// "tbd", "book me/us") becomes an open slot; everything else is a booked date
// so matching knows the room is taken.

export function ensureVenueCalendarSchema() {
  const db = getDb();
  for (const col of [
    "member_status TEXT DEFAULT 'member'",   // member | sample (temp/unclaimed listing)
    "calendar_url TEXT",
    "calendar_kind TEXT",                    // ics | webcal | google | unknown
    "calendar_last_sync TEXT",
    "calendar_last_result TEXT",
  ]) {
    try { db.exec(`ALTER TABLE venues ADD COLUMN ${col}`); } catch {}
  }
  try { db.exec(`ALTER TABLE venue_slots ADD COLUMN ics_uid TEXT`); } catch {}
  // Business verification — a claim is a legal statement of who runs the room.
  for (const t of ["venues", "bands", "sponsors"]) {
    for (const col of ["legal_owner TEXT", "business_license TEXT",
      "verification_status TEXT DEFAULT 'unverified'",  // unverified | pending | verified
      "verified_at TEXT"]) {
      try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${col}`); } catch {}
    }
  }
  // Backfill: a venue nobody has claimed is an example listing, and shows as such.
  try { db.exec(`UPDATE venues SET member_status='sample' WHERE user_id IS NULL AND (member_status IS NULL OR member_status='member')`); } catch {}
}

// ── URL identification ───────────────────────────────────────────────────────
export function identifyCalendarUrl(raw: string): { kind: string; fetchUrl: string | null; note: string } {
  const s = String(raw || "").trim();
  if (!s) return { kind: "unknown", fetchUrl: null, note: "empty" };
  let u = s;
  if (/^webcal:\/\//i.test(u)) {
    u = u.replace(/^webcal:\/\//i, "https://");
    return { kind: "webcal", fetchUrl: u, note: "webcal → https" };
  }
  // Google Calendar embed/share → public ICS
  const gid = u.match(/calendar\/embed\?.*?src=([^&]+)/i) || u.match(/calendar\/u\/\d+\/embed\?.*?src=([^&]+)/i);
  if (gid) {
    const cal = decodeURIComponent(gid[1]);
    return { kind: "google", fetchUrl: `https://calendar.google.com/calendar/ical/${encodeURIComponent(cal)}/public/basic.ics`, note: "google embed → public ics" };
  }
  if (/calendar\.google\.com\/calendar\/ical\/.+\.ics/i.test(u)) return { kind: "google", fetchUrl: u, note: "google ics" };
  if (/^https?:\/\/.+\.ics(\?.*)?$/i.test(u)) return { kind: "ics", fetchUrl: u, note: "direct ics" };
  if (/^https?:\/\//i.test(u)) return { kind: "unknown", fetchUrl: u, note: "will try as ics" };
  return { kind: "unknown", fetchUrl: null, note: "not a url" };
}

// ── Minimal ICS parser (VEVENT: UID, SUMMARY, DTSTART, DESCRIPTION) ─────────
export type IcsEvent = { uid: string; summary: string; date: string; description: string };

export function parseIcs(text: string): IcsEvent[] {
  // unfold continuation lines (RFC 5545: lines starting with space/tab)
  const lines = String(text || "").replace(/\r\n[ \t]/g, "").replace(/\r/g, "").split("\n");
  const events: IcsEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur && cur.DTSTART) {
        const m = cur.DTSTART.match(/(\d{4})(\d{2})(\d{2})/);
        if (m) events.push({
          uid: cur.UID || `${cur.DTSTART}-${(cur.SUMMARY || "").slice(0, 24)}`,
          summary: cur.SUMMARY || "",
          date: `${m[1]}-${m[2]}-${m[3]}`,
          description: (cur.DESCRIPTION || "").slice(0, 500),
        });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const kv = line.match(/^([A-Z-]+)(;[^:]*)?:(.*)$/i);
    if (kv) cur[kv[1].toUpperCase()] = kv[3].replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
  }
  return events;
}

const OPEN_RX = /\bopen\b|\bavail/i;

// ── Sync events into venue_slots ─────────────────────────────────────────────
export function syncEventsToSlots(venueId: number, events: IcsEvent[]) {
  ensureVenueCalendarSchema();
  const today = new Date().toISOString().slice(0, 10);
  let added = 0, updated = 0, skipped = 0;
  for (const ev of events) {
    if (ev.date < today) { skipped++; continue; }            // past dates: ignore
    const status = OPEN_RX.test(ev.summary) ? "open" : "booked";
    const notes = [ev.summary, ev.description].filter(Boolean).join(" — ").slice(0, 300);
    const existing: any = one(
      "SELECT id, source FROM venue_slots WHERE venue_id=? AND (ics_uid=? OR (date=? AND source='ics'))",
      venueId, ev.uid, ev.date);
    if (existing) {
      run("UPDATE venue_slots SET date=?, status=?, notes=?, ics_uid=? WHERE id=?", ev.date, status, notes, ev.uid, existing.id);
      updated++;
    } else {
      // never clobber manually-entered slots on the same date — add alongside
      run("INSERT INTO venue_slots(venue_id,date,status,notes,source,ics_uid) VALUES(?,?,?,?,?,?)",
        venueId, ev.date, status, notes, "ics", ev.uid);
      added++;
    }
  }
  return { added, updated, skipped, total: events.length };
}

export async function fetchAndSync(venueId: number, url: string) {
  const id = identifyCalendarUrl(url);
  if (!id.fetchUrl) throw new Error("Could not identify that calendar URL. Paste a webcal://, Google Calendar share link, or a direct .ics link.");
  const res = await fetch(id.fetchUrl, { headers: { "user-agent": "roadie-calendar-sync/1.0" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Calendar fetch failed (${res.status}). Is the calendar public?`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That URL did not return an ICS calendar. Make sure it is the public .ics address.");
  const events = parseIcs(text);
  const result = syncEventsToSlots(venueId, events);
  run("UPDATE venues SET calendar_url=?, calendar_kind=?, calendar_last_sync=datetime('now'), calendar_last_result=? WHERE id=?",
    url, id.kind, JSON.stringify(result), venueId);
  return { kind: id.kind, ...result };
}
