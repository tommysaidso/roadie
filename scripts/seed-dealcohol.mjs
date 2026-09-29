// One-time data migration: ROADIE is all-ages and alcohol-free, so alcohol rows
// seeded before that decision have to come out of existing databases too — the
// code changes alone only cover fresh installs.
//
// Sponsor rows are RETARGETED rather than deleted: a real rep may have already
// claimed the account, and deleting takes their ad_placements and ROI with it.
export function seedDealcohol(db) {
  const rename = {
    "Okanagan Spirits (Rep)": { name: "Okanagan Street Eats", kind: "food_vendor", contact: "book@okstreeteats.bc" },
    "Tree Brewing Co.":       { name: "Interior Outdoor Co.",  kind: "outfitter",   contact: "promo@interioroutdoor.bc" },
  };
  const upd = db.prepare("UPDATE sponsors SET name=?, kind=?, contact=? WHERE id=?");
  for (const s of db.prepare("SELECT id,name FROM sponsors WHERE kind='liquor_rep'").all()) {
    const r = rename[s.name];
    if (r) upd.run(r.name, r.kind, r.contact, s.id);
    else db.prepare("UPDATE sponsors SET kind='other' WHERE id=?").run(s.id);
  }

  // A green-room bar tab becomes a crew/band meal voucher of the same value.
  db.prepare(`UPDATE perks SET kind='meal_voucher',
    notes='Crew + band meals on show nights' WHERE kind='drink_tab'`).run();

  // Tasting funnel becomes the vendor-spot funnel.
  db.prepare(`UPDATE campaign_templates
    SET slug='vendor-spot', name='Vendor spot on the route', goal='vendor_spot',
        default_blocks='["brand_story","route_map","spot_sizes","prize_draw","coupon"]',
        notes='Vendor activation inside the ring: pick the arc, book the spot, run a prize draw at the gate.'
    WHERE slug='liquor-tasting' OR goal='tasting'`).run();
  db.prepare("UPDATE campaigns SET status='ended' WHERE status='live' AND title LIKE '%tasting%'").run();

  // Liquor/minors rule packs are replaced by the site-permit packs the ring needs.
  db.prepare("DELETE FROM region_rules WHERE topic IN ('liquor_event','minors')").run();

  try { db.prepare("UPDATE venues SET has_liquor=0").run(); } catch {}  // column may already be gone
}
