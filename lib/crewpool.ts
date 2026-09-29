/**
 * CREW POOL — the people in the towns.
 *
 * The premise: the ring routes through small towns, and in those towns there
 * are people who did this for a living. A front-of-house engineer who moved
 * home. An editor who left the city. A retired production accountant, a tour
 * accommodation liaison, a lighting tech who still has the chops. They are
 * invisible to the industry because they are not in Vancouver or Toronto — and
 * when the ring comes through, that is their shot to work again.
 *
 * This is the SUPPLY side. `local_crew` (lib/ring.ts) is the demand side: the
 * operator saying "this stop needs 2 loaders and a runner." This table is the
 * people saying "I am here, this is what I can do, and I want the call."
 *
 * Design notes that matter:
 *
 *  - GEOGRAPHY FIRST. Matching is by distance to a stop, using the hub's own
 *    `local_km` / `runout_km` (60 / 260 by default) rather than a made-up
 *    radius. "Local" already means something specific per region in this
 *    codebase and this reuses it.
 *
 *  - CREDITS ARE THE POINT. `prior_credits` is not decoration. Someone who ran
 *    monitors on real tours twenty years ago is not a hobbyist, and the whole
 *    value of this pool is that their history travels with them out of the
 *    city. The directory has to carry it or it is just a list of names.
 *
 *  - RETIRED IS A FIRST-CLASS STATE. `career_stage` distinguishes working /
 *    semi-retired / retired / returning. Someone coming back for one more run
 *    is a different conversation than someone touring full time, and the
 *    operator should see which they are before they call.
 *
 *  - `departments` matches event_crew.department so the pool and the ring
 *    staffing sheet speak the same vocabulary.
 */
import { getDb } from "./db";
import { paperworkFor } from "./jurisdiction";

export const DEPARTMENTS = [
  "audio", "lighting", "video", "stage", "backline", "rigging", "power",
  "transport", "accommodation", "catering", "medical", "security",
  "box_office", "merch", "production", "camera", "editorial", "photo",
  "marketing", "hospitality", "site", "sanitation",
] as const;

export type CareerStage = "working" | "semi_retired" | "retired" | "returning";
export type TravelRange = "local" | "runout" | "full_run";

let ready = false;

