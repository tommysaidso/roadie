import { Page } from "@/components/ui";
import { regionList } from "@/lib/regions";
export const metadata = { title: "Regions & Laws", alternates: { canonical: "/regions" } };
export const dynamic="force-dynamic";
const FLAG:any={CA:"🇨🇦",US:"🇺🇸"};
export default function Regions(){
  const rows=regionList();
  const CA=rows.filter(r=>r.country==="CA"), US=rows.filter(r=>r.country==="US");
  const Block=({title,list}:{title:string;list:any[]})=>(
    <div className="mb-8">
      <h2 className="text-xl font-black mb-3">{title}</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((r:any)=>(
          <div key={r.country+r.code} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold">{FLAG[r.country]} {r.name} <span className="text-xs text-muted">({r.code})</span></div>
              <span className="pill" style={r.live?{borderColor:"#3ddc84",color:"#3ddc84"}:{}}>{r.live?"live":"planned"}</span>
            </div>
            <div className="text-xs text-muted mt-1">PRO: {r.pro}{r.border?" · border corridor":""}</div>
            <div className="text-sm mt-2"><b className="text-cyan">Booking:</b> {r.booking}</div>
            <div className="text-sm mt-1"><b className="text-amber">Permits/vendors:</b> {r.permit} <span className="text-muted">({r.body})</span></div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <Page title="Regions & Laws" sub="ROADIE is province-by-province and state-by-state — because site permits, vendor rules and cross-border rules differ everywhere. Every stop is all-ages and alcohol-free, so what matters is the ground permit. General info only, not legal advice; confirm with the listed body.">
      <Block title="Canada — provinces" list={CA}/>
      <Block title="USA — border & corridor states" list={US}/>
      <p className="text-xs text-muted">Coverage grows region by region. Each will get its own rule pack and booking manager. This is a guide to ask the right questions, not a compliance guarantee — see <a href="/terms" className="underline">Terms &amp; disclaimer</a>.</p>
    </Page>
  );
}
