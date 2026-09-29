// Producers/pros + the #need lifeline. Factual/editable; the user's own network.
export function seedCommunity(db){
  try{ db.prepare("SELECT tags FROM bands LIMIT 1").get(); }catch{ db.exec("ALTER TABLE bands ADD COLUMN tags TEXT"); }
  // bands that make videos -> shared interest 'music_video'
  try{ db.prepare("UPDATE bands SET tags='music_video' WHERE tags IS NULL AND id IN (SELECT DISTINCT band_id FROM works_cache WHERE hero_video IN ('kenburns','living'))").run(); }catch{}

  if(db.prepare("SELECT COUNT(*) n FROM pros").get().n===0){
    const p=db.prepare(`INSERT INTO pros(name,headline,kind,tags,city,region,country,remote,bio,links,member_status)
      VALUES(@name,@headline,@kind,@tags,@city,@region,@country,@remote,@bio,@links,@status)`);
    p.run({name:"Mose Jackson",headline:"Producer (USA) — remote-friendly",kind:"producer",
      tags:"producer,mixing,mastering,music_video",city:"",region:"",country:"US",remote:1,
      bio:"US-based music producer. Lifetime member. Open to remote production for BC/Canada artists.",
      links:JSON.stringify({}),status:"lifetime_free"});
    p.run({name:"Ben (evprod)",headline:"Producer · artist · distributor · video",kind:"producer",
      tags:"producer,distribution,music_video,artist,bmi,sag",city:"",region:"BC",country:"CA",remote:1,
      bio:"Producer, recording artist and distributor (BMI + SAG). Makes music videos.",
      links:JSON.stringify({email:"ben@evprod.com"}),status:"member"});
    p.run({name:"Okanagan Frames",headline:"Music-video & live capture",kind:"videographer",
      tags:"music_video,live_capture,editing",city:"Kelowna",region:"BC",country:"CA",remote:0,
      bio:"Kelowna videographer for music videos and live sessions.",links:JSON.stringify({}),status:"sample"});
  }
  if(db.prepare("SELECT COUNT(*) n FROM needs").get().n===0){
    const band=db.prepare("SELECT id,name FROM bands ORDER BY id LIMIT 1").get();
    if(band){
      const n=db.prepare(`INSERT INTO needs(tag,author_kind,author_id,author_name,city,region,country,note) VALUES(?,?,?,?,?,?,?,?)`);
      n.run("needproducer","band",band.id,band.name,"Kelowna","BC","US","Looking for a US producer for our next single.");
      n.run("needgig","band",band.id,band.name,"Kelowna","BC","CA","Free weekend mid-July — need a room.");
      n.run("needvideo","band",band.id,band.name,"Kelowna","BC","CA","Want a music video for the new track.");
    }
  }
}
