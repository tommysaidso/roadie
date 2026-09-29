import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import {
  ensureCrewPoolSchema, crewNearStop, coverageForStop,
  payReadiness, inviteCrew, DEPARTMENTS,
} from "@/lib/crewpool";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Operator search over the crew pool.
 *
 * Two modes:
 *   ?stop_id=…  — who can work this stop, nearest first, with the coverage gaps
 *   ?q=… &dept= — plain directory search across the whole pool
 *
 * Local is always ranked first. The point of the pool is hiring in the town the
 * ring is in, not importing a crew and calling it local.
 */
export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Operator only.");

  ensureCrewPoolSchema();
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const stopId = Number(sp.get("stop_id") || 0);
  const dept = sp.get("dept") || undefined;

  if (stopId) {
    const stop = db.prepare(
      `SELECT id, city, region, country, date FROM stops WHERE id=?`
    ).get(stopId) as any;
    const people = crewNearStop(stopId, dept);
    const cov = coverageForStop(stopId);

    // Cross-border and paperwork blockers matter before the call, not on
    // settlement night — so readiness is resolved here rather than per click.
    const withReadiness = people.slice(0, 60).map((p: any) => ({
      ...p,
      readiness: stop ? payReadiness(p.id, stop.country || "CA", stop.region) : null,
    }));

    return NextResponse.json({
      mode: "stop", stop, departments: DEPARTMENTS,
      people: withReadiness,
      coverage: cov.byDept,
      gaps: cov.gaps,
      counts: {
        total: people.length,
        local: people.filter((p: any) => p.band === "local").length,
        runout: people.filter((p: any) => p.band === "runout").length,
        blocked: withReadiness.filter((p: any) => p.readiness && !p.readiness.payable).length,
      },
    });
  }

  // Directory search
  const q = String(sp.get("q") || "").trim().toLowerCase();
  const status = sp.get("status") || "";
  let rows = db.prepare(`SELECT * FROM crew_pool ORDER BY created_at DESC LIMIT 500`).all() as any[];
  if (status) rows = rows.filter(r => r.status === status);
  if (dept) rows = rows.filter(r =>
    String(r.departments || "").split(",").map(s => s.trim()).includes(dept));
  if (q) {
    rows = rows.filter(r =>
      [r.name, r.city, r.region, r.roles, r.skills, r.prior_credits, r.gear]
        .join(" ").toLowerCase().includes(q));
  }
  return NextResponse.json({
    mode: "directory", departments: DEPARTMENTS, people: rows,
    counts: {
      total: rows.length,
      pending: rows.filter(r => r.status === "pending").length,
      active: rows.filter(r => r.status === "active").length,
    },
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("Operator only.");

  let b: any = {};
  try { b = await req.json(); } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  ensureCrewPoolSchema();
  const db = getDb();

  try {
    switch (String(b.action)) {
      case "status": {
        // Open signup means new rows arrive unvetted. Promoting to `active` is
        // the human step that puts someone on a call sheet.
        const s = String(b.status);
        if (!["pending", "active", "paused", "declined"].includes(s)) {
          return NextResponse.json({ error: "bad status" }, { status: 400 });
        }
        db.prepare(`UPDATE crew_pool SET status=?, updated_at=datetime('now') WHERE id=?`)
          .run(s, Number(b.id));
        return NextResponse.json({ ok: true });
      }
      case "paperwork": {
        // Records only THAT the form is on file. Never the number.
        db.prepare(
          `UPDATE crew_pool
              SET tax_form=?, tax_form_on_file=?, tax_form_at=datetime('now'),
                  work_auth_ok=?, work_auth_note=?, updated_at=datetime('now')
            WHERE id=?`
        ).run(String(b.tax_form || ""), b.tax_form_on_file ? 1 : 0,
              b.work_auth_ok ? 1 : 0, String(b.work_auth_note || ""), Number(b.id));
        return NextResponse.json({ ok: true });
      }
      case "invite":
        inviteCrew({
          crewId: Number(b.id), stopId: Number(b.stop_id),
          routeId: b.route_id ? Number(b.route_id) : undefined,
          department: String(b.department || ""), role: String(b.role || ""),
          rate: b.rate ? Number(b.rate) : undefined,
        });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
