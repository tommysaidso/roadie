import { all } from "@/lib/db";
import { cookies } from "next/headers";
import { ownedIds } from "@/lib/profiles";
import { memberBandIds, controlledBandIds } from "@/lib/bandmembers";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
import BandFinder from "@/components/BandFinder";
import { Page, Tag } from "@/components/ui";
import { Money } from "@/components/Currency";
import FanBar from "@/components/FanBar";
import VideoRequest from "@/components/VideoRequest";
import BandLineup from "@/components/BandLineup";
import ShareBar from "@/components/ShareBar";
import ConnectHub from "@/components/ConnectHub";
import ClaimButton from "@/components/ClaimButton";
import ReadyToPlay from "@/components/ReadyToPlay";
import Link from "next/link";
import { ExternalLink, Music, MapPin, Users, DollarSign, Video, Radio } from "lucide-react";
export const dynamic = "force-dynamic";

const LINK_LABEL:Record<string,string> = {
  spotify:"Spotify", apple:"Apple Music", youtube:"YouTube", soundcloud:"SoundCloud",
  bandcamp:"Bandcamp", instagram:"Instagram", tiktok:"TikTok", facebook:"Facebook",
  reverbnation:"ReverbNation", bandsintown:"Bandsintown", website:"Website",
};
const LINK_ORDER = ["spotify","apple","youtube","soundcloud","bandcamp","instagram","tiktok","facebook","reverbnation","bandsintown","website"];

