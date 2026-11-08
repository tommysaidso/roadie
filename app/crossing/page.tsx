import { all } from "@/lib/db";
import { Page } from "@/components/ui";
import CrossingExplorer from "@/components/CrossingExplorer";
export const metadata = { title: "Border & Visas — touring across CA · US · MX", alternates: { canonical: "/crossing" } };
export const dynamic = "force-dynamic";

const FLAG:any={CA:"🇨🇦",US:"🇺🇸",MX:"🇲🇽"};
export default async function Crossing({ searchParams }:{ searchParams: Promise<{ from?:string; to?:string }> }){
  const q = await searchParams;
  let rules:any[]=[]; let terr:any[]=[];
  try { rules = all<any>("SELECT * FROM region_rules ORDER BY country, region, topic"); } catch {}
  try { terr = all<any>("SELECT * FROM territories WHERE type!='country' ORDER BY country, name"); } catch {}
  const byCountry=(c:string)=>terr.filter((t:any)=>t.country===c);
  const localRules=(c:string)=>rules.filter((r:any)=>(r.country||"CA")===c);
  return (
    <Page title="Border & Visas — touring across CA · US · MX" sub="Pick where you're touring from and into. ROADIE shows the visa/work route, the tax withholding, the gear carnet, and the port-of-entry checklist — each linked to the official source — plus your immigration contact for application help.">
      <CrossingExplorer initialFrom={q.from} initialTo={q.to}/>

      <h2 className="text-xl font-black mt-10 mb-3">Browse by country → province / state</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {["CA","US","MX"].map(c=>(
          <div key={c} className="card p-5">
            <div className="text-lg font-bold mb-2">{FLAG[c]} {c==="CA"?"Canada":c==="US"?"United States":"Mexico"}</div>
            <div className="label mb-1">Regions</div>
            <div className="mb-3">{byCountry(c).map((t:any)=><span key={t.id} className="pill mr-1 mb-1 inline-block">{t.code||t.name}</span>)}</div>
            <div className="label mb-1">Local rules</div>
            {localRules(c).length? localRules(c).slice(0,5).map((r:any)=>(
              <div key={r.id} className="text-xs text-muted py-1 border-b border-edge last:border-0"><b className="text-cyan">{r.topic}:</b> {r.rule}</div>
            )) : <div className="text-xs text-muted">Local rules pack coming for this country.</div>}
          </div>
        ))}
      </div>
    </Page>
  );
}
