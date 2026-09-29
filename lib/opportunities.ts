// Opportunity tracker — finds fillable gaps in the booking grid and raises alerts.
// "Available places in the grid that can be filled for bands."
import { all } from "./db";
import { rankBandsForSlot, rankSlotsForBand } from "./match";

// Real clock - a frozen TODAY made urgency drift one day per day after launch.
const daysUntil = (d:string)=> Math.round((new Date(d).getTime()-Date.now())/86400000);

export interface GridGap {
  slot:any; daysOut:number; urgency:"hot"|"warm"|"cold";
  topBand:any|null; topScore:number; candidates:number; fillable:boolean; reasons:string[];
}

// Every open slot, with its best candidate band + urgency. This is the venue/booker view.
export function gridGaps(): GridGap[] {
  const slots:any[] = all(`SELECT s.*, v.name venue, v.city, v.capacity FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open' AND s.date >= date('now') ORDER BY s.date`);
  return slots.map(slot=>{
    const ranked = rankBandsForSlot(slot.id);
    const top = ranked[0];
    const fillable = top ? top.score>=0.5 : false;
    const d = daysUntil(slot.date);
    const urgency = d<=7?"hot":d<=21?"warm":"cold";
    return {
      slot, daysOut:d, urgency,
      topBand: top?.band ?? null, topScore: top?.score ?? 0,
      candidates: ranked.filter(r=>r.score>=0.5).length,
      fillable, reasons: top?.reasons ?? [],
    };
  });
}

// Alerts: urgent or strong gaps worth a push.
export function gapAlerts(): GridGap[] {
  return gridGaps().filter(g => (g.fillable && g.urgency!=="cold") || (g.urgency==="hot"));
}

// Band-facing: open slots a given band could fill on a routed run.
export function opportunitiesForBand(bandId:number){
  return rankSlotsForBand(bandId).filter((r:any)=>r.score>=0.4).map((r:any)=>({
    ...r, daysOut: daysUntil(r.slot.date),
  }));
}

export function trackerSummary(){
  const gaps = gridGaps();
  return {
    openSlots: gaps.length,
    fillable: gaps.filter(g=>g.fillable).length,
    hot: gaps.filter(g=>g.urgency==="hot").length,
    unmatched: gaps.filter(g=>!g.fillable).length,
  };
}
