import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import PromoBanner from "@/components/PromoBanner";
import { PlayCircle, MapPin } from "lucide-react";
export const dynamic = "force-dynamic";

function Tile({ b, w }:{ b:any; w?:any }){
  return (
    <a href={`/garage?band=${b.id}`} className="group shrink-0 snap-start" style={{width:200}}>
      <div className="relative rounded-xl overflow-hidden aspect-[16/10] flex items-center justify-center"
           style={{background:"linear-gradient(135deg,#1c1c28,#2a2a3a)"}}>
        <PlayCircle className="text-neon opacity-90 group-hover:scale-110 transition" size={38}/>
        <span className="absolute top-2 left-2 pill text-[10px]">{w? `${w.hero_video} clip` : (b.genre||"live")}</span>
        <div className="absolute inset-x-0 bottom-0 h-12" style={{background:"linear-gradient(transparent,#0b0b0fcc)"}}/>
      </div>
      <div className="mt-2">
        <div className="font-semibold text-sm truncate group-hover:text-white">{w? w.title : b.name}</div>
        <div className="text-xs text-muted flex items-center gap-1 truncate"><MapPin size={11}/>{b.name} • {b.home_city}</div>
      </div>
    </a>
  );
}
function Row({ title, children }:{ title:string; children:React.ReactNode }){
  return (
    <section className="mb-8">
      <h2 className="text-lg md:text-xl font-black mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto scroll snap-x pb-2 -mx-4 px-4 md:mx-0 md:px-0">{children}</div>
    </section>
  );
}

export default function Discover(){
  const bands = all<any>("SELECT * FROM bands ORDER BY draw DESC");
  const works = all<any>("SELECT * FROM works_cache");
  const wOf = (id:number)=>works.filter((w:any)=>w.band_id===id);
  const feature = bands[0];
  const fW = feature? wOf(feature.id)[0] : null;
  const touring = bands.filter((b:any)=>b.touring);
  const byGenre:Record<string,any[]> = {};
  bands.forEach((b:any)=>{ const g=(b.genre||"Other"); (byGenre[g]=byGenre[g]||[]).push(b); });

  return (
    <Page title="Discover" sub="The public face — fans find bands by frontage and music videos (static Ken-Burns or full living clips, made by ROADIE from each band's catalog in mymymy).">
      {feature && (
        <div className="relative rounded-2xl overflow-hidden mb-8 min-h-[260px] md:min-h-[340px] flex items-end"
             style={{background:"linear-gradient(120deg,#14141c,#2a2a3a)"}}>
          <div className="absolute inset-0 flex items-center justify-center"><PlayCircle className="text-neon opacity-30" size={120}/></div>
          <div className="absolute inset-0" style={{background:"linear-gradient(0deg,#0b0b0f 5%,transparent 60%)"}}/>
          <div className="relative p-6 md:p-8 max-w-xl">
            <span className="pill">Featured{fW? ` • ${fW.hero_video} clip`:""}</span>
            <h1 className="text-3xl md:text-5xl font-black mt-2">{feature.name}</h1>
            <p className="text-muted mt-1">{feature.bio_short}</p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-neon text-sm flex items-center gap-1"><PlayCircle size={16}/>Play</button>
              <a href={`/garage?band=${feature.id}`} className="btn text-sm">More on the band</a>
            </div>
          </div>
        </div>
      )}

      {touring.length>0 && <Row title="Touring now">{touring.map((b:any)=><Tile key={b.id} b={b} w={wOf(b.id)[0]}/>)}</Row>}

      <Row title="New videos on ROADIE">
        {works.length? works.map((w:any)=>{ const b=bands.find((x:any)=>x.id===w.band_id); return b? <Tile key={w.id} b={b} w={w}/> : null; })
          : bands.map((b:any)=><Tile key={b.id} b={b}/>)}
      </Row>

      {Object.entries(byGenre).map(([g,list])=>(
        <Row key={g} title={g}>{list.map((b:any)=><Tile key={b.id} b={b} w={wOf(b.id)[0]}/>)}</Row>
      ))}
          <div className="mt-6"><PromoBanner src="/promo/fans.png" alt="Your town&#39;s bands are on here" maxH={300}/></div>
    </Page>
  );
}
