// Real BC music festivals (public info; month-level dates, editable). Facts only.
export function seedFestivals(db){
  if(db.prepare("SELECT COUNT(*) n FROM festivals").get().n>0) return;
  const f=db.prepare(`INSERT INTO festivals(name,city,region,country,lat,lng,month,genre,website,traveling,notes)
    VALUES(@name,@city,'BC','CA',@lat,@lng,@month,@genre,@website,@traveling,@notes)`);
  const rows=[
    {name:"Rifflandia", city:"Victoria", lat:48.428, lng:-123.365, month:"September", genre:"Multi", website:"https://rifflandia.com", traveling:0, notes:"Multi-venue city festival."},
    {name:"Bass Coast", city:"Merritt", lat:50.112, lng:-120.788, month:"July", genre:"Electronic", website:"https://basscoast.ca", traveling:0, notes:""},
    {name:"Shambhala Music Festival", city:"Salmo", lat:49.196, lng:-117.280, month:"July", genre:"Electronic", website:"https://shambhalamusicfestival.com", traveling:0, notes:"Salmo River Ranch, Kootenays."},
    {name:"FVDED in the Park", city:"Surrey", lat:49.104, lng:-122.801, month:"July", genre:"Hip-Hop / EDM", website:"", traveling:0, notes:"Holland Park."},
    {name:"Laketown Shakedown", city:"Lake Cowichan", lat:48.826, lng:-124.055, month:"June", genre:"Rock / Indie", website:"", traveling:0, notes:"Laketown Ranch."},
    {name:"Rockin' River Music Fest", city:"Merritt", lat:50.112, lng:-120.788, month:"August", genre:"Country", website:"", traveling:0, notes:""},
    {name:"Center of Gravity", city:"Kelowna", lat:49.888, lng:-119.496, month:"July", genre:"Multi / Sport", website:"", traveling:0, notes:"Okanagan Lake waterfront."},
    {name:"Salmon Arm Roots & Blues", city:"Salmon Arm", lat:50.700, lng:-119.284, month:"August", genre:"Roots / Blues", website:"", traveling:0, notes:""},
    {name:"Vancouver Folk Music Festival", city:"Vancouver", lat:49.283, lng:-123.120, month:"July", genre:"Folk", website:"", traveling:0, notes:"Jericho Beach Park."},
  ];
  rows.forEach(r=>f.run(r));
}
