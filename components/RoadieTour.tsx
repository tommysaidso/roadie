"use client";
import { TipsProvider, GuidedTour, TourStep } from "@/components/Tips";

const ARTIST_STEPS: TourStep[] = [
  { target: "", title: "Welcome to ROADIE",
    text: "The band's road kit — free for bands and fans. Sixty-second tour; rerun it anytime, skip it forever, your call." },
  { target: "ask", title: "Just ask",
    text: "The fastest way anywhere: ask ROADIE in plain words — find a gig, plot a runout, find a producer. No sign-in needed to ask." },
  { target: "map", title: "The live map",
    text: "Venues and bands across the region. Click a pin for capacity, genres, contact. This is where your next show is hiding." },
  { target: "tiles", title: "Your road kit",
    text: "Garage = your band profile, bio and promo. Notice Board = gigs and openers wanted. Sponsors = ROI deals. Community = the hashtags that get you hired." },
  { target: "tiles", title: "Businesses welcome too",
    text: "Host site, promoter, vendor or sponsor? The Sponsors and Business doors are yours — bid to host a ring stop, track what ROADIE sends you, and reach every band on the map." },
];

const BUSINESS_STEPS: TourStep[] = [
  { target: "", title: "Your account books",
    text: "Private business tracking — nothing here is public. Quick lay of the land." },
  { target: "biz-console", title: "Receipts, expenses, invoices",
    text: "Snap receipt photos, log expenses, watch tax totals build through the year, and invoice clients — the boring stuff, kept honest and in one place." },
];

/* The band's actual working tools. The landing tour explains what ROADIE is;
   this one explains the thing a band opens every week. */
const BAND_STEPS: TourStep[] = [
  { target: "", title: "Your gig bag",
    text: "Everything you carry to a show and everything you sell at one. Four stops. Esc to leave, and the ? button brings it back." },
  { target: "kit", place: "bottom", title: "Who is in the band",
    text: "Add each member and what they play. This is what a host sees when they are deciding whether you fit their room, and it is what fills your stage plot." },
  { target: "merch", place: "top", title: "What you sell",
    text: "List shirts, records, whatever is in the box. Prices sit next to your band on the map, so a fan can see it before they turn up." },
  { target: "rtv", place: "top", title: "Get on RTV",
    text: "Send a video you already have. It plays on RTV with your name, your town and a link straight back to you. No filming, no budget — just something you already own." },
];

/* Vendors and advertisers. Ben, 2026-08-10: the band and vendor tools are the
   ones that matter here. The whole point of this page is that a business owner
   hears "sponsor" and thinks charity, so the tour leads with the distinction. */
const VENDOR_STEPS: TourStep[] = [
  { target: "", title: "Advertising on ROADIE",
    text: "Four stops on what you would actually be buying, and why it is not a donation." },
  { target: "ad-vs-sponsor", place: "bottom", title: "These are two different things",
    text: "Sponsorship is money you give. Advertising is a product you buy out of a budget you already have. Same crew, same cameras — different pocket." },
  { target: "ad-products", place: "top", title: "What you can buy",
    text: "A spot, cut-downs of it, on-the-ring filming, or voice. Priced at what the work costs, not at what an agency charges to start from cold." },
  { target: "ring-spine", place: "top", title: "Why it is cheap to make",
    text: "The crew is already on the road shooting the ring. Your spot rides along with a tour that was happening anyway." },
  { target: "local-sponsor", place: "top", title: "Sponsorship stays local",
    text: "With advertising carrying the costs, sponsorship goes back to being what a local business actually wants — their name on the room down the street." },
];

export function RoadieArtistTour() {
  return <TipsProvider><GuidedTour steps={ARTIST_STEPS} storageKey="roadie_tour_done" /></TipsProvider>;
}
export function RoadieBusinessTour() {
  return <TipsProvider><GuidedTour steps={BUSINESS_STEPS} storageKey="roadie_biz_tour_done" /></TipsProvider>;
}
export function RoadieBandTour() {
  return <TipsProvider><GuidedTour auto={false} steps={BAND_STEPS} storageKey="roadie_band_tour_done" /></TipsProvider>;
}
export function RoadieVendorTour() {
  return <TipsProvider><GuidedTour auto={false} steps={VENDOR_STEPS} storageKey="roadie_vendor_tour_done" /></TipsProvider>;
}

/** The pill that brings any tour back. Put it on the page the tour describes. */
export function WalkMeThrough({ label = "? walk me through" }: { label?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("mmm:start-tour"))}
      title="Show me how this page works (Esc to leave)"
      className="fixed bottom-4 right-4 z-[60] rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs backdrop-blur-md transition hover:bg-white/10"
    >
      {label}
    </button>
  );
}
