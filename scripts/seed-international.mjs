// Idempotent seed for the international/crossing layer. Safe to run repeatedly;
// only fills tables that are empty. Imported by init-db.mjs after the core seed.
export function seedInternational(db){
  // region_rules.country column (migration-safe)
  try { db.prepare("SELECT country FROM region_rules LIMIT 1").get(); }
  catch { db.exec("ALTER TABLE region_rules ADD COLUMN country TEXT DEFAULT 'CA'"); }
  db.prepare("UPDATE region_rules SET country='CA' WHERE country IS NULL").run();

  // territories
  if (db.prepare("SELECT COUNT(*) n FROM territories").get().n === 0) {
    const t = db.prepare("INSERT INTO territories(country,code,name,type,parent_country) VALUES(?,?,?,?,?)");
    const rows = [
      ["CA",null,"Canada","country",null],
      ["CA","BC","British Columbia","province","CA"],
      ["CA","AB","Alberta","province","CA"],
      ["CA","ON","Ontario","province","CA"],
      ["CA","QC","Quebec","province","CA"],
      ["US",null,"United States","country",null],
      ["US","WA","Washington","state","US"],
      ["US","OR","Oregon","state","US"],
      ["US","CA","California","state","US"],
      ["US","ID","Idaho","state","US"],
      ["US","MT","Montana","state","US"],
      ["US","NY","New York","state","US"],
      ["US","TX","Texas","state","US"],
      ["MX",null,"Mexico","country",null],
      ["MX","BCN","Baja California","state","MX"],
      ["MX","JAL","Jalisco","state","MX"],
      ["MX","CMX","Mexico City (CDMX)","state","MX"],
    ];
    rows.forEach(r=>t.run(...r));
  }

  // crossings — grounded, with official sources. Plain-language; not legal advice.
  if (db.prepare("SELECT COUNT(*) n FROM crossings").get().n === 0) {
    const c = db.prepare(`INSERT INTO crossings(from_country,to_country,category,title,summary,key_fact,official_url,source,updated_on)
      VALUES(@from,@to,@cat,@title,@summary,@key,@url,@src,@on)`);
    const R = [
      // CA -> US
      {from:"CA",to:"US",cat:"visa",title:"P-2 visa (reciprocal exchange via AFM/CFM)",
        summary:"Main route for Canadian musicians playing PAID US shows. Petition (Form I-129) routed through the AFM/Canadian Federation of Musicians reciprocal exchange. P-1 (internationally recognized) and O-1 (extraordinary ability) are alternatives. A tourist/ESTA (B-1/WT) does NOT permit paid performances.",
        key:"Valid up to 365 days · USCIS regular processing ~10.5 months — file early or use premium processing.",
        url:"https://www.uscis.gov/working-in-the-united-states/temporary-workers/p-2-individual-performer-or-part-of-a-group-entering-to-perform-under-a-reciprocal-exchange-program", src:"USCIS / AFM-CFM", on:"2026-06"},
      {from:"CA",to:"US",cat:"tax",title:"US foreign-artist withholding (30%)",
        summary:"US payers withhold tax on gross paid to foreign artists. You can lower it by entering a Central Withholding Agreement (CWA) with the IRS based on net income before the tour.",
        key:"Default 30% of gross · CWA can reduce it — apply ahead of the tour.",
        url:"https://www.irs.gov/individuals/international-taxpayers/withholding-tax-on-payments-to-foreign-artists-and-athletes", src:"IRS", on:"2026-06"},
      {from:"CA",to:"US",cat:"gear",title:"Gear: ATA Carnet",
        summary:"A 'passport for goods' — carry instruments/backline across the border duty- and tax-free, re-usable for a year. Strongly recommended for US runs to avoid hassles at the port.",
        key:"Valid 1 year · from ~$150 depending on gear value.",
        url:"https://www.cbp.gov/trade/programs-administration/entry-summary/ata-carnet-faqs", src:"US CBP", on:"2026-06"},
      {from:"CA",to:"US",cat:"port_entry",title:"Port of entry: US CBP",
        summary:"Carry your approved petition/visa, signed contracts, and full itinerary. The officer admits you; the approved P-2 is what authorizes the work.",
        key:"Bring: passport, P-2 approval, contracts, itinerary, carnet.",
        url:"https://www.cbp.gov/travel", src:"US CBP", on:"2026-06"},
      // US -> CA
      {from:"US",to:"CA",cat:"visa",title:"Work-permit EXEMPT under R186(g)",
        summary:"Foreign artists performing a time-limited engagement as guest artists are generally work-permit AND LMIA exempt — at ANY venue (bars/restaurants included since June 20, 2014). Essential crew are covered too (must travel with/ahead of the band). Exceptions: film/TV/radio production, ongoing (non-time-limited) work, or an employment relationship with a Canadian business.",
        key:"No work permit for a normal touring gig · still need a valid passport (eTA if applicable; US citizens exempt).",
        url:"https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/temporary-residents/foreign-workers/work-without-permit.html", src:"IRCC (R186)", on:"2026-06"},
      {from:"US",to:"CA",cat:"tax",title:"Canada Regulation 105 withholding (15%)",
        summary:"The Canadian payer must withhold 15% of fees paid to a non-resident for services in Canada (an extra 9% in Quebec). A waiver/reduction can be requested; CRA has a simplified process for non-resident artists.",
        key:"15% of fees (QC +9%) · request a waiver to reduce.",
        url:"https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/film-media-tax-credits/behind-scenes-personnel/waivers-withholding-tax/regulation-105/simplified-process-non-resident-regulation-105.html", src:"CRA (Reg 105)", on:"2026-06"},
      {from:"US",to:"CA",cat:"gear",title:"Gear: ATA Carnet",
        summary:"Same carnet system applies entering Canada — temporary, duty-free import of instruments and equipment, presented to CBSA at the border.",
        key:"Valid 1 year · present to CBSA on entry and exit.",
        url:"https://www.cbsa-asfc.gc.ca/import/carnet-eng.html", src:"CBSA", on:"2026-06"},
      {from:"US",to:"CA",cat:"port_entry",title:"Port of entry: CBSA",
        summary:"Declare the engagement and your gear. Carry contracts and itinerary; explain it's a time-limited performance to support the R186 exemption.",
        key:"Bring: passport, contracts, itinerary, carnet.",
        url:"https://www.cbsa-asfc.gc.ca/menu-eng.html", src:"CBSA", on:"2026-06"},
      // ANY -> MX
      {from:"ANY",to:"MX",cat:"visa",title:"Mexico: paid gigs need work authorization",
        summary:"You cannot be PAID to perform on a tourist (FMM) entry. Short tours use a Visitor Visa WITH work permission (up to 180 days) or a Temporary Resident Visa. A Mexican promoter/employer must start the process through INM — you can't self-apply.",
        key:"Up to 180 days (visitor w/ work) · 2026 temp-resident permit fee ~$4,341 MXN.",
        url:"https://www.gob.mx/inm", src:"INM (Mexico)", on:"2026-06"},
      {from:"ANY",to:"MX",cat:"gear",title:"Gear: ATA Carnet (Mexico)",
        summary:"Carnets work for Mexico but with stricter limits: goods may stay max 6 months with NO extension, and pre-registration is required before arrival.",
        key:"Max 6 months, no extension · pre-register before you arrive.",
        url:"https://www.atacarnet.com/import-mexico", src:"ATA Carnet", on:"2026-06"},
      {from:"ANY",to:"MX",cat:"port_entry",title:"Port of entry: INM",
        summary:"Enter on the correct visa for paid work (not FMM tourist). Carry the promoter's INM paperwork, contracts and itinerary.",
        key:"Bring: passport, work-authorized visa, promoter INM docs, carnet.",
        url:"https://www.gob.mx/inm", src:"INM (Mexico)", on:"2026-06"},
    ];
    R.forEach(x=>c.run(x));
  }

  // contacts — the green-card buddy
  if (db.prepare("SELECT COUNT(*) n FROM contacts").get().n === 0) {
    db.prepare(`INSERT INTO contacts(role,name,status,email,phone,website,countries,notes)
      VALUES(?,?,?,?,?,?,?,?)`).run(
      "immigration_help","Derwin Jordan","US Green Card holder",null,null,"https://greencardservices.ca/","CA,US,MX",
      "ROADIE's point of contact for cross-border visa & application help. Reach out before booking international dates.");
  }
}
