import { Page } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Legal counsel — business profile.
 *
 * Published because the platform asks bands to sign things. Naming the firm
 * that reviewed the paperwork, with their real credentials, is worth more to a
 * sceptical band than any amount of assurance in our own words.
 *
 * Every fact here comes from the firm's own site, the California State Bar
 * licensee record, and Martindale — not from us. If any of it goes stale, fix
 * it against those sources rather than editing from memory.
 */
export default function LegalCounselPage() {
  return (
    <Page
      title="Legal counsel"
      sub="The firm that reviews the paperwork we ask people to sign."
    >
      <div className="card p-6 space-y-4 text-sm leading-relaxed max-w-3xl">
        <div>
          <div className="text-neon text-lg">Kaye &amp; Mills</div>
          <div className="text-muted">
            Entertainment, business, publishing, internet &amp; new media law
          </div>
        </div>

        <div className="text-xs text-muted leading-relaxed">
          8840 Wilshire Boulevard<br/>
          Beverly Hills, CA 90211<br/>
          Tel: <a className="text-cyan" href="tel:+13109278033">310-927-8033</a><br/>
          <a className="text-cyan underline" href="https://kayemills.com"
             target="_blank" rel="noreferrer">kayemills.com</a>
        </div>

        <p className="text-muted">
          A boutique firm serving entertainment and general corporate clients
          across film, television, publishing, internet and new media — talent
          representation through to the financing, production and distribution of
          entertainment product.
        </p>
      </div>

      <div className="card p-6 mt-4 space-y-3 text-sm leading-relaxed max-w-3xl">
        <div className="text-neon font-medium">Kevin S. Mills</div>
        <div className="text-xs text-muted">
          Owner · California Bar #102419 · admitted 1981 (U.S. District Court,
          Central District of California) and 1982 (California)
        </div>
        <ul className="list-disc pl-5 space-y-1 text-muted">
          <li>
            Began as <b className="text-cyan">Counsel to the United States Senate
            Judiciary Committee</b> in Washington, D.C. — telecommunications,
            cable broadcasting and immigration reform
          </li>
          <li>
            Senior business affairs roles at <b>Republic Pictures</b>,
            Independent Artists Company, <b>Hal Roach Studios</b> and what is now
            <b> Hallmark Entertainment</b>
          </li>
          <li>
            At Republic Pictures, was instrumental in{" "}
            <b className="text-cyan">recapturing the copyright to
            &ldquo;It&rsquo;s A Wonderful Life&rdquo;</b>
          </li>
          <li>
            Practice covers talent representation, financing, production and
            distribution, international TV and film distribution, and internet,
            computer and digital rights
          </li>
          <li>
            Board member, Entertainment &amp; Intellectual Property Alumni
            Association, Southwestern University School of Law · Copyright
            Protection Committee, Independent Film &amp; Television Alliance ·
            Beverly Hills Bar Association
          </li>
          <li>J.D. Southwestern University (1981) · B.A. UC Irvine (1978)</li>
        </ul>
      </div>

      <div className="card p-6 mt-4 space-y-3 text-sm leading-relaxed max-w-3xl">
        <div className="text-neon font-medium">Jessica Kaye</div>
        <div className="text-xs text-muted">
          Owner · admitted in California and Connecticut · J.D. and Master&rsquo;s
          in Business
        </div>
        <ul className="list-disc pl-5 space-y-1 text-muted">
          <li>Former VP of Business Affairs, Dove Entertainment — television,
              film and publishing contracts</li>
          <li>Founded <b>The Publishing Mills</b>, an audio publishing company
              with roughly 200 titles</li>
          <li>Produced three Grammy-nominated works, including the{" "}
              <b className="text-cyan">Grammy-winning &ldquo;Crank Calls&rdquo;
              by Jonathan Winters</b></li>
          <li>President, Audio Publishers Association · Board of Governors, Los
              Angeles Chapter, National Academy of Recording Arts &amp; Sciences</li>
          <li>Founder, Big Happy Family, LLC — digital audio distribution</li>
          <li>Creator, editor and contributor, <i>Meeting Across the River</i>{" "}
              (Bloomsbury, 2005)</li>
        </ul>
      </div>

      <div className="card p-5 mt-4 text-xs text-muted leading-relaxed max-w-3xl">
        <b className="text-neon">Why this page exists.</b> We ask bands and crew
        to sign real paperwork, so it is fair that you know who wrote and reviewed
        it. Kaye &amp; Mills is counsel to UARX MixedReality Corp — they act for
        us, not for you. Nothing on this platform is legal advice to you, and you
        should have your own lawyer read anything before you sign it. Every
        agreement here is downloadable for exactly that reason.
      </div>
    </Page>
  );
}