export default async function Garage({ searchParams }: { searchParams: Promise<{ band?: string }> }){
  const jar = await cookies();
  const me: any = userForToken(jar.get(SESSION_COOKIE)?.value);

  // Control comes from EVERY band profile on the account, not just the one
  // `band_id` column. Someone with two logins, or one login holding several
  // bands, was landing on their own page as a visitor because this only ever
  // looked at a single id.
  const owned = new Set<number>(ownedIds(me, "band"));
  if (me?.band_id) owned.add(Number(me.band_id));
  // Membership is separate from control: these are the bands they play in.
  const inBands = new Set<number>(memberBandIds(me));
  const controls = new Set<number>(controlledBandIds(me));
  controls.forEach(id => owned.add(id));
  const mineId = me?.band_id ? Number(me.band_id) : (owned.size ? [...owned][0] : null);

  const params = await searchParams;
  const viewId = params.band ? Number(params.band) : null;
  // Viewing a band you own is not a public view — that was the bug that made
  // the controls disappear on your own band.
  const publicView = !!viewId && !owned.has(viewId);
  const bandId = viewId || mineId;

  // Show every band this login touches — run or played in — rather than the
  // single one `band_id` used to point at.
  const shelf = [...new Set<number>([...owned, ...inBands])];
  const bands = bandId
    ? all<any>("SELECT * FROM bands WHERE id=?", bandId)
    : shelf.length
      ? all<any>(`SELECT * FROM bands WHERE id IN (${shelf.map(() => "?").join(",")})`, ...shelf)
      : [];
  const otherCount = publicView ? 0 : (all<any>("SELECT COUNT(*) n FROM bands")[0]?.n || 0) - bands.length;
  const works = all<any>("SELECT * FROM works_cache");
  let sessions:any[]=[]; try{ sessions = all<any>("SELECT * FROM sessions WHERE status='published' AND COALESCE(visibility,'private')='public' AND band_id IS NOT NULL ORDER BY created_at DESC"); }catch{}
  const worksByBand = (id:number)=> works.filter(w=>w.band_id===id);
  return (
    <Page
      title={bands.length ? `${bands[0].name} — Garage` : "Your Garage"}
      sub="Your road kit: profile, bio, your catalog from mymymy, promo, links and sessions. Other acts live in Community."
    >
      {!bands.length && <BandFinder signedIn={!!me}/>}
      {!!bands.length && !publicView && <div className="mb-4"><ReadyToPlay/></div>}
      <div className="grid gap-4">
        {bands.map((b:any)=>{
          const w = worksByBand(b.id);
          const sess = sessions.filter((x:any)=>x.band_id===b.id);
          let links:Record<string,string> = {};
          try { links = JSON.parse(b.links||"{}"); } catch {}
          // Known platforms first, in a sensible order — then ANY other link
          // the band added. Filtering to the whitelist alone silently swallowed
          // custom links: they saved fine and simply never appeared, which
          // looks from the outside like the profile not saving at all.
          const known = LINK_ORDER.filter(k=>links[k]);
          const extra = Object.keys(links)
            .filter(k=>!LINK_ORDER.includes(k) && typeof links[k]==="string" && links[k].trim())
            .sort();
          const linkKeys = [...known, ...extra];
          const ex = b.verification_status==="example";
          const unclaimed = b.verification_status==="unclaimed";
          const dim = ex||unclaimed;
          return (
            <div key={b.id} className={`card overflow-hidden ${dim?"opacity-60 hover:opacity-100 transition-opacity":""}`}>
              <div className="card-h p-5 flex items-start justify-between gap-2">
                <div>
                  <div className="text-xl font-black">{b.name}</div>
                  <div className="text-sm text-muted flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={13}/>{b.home_city}, {b.home_region||"BC"}</span>
                    {b.draw? <span className="flex items-center gap-1"><Users size={13}/>~{b.draw} draw</span> : null}
                    {b.rate_min? <span className="flex items-center gap-1"><DollarSign size={13}/><Money cad={b.rate_min}/>-<Money cad={b.rate_max}/></span> : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {ex
                    ? <span className="pill" style={{borderColor:"#7a7a86",color:"#9a9aa6"}}>example</span>
                    : unclaimed
                    ? <span className="pill" style={{borderColor:"#ffb33d",color:"#ffb33d"}}>unclaimed</span>
                    : b.can_tour===0
                    ? <span className="pill" style={{borderColor:"#7cf3a0",color:"#7cf3a0"}}>🎧 streaming · no tour</span>
                    : (b.touring? <Tag>touring</Tag> : <Tag>home base</Tag>)}
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm">{b.bio_short}</p>
                <div className="mt-2">{(b.genres||"").split(",").filter(Boolean).map((g:string)=><Tag key={g}>{g}</Tag>)}</div>
                {ex && <p className="text-[11px] text-muted mt-2 italic">Example profile — demo content, not a real band.</p>}
                {!publicView && unclaimed && <ClaimButton bandId={b.id} bandName={b.name}/>}

                {linkKeys.length>0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {linkKeys.map(k=>(
                      <a key={k} href={links[k]} target="_blank" rel="noreferrer" className="pill hover:border-neon">{LINK_LABEL[k]||k.replace(/^custom[_-]/,"").replace(/[_-]+/g," ").replace(/\w/g,c=>c.toUpperCase())}</a>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-0">
                  <FanBar bandId={b.id} bandName={b.name} links={links}/>
                  {!publicView && (owned.has(b.id) || inBands.has(b.id)) && (
                    <BandLineup bandId={b.id} bandName={b.name} />
                  )}
                  {!publicView && controls.has(b.id) && (
                    <VideoRequest bandId={b.id} bandName={b.name} />
                  )}
                  <ShareBar title={b.name} text={`Check out ${b.name} on ROADIE`} url={`/garage?band=${b.id}`} />
                </div>
                {!publicView && <ConnectHub band={b}/>}

                {b.spotify_url && (
                  <iframe className="rounded-xl mt-3" style={{border:0}} width="100%" height="152" loading="lazy"
                    src={b.spotify_url.replace("/artist/","/embed/artist/")}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"/>
                )}

                <div className="label mt-4 mb-2 flex items-center gap-2"><Music size={13}/> Catalog (from mymymy)</div>
                {w.length? w.map((x:any)=>(
                  <div key={x.id} className="flex items-center justify-between text-sm py-1.5 border-b border-edge last:border-0">
                    <div className="flex items-center gap-2"><Video size={13} className="text-neon"/>{x.title}</div>
                    <div className="text-muted">{x.primary_genre} • {x.variant_count} variants • <span className="text-cyan">{x.hero_video} promo</span></div>
                  </div>
                )) : <div className="text-sm text-muted">No cached works yet — connect mymymy.</div>}

                {sess.length>0 && (
                  <div className="mt-4">
                    <div className="label mb-2 flex items-center gap-2"><Radio size={13}/> Floor sessions</div>
                    {sess.slice(0,3).map((x:any)=>(
                      <div key={x.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-edge last:border-0 flex-wrap">
                        <span className="text-sm">{x.title} <span className="text-xs text-muted">· {x.kind}</span></span>
                        <div className="flex items-center gap-2">
                          <audio controls preload="none" src={`/api/sessions/audio?key=${x.audio_key}`} style={{height:30}}/>
                          <Link
                            href={`/api/sessions/deck?key=${encodeURIComponent(x.audio_key)}`}
                            className="btn text-xs flex items-center gap-1"
                            title="Open this take in the mymymy Deck mixer, sampler and ACE tools"
                          >
                            <ExternalLink size={13}/> Deck
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {b.can_tour===0 ? (
                  <div className="mt-4">
                    <div className="text-[11px] text-muted mb-2">🎧 Streaming act — <b>no live tour.</b> Available to license into a venue&apos;s playlist or the Wire radio.</div>
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/venues?license=${b.id}`} className="btn btn-neon text-sm">License to a venue</Link>
                      <Link href={`/discover?band=${b.id}`} className="btn text-sm">Add to a playlist</Link>
                    </div>
                    <div className="text-[10px] text-muted mt-2">Want a custom playlist or a themed set built for your room? That&apos;s a paid add-on — ask ROADIE.</div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <Link href={`/map?band=${b.id}`} className="btn text-sm">Plot a tour</Link>
                    <Link href={`/roadie?band=${b.id}`} className="btn btn-neon text-sm">Find gigs (AI)</Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {bands.length > 0 && otherCount > 0 && (
        <div className="mt-6 text-sm text-muted">
          {otherCount} other act{otherCount === 1 ? "" : "s"} on ROADIE —{" "}
          <Link href="/community" className="text-cyan hover:underline">see them in Community</Link>.
        </div>
      )}
    </Page>
  );
}
