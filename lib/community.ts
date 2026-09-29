import { all, one } from "./db";

export const NEED_TAG:Record<string,string> = {
  needproducer:"producer", needvideo:"music_video", needmix:"mixing",
  needmaster:"mastering", needdistribution:"distribution", needengineer:"mixing", needsong:"producer",
};
const hasTag=(csv:string,t:string)=>(","+(csv||"").toLowerCase().replace(/\s/g,"")+",").includes(","+t+",");

export function matchForNeed(need:any){
  if(/gig/.test(need.tag)){
    const slots=all<any>(`SELECT s.id,s.date,s.genre_wanted,s.guarantee,v.name venue,v.city,v.contact
      FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open'
      ${need.city?"AND v.city=@city":""} ORDER BY s.date LIMIT 12`, need.city?{city:need.city}:{});
    // venues without open slots still reachable via contact
    const venues=all<any>(`SELECT name,city,contact FROM venues ${need.city?"WHERE city=@city":""} ORDER BY city,name`, need.city?{city:need.city}:{});
    return { kind:"gig", slots, venues };
  }
  const tag=NEED_TAG[need.tag]||"producer";
  let pros=all<any>("SELECT * FROM pros");
  pros=pros.filter(p=>hasTag(p.tags,tag) || (p.kind||"").toLowerCase()===tag);
  pros=pros.map(p=>{ let sc=0; if(need.country && p.country===need.country) sc+=3; if(p.remote) sc+=1; if(need.region && p.region===need.region) sc+=1; if(p.member_status==="lifetime_free") sc+=0.5; return {p,sc}; })
           .sort((a,b)=>b.sc-a.sc).map(x=>x.p);
  return { kind:"pro", tag, pros };
}

// AI shared-interest discovery: who shares a skill/interest tag.
export function sharedInterests(){
  const people:{name:string;kind:string;tags:string}[]=[];
  all<any>("SELECT name,tags FROM bands").forEach(b=>people.push({name:b.name,kind:"band",tags:(b.tags||"").toLowerCase()}));
  all<any>("SELECT name,tags FROM pros").forEach(p=>people.push({name:p.name,kind:"pro",tags:(p.tags||"").toLowerCase()}));
  const INTEREST=[["music_video","make music videos"],["distribution","handle distribution"],["producer","produce"],["mixing","mix/engineer"],["mastering","master"]];
  return INTEREST.map(([t,label])=>({ tag:t, label, who: people.filter(x=>x.tags.includes(t)).map(x=>x.name) }))
                 .filter(g=>g.who.length>=2);
}
