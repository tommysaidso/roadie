import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/guard";
import { upsertCrew, ensureCrewPoolSchema, DEPARTMENTS } from "@/lib/crewpool";
import { rulesFor, paperworkFor } from "@/lib/jurisdiction";

export const dynamic = "force-dynamic";

/**
 * Public crew signup — the people in the towns putting their hand up.
 *
 * Open by design. The whole point is that someone who ran monitors for a living
 * twenty years ago, and now lives three hours from a city, can register without
 * knowing anyone. New rows land as `pending` and an operator promotes them to
 * `active`, so open signup does not mean unvetted crew on a call sheet.
 */

// GET — what the form needs to render, and what paperwork a given
// country/region will require. Lets the form tell the truth up front.
export async function GET(req: NextRequest) {
  ensureCrewPoolSchema();
  const country = req.nextUrl.searchParams.get("country") || "CA";
  const region = req.nextUrl.searchParams.get("region") || "";
  const { rules, items } = paperworkFor(country, region);
  return NextResponse.json({
    departments: DEPARTMENTS,
    jurisdiction: {
      country: rules.country,
      currency: rules.currency,
      contractor_form: rules.contractorForm,
      year_end_slip: rules.yearEndSlip,
      workers_comp: rules.workersComp,
      paperwork: items,
      review: rules.review,
    },
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "crew_signup", 20);
  if (limited) return limited;

  let b: any = {};
  try { b = await req.json(); } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  const city = String(b.city || "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A working email is required." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!city) {
    return NextResponse.json(
      { error: "Your town is required — being local is the whole point." },
      { status: 400 });
  }

  const depts = (Array.isArray(b.departments) ? b.departments : [])
    .filter((d: string) => (DEPARTMENTS as readonly string[]).includes(d));
  if (!depts.length) {
    return NextResponse.json({ error: "Pick at least one department." }, { status: 400 });
  }

  // Never accept a tax identifier through this endpoint, even if a client sends
  // one. The system records THAT paperwork exists, never the number itself.
  for (const banned of ["sin", "ssn", "tin", "ein", "tax_id", "taxId", "social"]) {
    if (b[banned]) {
      return NextResponse.json({
        error: "Do not send tax or identity numbers here. Those are collected " +
               "by the production accountant on the proper form, never stored " +
               "in this directory.",
      }, { status: 400 });
    }
  }

  const country = String(b.country || "CA").toUpperCase();
  const region = String(b.region || (country === "CA" ? "BC" : "")).toUpperCase();

  try {
    const id = upsertCrew({
      email, name, city, country, region,
      phone: String(b.phone || ""),
      lat: b.lat ?? null, lng: b.lng ?? null,
      departments: depts.join(","),
      roles: String(b.roles || ""),
      skills: String(b.skills || ""),
      prior_credits: String(b.prior_credits || ""),
      years_exp: b.years_exp ? Number(b.years_exp) : null,
      career_stage: ["working", "semi_retired", "retired", "returning"]
        .includes(String(b.career_stage)) ? b.career_stage : "working",
      rate: b.rate ? Number(b.rate) : null,
      rate_unit: String(b.rate_unit || "day"),
      gear: String(b.gear || ""),
      vehicle: String(b.vehicle || ""),
      travel_range: ["local", "runout", "full_run"].includes(String(b.travel_range))
        ? b.travel_range : "local",
      can_travel_km: b.can_travel_km ? Number(b.can_travel_km) : null,
      tickets: String(b.tickets || ""),
      insured: b.insured ? 1 : 0,
      wcb: String(b.wcb || ""),
      availability: String(b.availability || ""),
      notes: String(b.notes || ""),
      source: "signup",
      referred_by: String(b.referred_by || ""),
    });

    const j = rulesFor(country, region);
    return NextResponse.json({
      ok: true,
      id,
      status: "pending",
      message:
        "You're in the pool. Someone from production reviews new registrations " +
        "before they go on a call sheet — you'll hear from us when a ring routes " +
        "near you.",
      paperwork_when_hired: paperworkFor(country, region).items,
      currency: j.currency,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Could not save that registration.", detail: String(e?.message || e) },
      { status: 500 });
  }
}
