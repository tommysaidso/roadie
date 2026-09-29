"use client";
import useSWR from "swr";
const f=(u:string)=>fetch(u).then(r=>r.json());
export default function RoiBoard(){
  const { data } = useSWR("/api/roi", f);
  if(!data) return <div className="text-muted">Loading ROI…</div>;
  const { placements, totals } = data;
  const fmt=(n:number)=>`$${Math.round(n).toLocaleString()}`;
  return (
    <div className="card p-0 overflow-x-auto scroll">
      <table className="w-full text-sm" style={{minWidth:640}}>
        <thead className="card-h text-left"><tr className="text-muted">
          <th className="p-3">Sponsor</th><th>Surface</th><th>Spend</th><th>Impr.</th><th>CTR</th><th>Conv.</th><th>CPA</th><th>CPM</th>
        </tr></thead>
        <tbody>
          {placements.map((p:any)=>(
            <tr key={p.id} className="border-t border-edge">
              <td className="p-3"><div className="font-medium">{p.sponsor}</div><div className="text-xs text-muted">{p.kind}</div></td>
              <td>{p.surface}</td>
              <td>{fmt(p.cost)}</td>
              <td>{p.impressions.toLocaleString()}</td>
              <td>{(p.ctr*100).toFixed(2)}%</td>
              <td>{p.conversions}</td>
              <td>{p.cpa?fmt(p.cpa):"—"}</td>
              <td>{p.cpm?fmt(p.cpm):"—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t border-edge card-h font-semibold">
          <td className="p-3">Totals</td><td></td><td>{fmt(totals.cost)}</td><td>{totals.impressions.toLocaleString()}</td>
          <td>{((totals.clicks/totals.impressions)*100).toFixed(2)}%</td><td>{totals.conversions}</td>
          <td>{fmt(totals.cost/totals.conversions)}</td><td>{fmt((totals.cost/totals.impressions)*1000)}</td>
        </tr></tfoot>
      </table>
    </div>
  );
}
