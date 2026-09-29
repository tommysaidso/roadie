// Smart placement: score a band against an open venue slot.
// Heuristic stand-in for the AI booker (genre fit, geography, draw vs capacity,
// budget fit, touring intent). Returns 0..1 with a human-readable reason.
import { all, one } from "./db";
import { billFit } from "./genres";

// Per-hub distance tuning: prairie hubs legitimately have 500km "runouts".
function hubThresholds(hubId:any){
  const d = { localKm: 60, runoutKm: 260 };
  if (!hubId) return d;
  try {
    const h:any = one("SELECT local_km, runout_km FROM hubs WHERE id=?", hubId);
    if (h) return { localKm: h.local_km || d.localKm, runoutKm: h.runout_km || d.runoutKm };
  } catch {}
  return d;
}

function haversineKm(a:[number,number], b:[number,number]) {
  const R=6371, toRad=(d:number)=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]), dLng=toRad(b[1]-a[1]);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

export interface MatchResult { band:any; score:number; km:number; reasons:string[]; }

export function rankBandsForSlot(slotId:number): MatchResult[] {
  const slot:any = one("SELECT s.*, v.lat vlat, v.lng vlng, v.capacity, v.city vcity, v.genres vgenres FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.id=?", slotId);
  if (!slot) return [];
  const th = hubThresholds(one<any>("SELECT hub_id FROM venues WHERE id=?", slot.venue_id)?.hub_id);
  const bands:any[] = all("SELECT * FROM bands");
  const wanted = (slot.genre_wanted||"").toLowerCase();
  return bands.map(band => {
    const reasons:string[]=[]; let score=0;
    // Genre fit by FAMILY, not substring. `includes()` couldn't tell that folk
    // and death metal don't share a night, and "any" handed every act a pass —
    // which is exactly how a bill ends up badly blended. A distant pairing is
    // now blocked outright unless the night explicitly asks for a blend.
    const bg = (band.genres||band.genre||"");
    const fit = billFit(wanted && wanted!=="any" ? wanted : (slot.vgenres||""), bg);
    const allowBlend = /blend|mixed|any genre|variety/i.test(String(slot.notes||""));
    if (fit.verdict==="distant" && !allowBlend) {
      return { band, score:0, km:9999, reasons:[`blocked — ${fit.why}`] };
    }
    if (fit.verdict==="same")     { score+=0.4;  reasons.push(`genre fit — ${fit.why}`); }
    else if (fit.verdict==="adjacent") { score+=0.25; reasons.push(`workable pairing — ${fit.why}`); }
    else if (fit.verdict==="unknown")  { score+=0.12; reasons.push(fit.why); }
    else { score+=0.05; reasons.push(`blend allowed for this night — ${fit.why}`); }
    // geography
    let km=9999;
    if (band.lat && slot.vlat) { km=Math.round(haversineKm([band.lat,band.lng],[slot.vlat,slot.vlng]));
      if (km<th.localKm){score+=0.25;reasons.push(`local (${km}km)`);}
      else if (km<th.runoutKm){score+=0.15;reasons.push(`runout-range (${km}km)`);}
      else {score+=0.03;reasons.push(`far (${km}km)`);}
    }
    // draw vs capacity
    if (band.draw && slot.capacity) {
      const r=band.draw/slot.capacity;
      if (r>=0.5 && r<=1.2){score+=0.2;reasons.push("right-sized draw");}
      else if (r>1.2){score+=0.1;reasons.push("could sell out");}
      else {score+=0.05;reasons.push("light draw");}
    }
    // budget fit
    if (slot.guarantee!=null && band.rate_min!=null) {
      if (slot.guarantee>=band.rate_min){score+=0.1;reasons.push("budget OK");}
      else {reasons.push("under ask");}
    }
    // touring intent bonus for non-local
    if (band.touring && km>th.localKm){score+=0.05;reasons.push("actively touring");}
    return { band, score:Math.min(1,Number(score.toFixed(2))), km, reasons };
  }).sort((a,b)=>b.score-a.score);
}

export function rankSlotsForBand(bandId:number) {
  const band:any = one("SELECT * FROM bands WHERE id=?", bandId);
  const slots:any[] = all("SELECT s.*, v.name vname, v.city vcity, v.lat vlat, v.lng vlng, v.capacity FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open' AND s.date >= date('now')");
  if(!band) return [];
  const th = hubThresholds(band.hub_id);
  return slots.map(slot=>{
    const reasons:string[]=[]; let score=0;
    const wanted=(slot.genre_wanted||"").toLowerCase();
    const bg=(band.genres||band.genre||"").toLowerCase();
    if(wanted && (bg.includes(wanted)||wanted==="any")){score+=0.4;reasons.push(`genre fit`);}
    let km=9999;
    if(band.lat&&slot.vlat){km=Math.round(haversineKm([band.lat,band.lng],[slot.vlat,slot.vlng]));
      if(km<th.localKm){score+=0.25;reasons.push(`local ${km}km`);} else if(km<th.runoutKm){score+=0.15;reasons.push(`runout ${km}km`);} }
    if((slot.guarantee||0)>=(band.rate_min||0)){score+=0.15;reasons.push("budget OK");}
    return {slot,score:Math.min(1,Number(score.toFixed(2))),km,reasons};
  }).sort((a,b)=>b.score-a.score);
}
