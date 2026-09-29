// Per-province rule packs -> region_rules (the single runtime rules source).
// Adds country + city columns; seeds ON / AB / QC packs beside the BC originals.
// General info, not legal advice - each row cites its regulator.
export function seedRulepacks(db) {
  for (const col of ["country TEXT DEFAULT 'CA'", "city TEXT"]) {
    try { db.exec(`ALTER TABLE region_rules ADD COLUMN ${col}`); } catch {}
  }
  db.prepare("UPDATE region_rules SET country='CA' WHERE country IS NULL").run();
  // The Kelowna noise bylaw row is municipal, not provincial - tag it.
  try { db.prepare("UPDATE region_rules SET city='Kelowna' WHERE region='BC' AND topic='noise' AND city IS NULL").run(); } catch {}

  const has = db.prepare("SELECT COUNT(*) n FROM region_rules WHERE region=?");
  const ins = db.prepare("INSERT INTO region_rules(region,topic,rule,source,country,city) VALUES(?,?,?,?,'CA',NULL)");

  if (has.get("ON").n === 0) {
    ins.run("ON","site_permit","Outdoor events need a municipal special-event permit; road closures and noise exemptions are applied for separately.","Municipality");
    ins.run("ON","food_vendor","Temporary food vendors at an event require local public-health approval for the dates.","Public Health");
    ins.run("ON","tax","Ontario applies HST at 13% - performance fees from HST-registered artists add 13%, not GST 5%.","CRA/Ontario");
    ins.run("ON","noise","Noise bylaws are municipal - Toronto's amplified-sound limit is generally 11pm weekdays; always confirm with the venue's municipality.","Municipal bylaws");
  }
  if (has.get("AB").n === 0) {
    ins.run("AB","site_permit","Municipal special-event permit governs outdoor events; county approval where the ground is rural.","Municipality");
    ins.run("AB","food_vendor","Temporary food vendors require Alberta Health Services approval for the event dates.","AHS");
    ins.run("AB","tax","Alberta has no PST - GST 5% only on performance fees where the artist is GST-registered.","CRA");
    ins.run("AB","noise","Noise bylaws are municipal - Calgary/Edmonton amplified sound generally winds down 10-11pm; confirm per venue.","Municipal bylaws");
  }
  if (has.get("QC").n === 0) {
    ins.run("QC","site_permit","Municipal public-assembly permit required for outdoor events.","Municipalite");
    ins.run("QC","food_vendor","Temporary food service at an event requires a MAPAQ permit.","MAPAQ");
    ins.run("QC","tax","Quebec applies GST 5% + QST 9.975%. Non-resident performers also face Reg 105 withholding (15% federal + 9% Quebec) unless waived.","CRA/Revenu Quebec");
    ins.run("QC","language","Bill 96: contracts and public signage in Quebec have French-language obligations - offer a French contract rendering for QC bookings.","OQLF");
    ins.run("QC","noise","Noise rules are municipal (arrondissement level in Montreal) - confirm curfew with the venue.","Municipal bylaws");
  }
}
