import { Page } from "@/components/ui";
export const dynamic="force-dynamic";
export default function Terms(){
  return (
    <Page title="Terms & the important disclaimer" sub="Plain language. Please read this — it defines what ROADIE is and is not.">
      <div className="card p-6 space-y-4 text-sm leading-relaxed max-w-3xl">
        <p><b className="text-neon">ROADIE is a discovery and connection tool.</b> It helps bands, venues, fans, sponsors and music pros find each other, plan tours, and share information. That&rsquo;s it.</p>
        <p><b>Not a legal representative.</b> ROADIE is not a lawyer, agent, manager or legal representative for any band, venue or party. Nothing here is legal advice. Information about laws, visas, PROs, copyright and contracts is general and may be out of date — confirm with the official body or a qualified professional in your jurisdiction.</p>
        <p><b>We don&rsquo;t handle your money.</b> ROADIE does not process, hold, guarantee or control any payment, guarantee, door split, ticket sale or donation between a band, a venue, a sponsor or a fan. Those transactions happen directly between the parties, on their own terms and their own platforms.</p>
        <p><b>Contracts are between the parties.</b> Any performance agreement, booking, sponsorship or deal is strictly a <i>party-to-party</i> matter. ROADIE may generate a draft document as a convenience, but it is a starting point only — the parties are responsible for reviewing, negotiating, signing and honouring their own agreements. ROADIE is not a party to them and carries no liability for them.</p>
        <p><b>Laws differ by place.</b> Booking, event permits, noise, labour, tax and cross-border rules vary by province, state and country. ROADIE surfaces general notes to help you ask the right questions — it does not guarantee accuracy or compliance. You are responsible for following the rules where you play.</p>
        <p><b>Your content stays yours.</b> Signing up registers your profile and content to you. ROADIE doesn&rsquo;t claim ownership of your music, videos or catalogue. Rights registration and royalties are handled on <span className="text-cyan">mymymy</span>.</p>
        <p><b>JamPoints &amp; loyalty — free, and measured.</b> A business can join <b>JamPoints</b> for free: you offer a discount to the community, and it works across the LocalJams and ROADIE network in Canada and the USA. In exchange, the program is <b>measured</b> — redemptions, participation and the revenue lift it brings your business are tracked. If it is clearly growing your business, we may later offer a paid tier or reach out about pricing. No surprise: the free tier stays free on its own terms, and any paid option is optional and disclosed here, up front.</p>
        <p className="text-muted">By using ROADIE you agree it is provided &ldquo;as is,&rdquo; for information and connection only, with no warranty. Use good judgment, get things in writing, and talk to a professional for anything that matters.</p>

        {/* Every agreement we would ask anyone to sign is readable and
            downloadable without a login. No secrets. */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-neon">The paperwork, in the open</div>
          <p>
            Anything we would ask you to sign is published before we ask, and you
            can download it for your own lawyer.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <a className="text-cyan underline" href="/ring-agreement">Ring Contractor Agreement</a>
              {" — "}the deal for touring a ring{" ("}
              <a className="text-cyan underline" href="/api/legal/ring-contract" download>download</a>
              {")"}
            </li>
            <li>
              <a className="text-cyan underline" href="/crew">Crew &amp; specialists</a>
              {" — "}work the ring in your own town
            </li>
            <li>
              <a className="text-cyan underline" href="/legal-counsel">Our legal counsel</a>
              {" — "}who wrote and reviewed it
            </li>
          </ul>
        </div>
      </div>
    </Page>
  );
}
