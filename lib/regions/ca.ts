// Canada — per-province site-permit / PRO notes. General info, not legal advice.
// ROADIE runs all-ages and alcohol-free, so the gate is the municipal
// special-event permit for the ground, not a liquor licence.
export const CA_REGIONS = [
  { code:"BC", name:"British Columbia", pro:"SOCAN", live:true,
    booking:"Outdoor ticketed events on park or recreation ground need a municipal special-event / temporary-assembly permit. Apply 30-60 days out; large gatherings may need a traffic and safety plan.",
    permit:"Temporary food vendors notify the regional health authority. Amplified-sound curfew per municipal bylaw.", body:"City / Interior Health" },
  { code:"AB", name:"Alberta", pro:"SOCAN", live:false,
    booking:"Municipal special-event permit governs outdoor events; county approval where the ground is rural.",
    permit:"Temporary food vendors require Alberta Health Services approval.", body:"Municipality / AHS" },
  { code:"ON", name:"Ontario", pro:"SOCAN", live:false,
    booking:"Municipal special-event permit; road-closure and noise exemptions applied for separately.",
    permit:"Temporary food vendors require local public-health approval.", body:"Municipality / Public Health" },
  { code:"QC", name:"Quebec", pro:"SOCAN", live:false,
    booking:"Municipal public-assembly permit for events. Note Reg 105 +9% QC withholding for non-residents.",
    permit:"Temporary food service requires a MAPAQ permit.", body:"Municipalité / MAPAQ" },
];