export function ensureCrewPoolSchema() {
  if (ready) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS crew_pool (
      id            INTEGER PRIMARY KEY,
      user_id       INTEGER,                    -- null until they claim an account
      email         TEXT NOT NULL,
      name          TEXT NOT NULL,
      phone         TEXT DEFAULT '',

      -- where they actually are. This is the whole point.
      city          TEXT NOT NULL,
      region        TEXT DEFAULT 'BC',
      country       TEXT DEFAULT 'CA',
      lat           REAL,
      lng           REAL,
      hub_id        INTEGER,

      departments   TEXT DEFAULT '',   -- csv from DEPARTMENTS
      roles         TEXT DEFAULT '',   -- free text: "FOH", "monitor eng", "gaffer"
      skills        TEXT DEFAULT '',

      -- their history. carried out of the city with them.
      prior_credits TEXT DEFAULT '',   -- tours, venues, labels, productions
      years_exp     INTEGER,
      career_stage  TEXT DEFAULT 'working', -- working|semi_retired|retired|returning

      rate          INTEGER,
      rate_unit     TEXT DEFAULT 'day',
      negotiable    INTEGER DEFAULT 1,

      gear          TEXT DEFAULT '',   -- what they bring
      vehicle       TEXT DEFAULT '',
      travel_range  TEXT DEFAULT 'local', -- local|runout|full_run
      can_travel_km INTEGER,           -- overrides the hub default when set

      tickets       TEXT DEFAULT '',   -- certs: fall arrest, forklift, first aid
      insured       INTEGER DEFAULT 0,
      wcb           TEXT DEFAULT '',   -- WorkSafeBC / provincial / state comp account

      -- Payment paperwork. NOTE WHAT IS ABSENT: no SIN, no SSN, no TIN, no EIN.
      -- Only that a form is on file and when. The document itself lives with
      -- the accountant. A touring database holding identity numbers for
      -- hundreds of people is a breach waiting to be unrecoverable.
      tax_form         TEXT DEFAULT '',  -- W-9 (US) | none (CA); see lib/jurisdiction.ts
      tax_form_on_file INTEGER DEFAULT 0,
      tax_form_at      TEXT,
      work_auth_ok     INTEGER DEFAULT 0, -- cross-border: cleared to work paid dates
      work_auth_note   TEXT DEFAULT '',

      availability  TEXT DEFAULT '',   -- free text: "weekends", "summer only"
      notes         TEXT DEFAULT '',

      status        TEXT DEFAULT 'pending', -- pending|active|paused|declined
      source        TEXT DEFAULT 'signup',  -- signup|operator|referral
      referred_by   TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(email)
    );
    CREATE INDEX IF NOT EXISTS idx_crew_pool_geo    ON crew_pool(region, city);
    CREATE INDEX IF NOT EXISTS idx_crew_pool_hub    ON crew_pool(hub_id, status);
    CREATE INDEX IF NOT EXISTS idx_crew_pool_status ON crew_pool(status);

    -- Operator reaching out about a specific stop. Kept separate from the
    -- profile so a person's standing in the pool is never overwritten by the
    -- outcome of one call.
    CREATE TABLE IF NOT EXISTS crew_pool_calls (
      id           INTEGER PRIMARY KEY,
      crew_id      INTEGER REFERENCES crew_pool(id),
      stop_id      INTEGER REFERENCES stops(id),
      route_id     INTEGER REFERENCES routes(id),
      department   TEXT DEFAULT '',
      role         TEXT DEFAULT '',
      status       TEXT DEFAULT 'invited', -- invited|accepted|declined|confirmed|worked|no_show
      rate         INTEGER,
      invited_at   TEXT DEFAULT (datetime('now')),
      responded_at TEXT,
      notes        TEXT DEFAULT '',
      UNIQUE(crew_id, stop_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_crew_calls_stop ON crew_pool_calls(stop_id, status);
  `);

  ready = true;
}

/** Self-signup or operator entry. Same table either way. */
export function upsertCrew(p: Record<string, any>) {
  ensureCrewPoolSchema();
  const db = getDb();
  const cols = [
    "email","name","phone","city","region","country","lat","lng","hub_id",
    "departments","roles","skills","prior_credits","years_exp","career_stage",
    "rate","rate_unit","negotiable","gear","vehicle","travel_range","can_travel_km",
    "tickets","insured","wcb","availability","notes","source","referred_by",
    "tax_form","tax_form_on_file","tax_form_at","work_auth_ok","work_auth_note",
  ];
  const existing = db.prepare(`SELECT id FROM crew_pool WHERE lower(email)=lower(?)`)
                     .get(p.email) as any;
  if (existing) {
    const sets = cols.filter(c => p[c] !== undefined).map(c => `${c}=@${c}`).join(", ");
    if (sets) {
      db.prepare(`UPDATE crew_pool SET ${sets}, updated_at=datetime('now') WHERE id=${existing.id}`)
        .run(Object.fromEntries(cols.map(c => [c, p[c] ?? null])));
    }
    return existing.id as number;
  }
  const info = db.prepare(
    `INSERT INTO crew_pool (${cols.join(",")}) VALUES (${cols.map(c => "@" + c).join(",")})`
  ).run(Object.fromEntries(cols.map(c => [c, p[c] ?? null])));
  return Number(info.lastInsertRowid);
}

/** Great-circle km. Good enough for "who is near this town". */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Who can work this stop.
 *
 * Distance is measured against the hub's own definition of local, so a crew
 * member is "local" in the Fraser hub at a different radius than in Chinook if
 * those hubs are configured differently. Someone whose own `can_travel_km` is
 * set overrides the hub default — they know their own willingness better.
 *
 * People without coordinates are not silently dropped: they fall back to an
 * exact city/region match, because a missing lat/lng is a data gap, not a
 * statement that they are far away.
 */
export function crewNearStop(stopId: number, department?: string) {
  ensureCrewPoolSchema();
  const db = getDb();

  const stop = db.prepare(
    `SELECT s.*, h.local_km, h.runout_km
       FROM stops s LEFT JOIN hubs h ON h.id = s.hub_id
      WHERE s.id = ?`
  ).get(stopId) as any;
  if (!stop) return [];

  const localKm  = stop.local_km  ?? 60;
  const runoutKm = stop.runout_km ?? 260;

  let rows = db.prepare(
    `SELECT * FROM crew_pool WHERE status='active'`
  ).all() as any[];

  if (department) {
    rows = rows.filter(r => String(r.departments || "")
      .split(",").map((d: string) => d.trim()).includes(department));
  }

  const out: any[] = [];
  for (const r of rows) {
    let km: number | null = null;
    if (stop.lat != null && stop.lng != null && r.lat != null && r.lng != null) {
      km = haversineKm(stop.lat, stop.lng, r.lat, r.lng);
    }

    const willing = r.can_travel_km
      ?? (r.travel_range === "full_run" ? 100000
        : r.travel_range === "runout"   ? runoutKm
        : localKm);

    let band: "local" | "runout" | "far" | "unknown";
    if (km == null) {
      // no coords — fall back to naming the same town
      const sameCity = String(r.city || "").toLowerCase() === String(stop.city || "").toLowerCase();
      if (!sameCity && String(r.region || "") !== String(stop.region || "")) continue;
      band = sameCity ? "local" : "unknown";
    } else {
      if (km > willing) continue;          // further than they said they'd go
      band = km <= localKm ? "local" : km <= runoutKm ? "runout" : "far";
    }

    out.push({ ...r, distance_km: km == null ? null : Math.round(km), band });
  }

  // Local first — the whole point is hiring in the town, not importing.
  const order = { local: 0, unknown: 1, runout: 2, far: 3 } as Record<string, number>;
  out.sort((a, b) =>
    (order[a.band] - order[b.band]) ||
    ((a.distance_km ?? 9999) - (b.distance_km ?? 9999)));
  return out;
}

/** Coverage check: which departments this stop can and cannot staff locally. */
export function coverageForStop(stopId: number) {
  const all = crewNearStop(stopId);
  const byDept: Record<string, { local: number; runout: number }> = {};
  for (const d of DEPARTMENTS) byDept[d] = { local: 0, runout: 0 };
  for (const p of all) {
    for (const d of String(p.departments || "").split(",").map(s => s.trim())) {
      if (!byDept[d]) continue;
      if (p.band === "local" || p.band === "unknown") byDept[d].local++;
      else byDept[d].runout++;
    }
  }
  const gaps = Object.entries(byDept)
    .filter(([, v]) => v.local === 0 && v.runout === 0)
    .map(([d]) => d);
  return { byDept, gaps, total: all.length };
}

/**
 * Can this person actually be paid for work in this jurisdiction?
 *
 * Separate from "are they good at the job". An operator staffing a US stop with
 * a Canadian crew member needs to see the work-authorisation problem BEFORE the
 * call, not on settlement night.
 */
export function payReadiness(crewId: number, country: string, region?: string) {
  ensureCrewPoolSchema();
  const p = getDb().prepare(`SELECT * FROM crew_pool WHERE id=?`).get(crewId) as any;
  if (!p) return null;

  const { rules, items } = paperworkFor(country, region);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (rules.contractorForm !== "none" && !p.tax_form_on_file) {
    blockers.push(`${rules.contractorForm} not on file — cannot pay until it is.`);
  }
  // Rings do not cross the border — a US ring is crewed in the US, a Canadian
  // ring in Canada. So this is not the usual "does this person have a visa"
  // problem; it is a flag that someone has been matched to a ring on the wrong
  // side of the line, which is a routing mistake, not a paperwork one.
  const crossBorder = String(p.country || "CA").toUpperCase() !== rules.country;
  if (crossBorder && !p.work_auth_ok) {
    warnings.push(
      `Based in ${p.country || "CA"} but matched to a ${rules.country} date. ` +
      `Rings are crewed on their own side of the border — check the routing ` +
      `before booking, or confirm this person is authorised to work there.`);
  }
  if (!p.wcb) {
    warnings.push(`No workers' comp account recorded. ${rules.workersComp}`);
  }
  if (!p.insured) warnings.push("No liability insurance recorded.");
  for (const r of rules.review) warnings.push(r);

  return {
    crew: { id: p.id, name: p.name, country: p.country, region: p.region },
    jurisdiction: `${rules.country}${rules.region === "*" ? "" : ":" + rules.region}`,
    currency: rules.currency,
    paperwork: items,
    blockers,
    warnings,
    payable: blockers.length === 0,
  };
}

export function inviteCrew(a: {
  crewId: number; stopId: number; routeId?: number;
  department?: string; role?: string; rate?: number;
}) {
  ensureCrewPoolSchema();
  getDb().prepare(
    `INSERT OR IGNORE INTO crew_pool_calls
       (crew_id, stop_id, route_id, department, role, rate)
     VALUES (?,?,?,?,?,?)`
  ).run(a.crewId, a.stopId, a.routeId ?? null, a.department || "", a.role || "", a.rate ?? null);
}

export function respondToCall(callId: number, status: string, notes = "") {
  ensureCrewPoolSchema();
  getDb().prepare(
    `UPDATE crew_pool_calls
        SET status=?, responded_at=datetime('now'), notes=?
      WHERE id=?`
  ).run(status, notes, callId);
}
