// USA — per-state notes. Laws differ a lot state to state. General info, not legal advice.
// ROADIE runs all-ages and alcohol-free: the gate is the city/county special-event
// permit for the ground, not a liquor licence.
export const US_REGIONS = [
  { code:"WA", name:"Washington", pro:"ASCAP / BMI", live:false, border:true,
    booking:"City/county special-event permit for outdoor gatherings; noise variance applied for separately.",
    permit:"Temporary food vendors permitted through the county health district.", body:"City / County Health" },
  { code:"OR", name:"Oregon", pro:"ASCAP / BMI", live:false, border:false,
    booking:"City special-event permit; county approval on rural ground.",
    permit:"Temporary restaurant licence required for food vendors.", body:"City / County Health" },
  { code:"CA", name:"California", pro:"ASCAP / BMI", live:false, border:false,
    booking:"City special-event permit; fire-marshal sign-off on tents and occupancy.",
    permit:"Temporary Food Facility (TFF) permit required per vendor.", body:"City / County Env. Health" },
  { code:"NY", name:"New York", pro:"ASCAP / BMI", live:false, border:true,
    booking:"Municipal special-event permit; NYC adds street-activity and sound permits.",
    permit:"Temporary food service permit per vendor.", body:"City / County Health" },
  { code:"OH", name:"Ohio", pro:"ASCAP / BMI", live:false, border:false,
    booking:"City/township special-event permit for outdoor assembly.",
    permit:"Temporary Food Service Operation licence per vendor.", body:"City / County Health" },
  { code:"MI", name:"Michigan", pro:"ASCAP / BMI", live:false, border:true,
    booking:"Municipal special-event permit; county approval on rural ground.",
    permit:"Temporary food establishment licence per vendor.", body:"City / County Health" },
];
