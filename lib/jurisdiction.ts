/**
 * JURISDICTION RULES — what changes when the ring crosses the border.
 *
 * Canada and the USA are not the same engagement. The contract wording, the tax
 * paperwork, the workers-comp regime and the permits are all different, and a
 * single "contractor agreement" that assumes Canada will be wrong the moment a
 * ring routes through Washington or Montana.
 *
 * TWO THINGS THIS FILE IS DELIBERATE ABOUT:
 *
 * 1. W-9 vs I-9 are NOT interchangeable, and the difference is not cosmetic.
 *    - W-9  -> INDEPENDENT CONTRACTOR. They give you their TIN, you issue a
 *              1099-NEC at year end. This is the ring model.
 *    - I-9  -> EMPLOYEE. Employment-eligibility verification, required only
 *              when someone is actually an employee, with document inspection
 *              and retention duties attached.
 *    Collecting an I-9 from a contractor is evidence you treated them as an
 *    employee, which is the exact thing a misclassification audit looks for.
 *    So: contractors get W-9, and I-9 is flagged here as employee-only.
 *
 * 2. NO TAX IDENTIFIERS ARE EVER STORED. Not SIN, not SSN, not TIN, not EIN.
 *    The system records only THAT a form is on file and WHEN it arrived. The
 *    document itself belongs in whatever the accountant uses. A touring
 *    database is not the place to hold identity numbers for hundreds of people,
 *    and a breach of that is unrecoverable.
 *
 * OPERATING MODEL: rings do not cross the border. A US ring is crewed, billed
 * and paid in the US; a Canadian ring in Canada. Bands are not moved across
 * for dates, so artist visa classes (O/P petitions) simply do not arise —
 * the problem is designed out rather than managed.
 *
 * Everyone engaged is FILM PRODUCTION CREW on a work-for-hire basis. The ring
 * is a documentary shoot; that is the frame the whole thing sits in, and it is
 * the structure the film industry already runs on.
 *
 * NOT LEGAL ADVICE. Anything flagged `review` needs a person, not a lookup
 * table.
 */

export type Country = "CA" | "US";

export interface JurisdictionRules {
  country: Country;
  region: string;
  /** Contractor tax form collected FROM the worker. */
  contractorForm: "W-8BEN" | "W-9" | "TD1" | "none";
  /** Year-end slip issued TO the worker. */
  yearEndSlip: "T4A" | "1099-NEC" | "none";
  /** Threshold below which no slip is required (in local currency). */
  slipThreshold: number;
  currency: "CAD" | "USD";
  /** Workers' compensation scheme that applies to the work. */
  workersComp: string;
  /** Sales tax the CONTRACTOR may need to charge back to production. */
  salesTaxNote: string;
  /** Things that genuinely need a human to check for this jurisdiction. */
  review: string[];
  permits: string[];
}

const CA_BASE = {
  country: "CA" as const,
  contractorForm: "none" as const,   // no equivalent of W-9; SIN collected by payroll only
  yearEndSlip: "T4A" as const,
  slipThreshold: 500,
  currency: "CAD" as const,
  salesTaxNote:
    "A contractor billing over $30k/yr must register for and charge GST/HST. " +
    "Under that they may bill without it. Expect invoices both ways.",
};

const US_BASE = {
  country: "US" as const,
  contractorForm: "W-9" as const,
  yearEndSlip: "1099-NEC" as const,
  slipThreshold: 600,               // IRS 1099-NEC threshold
  currency: "USD" as const,
  salesTaxNote:
    "Services are generally not sales-taxed, but equipment rental often is and " +
    "it varies by state. Check before treating a backline invoice as tax-free.",
};

