import { all } from "@/lib/db";
import { Page, Tag } from "@/components/ui";
export const dynamic = "force-dynamic";
export default function Calendar(){
  const bookings = all<any>(`SELECT b.*, ba.name band, v.name venue, v.city FROM bookings b JOIN bands ba ON ba.id=b.band_id JOIN venues v ON v.id=b.venue_id ORDER BY b.date`);
  const open = all<any>(`SELECT s.*, v.name venue, v.city FROM venue_slots s JOIN venues v ON v.id=s.venue_id WHERE s.status='open' ORDER BY s.date`);
  const rows = [
    ...bookings.map((b:any)=>({date:b.date,type:"booked",label:`${b.band} @ ${b.venue}`,city:b.city,extra:`$${b.guarantee} • ${b.status}`})),
    ...open.map((s:any)=>({date:s.date,type:"open",label:`OPEN @ ${s.venue}`,city:s.city,extra:`${s.genre_wanted||"any"} • $${s.guarantee||0}`})),
  ].sort((a,b)=>a.date.localeCompare(b.date));
  return (
    <Page title="Calendar" sub="Auto-calendar across the network — confirmed bookings and every open slot in one timeline. Booking through ROADIE writes here automatically.">
      <div className="card divide-y divide-edge">
        {rows.map((r,i)=>(
          <div key={i} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="text-sm font-mono text-cyan w-24">{r.date}</div>
              <div><div className="font-medium">{r.label}</div><div className="text-xs text-muted">{r.city} • {r.extra}</div></div>
            </div>
            <Tag>{r.type==="booked"?"✅ booked":"🟢 open"}</Tag>
          </div>
        ))}
      </div>
    </Page>
  );
}
