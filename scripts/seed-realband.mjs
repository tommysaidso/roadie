// Seed Dewey Mitchell's real band as a working, editable profile + live Spotify embed.
// Facts only (name, location, genre, official links/art); numbers are starting
// placeholders Dewey can edit. Idempotent — safe to run repeatedly.
export function seedRealBand(db){
  try { db.prepare("SELECT spotify_url FROM bands LIMIT 1").get(); }
  catch { db.exec("ALTER TABLE bands ADD COLUMN spotify_url TEXT"); }
  try { db.prepare("SELECT links FROM bands LIMIT 1").get(); }
  catch { db.exec("ALTER TABLE bands ADD COLUMN links TEXT"); }
  try { db.prepare("SELECT member_status FROM bands LIMIT 1").get(); }
  catch { db.exec("ALTER TABLE bands ADD COLUMN member_status TEXT DEFAULT 'member'"); }

  const exists = db.prepare("SELECT id FROM bands WHERE spotify_url LIKE ? OR name=?")
    .get("%1wF1KtAIAJjXkutrt2Pk3Y%", "There's No End");
  if (exists) return;

  const id = db.prepare(`INSERT INTO bands
    (name,genre,genres,home_city,home_region,lat,lng,bio_short,bio,members,draw,rate_min,rate_max,touring,socials,hero_image,spotify_url,links,member_status,mymymy_artist_id)
    VALUES (@name,@genre,@genres,@home_city,'BC',@lat,@lng,@bio_short,@bio,@members,@draw,@rate_min,@rate_max,@touring,@socials,@hero_image,@spotify_url,@links,@member_status,@mymymy_artist_id)`)
    .run({
      name:"There's No End", genre:"Rock", genres:"Rock,Hard Rock,Heavy Rock",
      home_city:"Kelowna", lat:49.888, lng:-119.496,
      bio_short:"Rock band from Kelowna, BC.",
      bio:"There's No End is a Kelowna, BC rock band. This is a live ROADIE profile wired to the band's official Spotify — edit the bio, draw, rate and tour status to match your promo.",
      members:"", draw:150, rate_min:500, rate_max:1500, touring:0,
      socials:'{"spotify":"https://open.spotify.com/artist/1wF1KtAIAJjXkutrt2Pk3Y","reverbnation":"https://www.reverbnation.com/theresnoend"}',
      hero_image:"https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b99d6b910ac0a67047fc88e3",
      spotify_url:"https://open.spotify.com/artist/1wF1KtAIAJjXkutrt2Pk3Y",
      links:JSON.stringify({spotify:"https://open.spotify.com/artist/1wF1KtAIAJjXkutrt2Pk3Y", reverbnation:"https://www.reverbnation.com/theresnoend"}),
      member_status:"member",
      mymymy_artist_id:"art_theresnoend",
    }).lastInsertRowid;

  // a promo entry so it surfaces on Discover too
  db.prepare(`INSERT INTO works_cache(band_id,iswc,title,primary_genre,variant_count,hero_video,cover_url,source)
    VALUES(?,?,?,?,?,?,?, 'spotify')`)
    .run(id, null, "There's No End — on Spotify", "Rock", 0, "living",
         "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b99d6b910ac0a67047fc88e3");
}
