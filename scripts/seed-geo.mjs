export function seedGeo(db){
  const have=(country,code)=>db.prepare("SELECT 1 FROM territories WHERE country=? AND code IS ?").get(country,code);
  const add=db.prepare("INSERT INTO territories(country,code,name,type,parent_country) VALUES(?,?,?,?,?)");
  const CA=[["BC","British Columbia"],["AB","Alberta"],["SK","Saskatchewan"],["MB","Manitoba"],["ON","Ontario"],["QC","Quebec"],["NB","New Brunswick"],["NS","Nova Scotia"],["PE","Prince Edward Island"],["NL","Newfoundland & Labrador"],["YT","Yukon"],["NT","Northwest Territories"],["NU","Nunavut"]];
  const US=[["WA","Washington"],["OR","Oregon"],["CA","California"],["ID","Idaho"],["MT","Montana"],["ND","North Dakota"],["MN","Minnesota"],["MI","Michigan"],["NY","New York"],["VT","Vermont"],["ME","Maine"],["OH","Ohio"],["PA","Pennsylvania"],["IL","Illinois"]];
  for(const [c,n] of CA){ if(!have("CA",c)) add.run("CA",c,n,"province","CA"); }
  for(const [c,n] of US){ if(!have("US",c)) add.run("US",c,n,"state","US"); }
}
