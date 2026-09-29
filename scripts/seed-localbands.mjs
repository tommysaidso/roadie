// Real Okanagan / Interior / Kootenay bands seeded as SAMPLE profiles
// (member_status='sample' — a sponsored presence; they haven't signed up).
// FACTUAL public metadata only: name, town, genre, official Spotify + links,
// official cover art. Numbers are left blank (unknown) and are editable.
// Verified each Spotify artist id via Spotify oEmbed.
const BANDS = [
  { name:"Sonic Lizards", city:"Kelowna", lat:49.888, lng:-119.496, genre:"Garage Rock", genres:"Garage Rock,Rock",
    sid:"3d9WR3Cz071S8IIBudA66G", cover:"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ff4892dd95e5ca65221e91f2",
    bio:"Garage-rock band from Kelowna, BC (formed 2017).", links:{} },
  { name:"Black$tar", city:"Kelowna", lat:49.886, lng:-119.490, genre:"Hip-Hop", genres:"Hip-Hop,Rap",
    sid:"70zQgJZkTI7rz0N0eSd1lY", cover:"https://image-cdn-ak.spotifycdn.com/image/ab6761610000517497c244ed1cf0ca4e27696965",
    bio:"Kelowna, BC recording artist (2M+ streams).", links:{} },
  { name:"Madison Olds", city:"Kamloops", lat:50.674, lng:-120.327, genre:"Pop", genres:"Pop",
    sid:"6n1pH8SgKcxx6dILhKqYFb", cover:"https://image-cdn-fa.spotifycdn.com/image/ab67616100005174d3af389dff80c46031ea842c",
    bio:"Pop artist from Kamloops, BC.", links:{ website:"https://www.madisonolds.com/" } },
  { name:"Aidan Mayes", city:"Penticton", lat:49.499, lng:-119.593, genre:"Folk", genres:"Folk,Indie Folk",
    sid:"04DRMKtcZ8IpqxfB66caZl", cover:"https://image-cdn-ak.spotifycdn.com/image/ab6761610000517436a92a727c5c25522f11aeae",
    bio:"Folk-contemporary singer-songwriter from Penticton, BC.",
    links:{ website:"https://www.aidanmayes.ca/", soundcloud:"https://soundcloud.com/aidan-natasha-mayes", facebook:"https://www.facebook.com/aidanmayesmusic" } },
  { name:"Moving Lines", city:"Summerland", lat:49.600, lng:-119.677, genre:"Rock", genres:"Rock",
    sid:"1V2UtkDLoWOjQVY8Cc2aUA", cover:"https://image-cdn-fa.spotifycdn.com/image/ab676161000051746772386dccc9e25e9d596302",
    bio:"Rock duo from Summerland, BC.", links:{} },
  { name:"Shred Kelly", city:"Fernie", lat:49.504, lng:-115.063, genre:"Indie Folk", genres:"Indie Folk,Folk Rock,Alt-Folk",
    sid:"0TLkxB9Td2RXnmDEupHPQx", cover:"https://image-cdn-fa.spotifycdn.com/image/ab676161000051747520b5ec71e5c1c5e11bfe0e",
    bio:"Alt-folk rock band from Fernie, BC (formed 2009).",
    members:"Sage McBride,Tim Newton,Jordan Vlasschaert,Ian Page-Shiner,Ty West",
    links:{ facebook:"https://www.facebook.com/shredkellymusic" } },
];

export function seedLocalBands(db){
  for (const c of ["spotify_url","links"]) {
    try { db.prepare(`SELECT ${c} FROM bands LIMIT 1`).get(); }
    catch { db.exec(`ALTER TABLE bands ADD COLUMN ${c} TEXT`); }
  }
  try { db.prepare("SELECT member_status FROM bands LIMIT 1").get(); }
  catch { db.exec("ALTER TABLE bands ADD COLUMN member_status TEXT DEFAULT 'member'"); }

  const ins = db.prepare(`INSERT INTO bands
    (name,genre,genres,home_city,home_region,lat,lng,bio_short,bio,members,touring,socials,hero_image,spotify_url,links,member_status,mymymy_artist_id)
    VALUES (@name,@genre,@genres,@city,'BC',@lat,@lng,@bio,@bio2,@members,0,@socials,@cover,@spotify,@links,'sample',@mid)`);
  const work = db.prepare(`INSERT INTO works_cache(band_id,iswc,title,primary_genre,variant_count,hero_video,cover_url,source)
    VALUES(?,?,?,?,?, 'living', ?, 'spotify')`);

  for (const b of BANDS){
    const url = `https://open.spotify.com/artist/${b.sid}`;
    const exists = db.prepare("SELECT id FROM bands WHERE spotify_url=? OR name=?").get(url, b.name);
    if (exists) continue;
    const links = { spotify:url, ...(b.links||{}) };
    const id = ins.run({
      name:b.name, genre:b.genre, genres:b.genres, city:b.city, lat:b.lat, lng:b.lng,
      bio:b.bio, bio2:`${b.bio} Sample profile on ROADIE — a sponsored presence; not yet a member. Links are official.`,
      members:b.members||"", socials:JSON.stringify(links), cover:b.cover, spotify:url,
      links:JSON.stringify(links), mid:"art_"+b.name.toLowerCase().replace(/[^a-z0-9]/g,""),
    }).lastInsertRowid;
    work.run(id, null, `${b.name} — on Spotify`, b.genre, 0, b.cover);
  }
}