const RULES: Record<string, JurisdictionRules> = {
  "CA:BC": {
    ...CA_BASE, region: "BC",
    workersComp: "WorkSafeBC — coverage required; verify the contractor's own " +
                 "account number or cover them under production.",
    permits: [
      "Municipal special-event permit per stop",
      "Liquor licence (SEP) if serving — production is dry-preferred",
      "Highway/road-use permit for oversize transport",
      "Fire-safety plan and occupancy sign-off for the container stage",
    ],
    review: [],
  },
  "CA:AB": {
    ...CA_BASE, region: "AB",
    workersComp: "WCB-Alberta — coverage required.",
    permits: [
      "Municipal special-event permit per stop",
      "AGLC licence if serving",
      "Oversize load permit (Alberta Transportation)",
      "Fire-safety plan and occupancy sign-off",
    ],
    review: [],
  },
  "US:*": {
    ...US_BASE, region: "*",
    workersComp:
      "State-administered and MANDATORY in nearly every state — it does not " +
      "travel with you from Canada. Production needs a policy covering the " +
      "states on the route, or each contractor must carry their own.",
    permits: [
      "State/municipal special-event permit per stop",
      "State liquor authority licence if serving",
      "USDOT / oversize-load permits per state for transport",
      "Fire marshal sign-off for temporary structures",
      "Possible business registration as a foreign entity in the state",
    ],
    review: [
      // The operating model, stated so nobody re-derives it wrongly:
      // rings do not cross the border. A US ring is crewed and billed in the
      // US; a Canadian ring in Canada. That removes the visa problem for bands
      // entirely rather than managing it.
      "WORKER CLASSIFICATION. Engagements here are FILM PRODUCTION CREW on a " +
      "work-for-hire basis — the ring is a documentary shoot, which is the " +
      "framework the industry already runs on. Note the distinction that " +
      "actually matters: work-for-hire settles COPYRIGHT in the footage " +
      "(17 U.S.C. 101); it does not by itself settle employee-vs-contractor " +
      "status for tax and labour. Productions commonly run crew through a " +
      "payroll service for exactly that reason. Worth confirming per state.",
      "STATE WITHHOLDING. Some states require withholding on payments to " +
      "non-resident performers.",
      "FOREIGN-ENTITY PAYER STATUS. A Canadian company paying US contractors " +
      "may have its own IRS reporting obligations.",
    ],
  },
};

export function rulesFor(country: string, region?: string): JurisdictionRules {
  const c = String(country || "CA").toUpperCase();
  const r = String(region || "").toUpperCase();
  return RULES[`${c}:${r}`] || RULES[`${c}:*`] || RULES["CA:BC"];
}

/**
 * What paperwork this person owes before they can be paid.
 * Returns human sentences, not codes — this is read by an operator, not a machine.
 */
export function paperworkFor(country: string, region?: string) {
  const j = rulesFor(country, region);
  const items: string[] = [];

  if (j.contractorForm !== "none") {
    items.push(
      `${j.contractorForm} on file before first payment (record that it is on ` +
      `file — never store the tax number itself).`);
  }
  items.push(
    `${j.yearEndSlip} issued at year end once total payments pass ` +
    `${j.slipThreshold} ${j.currency}.`);
  items.push(`Workers' comp: ${j.workersComp}`);

  if (j.country === "US") {
    items.push(
      "I-9 is NOT collected — that form is for employees. Collecting one from " +
      "a contractor undermines their contractor status.");
  }
  return { rules: j, items };
}

/** Contract clauses that must swap out per country. */
export function contractDeltas(country: string) {
  if (String(country).toUpperCase() === "US") {
    return {
      slipClause:
        "UARX will issue a Form 1099-NEC at year end for total payments of " +
        "$600 USD or more. The contractor supplies a completed Form W-9 before " +
        "first payment and is responsible for their own federal, state and " +
        "self-employment taxes.",
      compClause:
        "Workers' compensation is state-administered. The contractor either " +
        "carries their own coverage and provides a certificate, or is covered " +
        "under production's policy for the states on the route.",
      currency: "USD",
      flag:
        "US engagement — classification, work authorisation and state " +
        "withholding all need review before this is sent.",
    };
  }
  return {
    slipClause:
      "UARX will issue a T4A slip (Canada) at year end. The contractor is " +
      "responsible for their own tax obligations as an independent contractor.",
    compClause:
      "Provincial workers' compensation coverage (e.g. WorkSafeBC) applies. " +
      "The contractor provides their account number or is covered under " +
      "production.",
    currency: "CAD",
    flag: "",
  };
}
