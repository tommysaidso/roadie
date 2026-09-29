import Link from "next/link";
import { Page } from "@/components/ui";
import OpportunityTracker from "@/components/OpportunityTracker";
import { Building2, BadgeDollarSign, Radio } from "lucide-react";
export const dynamic = "force-dynamic";
export default function Backend(){
  return (
    <Page title="Backend consoles" sub="Operator side. Sites apply to host the ring; vendors and route sponsors manage spend, placements and ROI. The opportunity tracker watches the grid for fillable gaps.">
      <div className="grid md:grid-cols-3 gap-3 mb-8">
        <Link href="/backend/venue" className="card p-6 hover:border-cyan transition">
          <Building2 className="text-cyan mb-2"/><div className="text-lg font-bold">Host console</div>
          <div className="text-sm text-muted">Apply to host a stop, post avails (type / OCR / voice), track your bid and incoming bookings.</div>
        </Link>
        <Link href="/backend/advertiser" className="card p-6 hover:border-amber transition">
          <BadgeDollarSign className="text-amber mb-2"/><div className="text-lg font-bold">Sponsor / vendor console</div>
          <div className="text-sm text-muted">Budgets, ad placements, live ROI, perk inventory, recommended next placements.</div>
        </Link>
        {/* Businesses get the radio too — a host room can put the ring's own
            bands on the PA instead of a generic streaming service. */}
        <Link href="/wire" className="card p-6 hover:border-neon transition">
          <Radio className="mb-2" style={{color:"#ff3d6e"}}/><div className="text-lg font-bold">The Wire</div>
          <div className="text-sm text-muted">The ring&apos;s radio — bands who pushed their tracks to it. Put it on in your room instead of a generic service.</div>
        </Link>
      </div>
      <h2 className="text-xl font-black mb-3">🔔 Opportunity tracker — fillable grid gaps</h2>
      <OpportunityTracker alertsOnly/>
    </Page>
  );
}
