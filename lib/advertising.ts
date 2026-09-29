// ADVERTISING — the product we were selling without naming.
//
// The distinction this file exists to hold, because getting it wrong loses
// deals:
//
//   SPONSORSHIP is our message. A brand backs the ring, their name goes on it,
//   and what the audience hears is ROADIE's story with their name attached.
//   That is a goodwill spend, it comes out of a marketing budget grudgingly,
//   and the first question is always "what do I get for it".
//
//   ADVERTISING is THEIR message. Their product, their offer, their words. We
//   write it, shoot it, cut it and run it — and they keep the files to use
//   anywhere they like. That is not goodwill, it is a line item they already
//   have, already budget for, and already buy from someone worse.
//
// Every conversation so far has offered the first when the buyer was asking
// for the second. A car dealer does not want to sponsor a music circuit; he
// wants a finance-offer spot shot in his own showroom, and he wants it running
// where his customers are. We can do that better than the local station because
// we already have the crew, the cameras and the rooms booked.
//
// Both products stay. They are sold to different budgets and should never be
// pitched as the same thing.

export type AdProduct = {
  key: string;
  label: string;
  what: string;              // what the buyer actually receives
  shoot: string;             // what we do to make it
  runs: string;              // where it plays
  keeps: string;             // what they own afterwards
  best: string;              // who it suits
  color: string;
};

/**
 * The advertising line — what we make and where it runs.
 *
 * No prices here on purpose. Rate-setting is Ben's call and his wording; the
 * site should describe the product honestly and let him put the numbers on it
 * rather than have a made-up rate card go out under his name.
 */
export const AD_PRODUCTS: AdProduct[] = [
  {
    key: "spot",
    label: "The Spot",
    what: "A finished 30-second commercial for your business — your offer, your words, your people.",
    shoot: "We script it with you, shoot it on location at your place, and cut it. One shoot day, cast and crew included.",
    runs: "RoadieTV between episodes, The Wire between tracks, and on the screens at every ring stop in your market.",
    keeps: "You own the master and every cut-down. Run it on TV, socials, your own site, wherever you like — forever.",
    best: "Any business with an offer to make and no ad they're proud of.",
    color: "#ff3d6e",
  },
  {
    key: "cutdowns",
    label: "The Set",
    what: "One shoot, many pieces: the 30, a 15, a 6-second bumper, and a stack of vertical cuts for social.",
    shoot: "Same shoot day, planned from the start to give you a season's worth of material instead of one clip.",
    runs: "Everywhere the spot runs, plus your own social calendar — the verticals are built for phones, not letterboxed from wide.",
    keeps: "The whole set, all masters, no expiry and no per-use fee.",
    best: "Businesses that post constantly and run out of things to post.",
    color: "#3df0ff",
  },
  {
    key: "onthering",
    label: "On the Ring",
    what: "Your ad shot AT the show — your brand in a room full of your actual customers, with a real crowd in frame.",
    shoot: "We're already there with the cameras up. Your spot gets made on ring night, in your own town.",
    runs: "RoadieTV, The Wire, ring screens, and the ring's own social channels where the crowd is already watching.",
    keeps: "The masters, plus the performance footage your spot sits inside.",
    best: "Local businesses who want to be seen as part of the night, not an interruption to it.",
    color: "#3ddc84",
  },
  {
    key: "voice",
    label: "The Read",
    what: "A radio-style read on The Wire — the cheapest way in, and the one that scales across a whole ring.",
    shoot: "Written and voiced by us, or read by you if you'd rather it be your own voice. Music bed included.",
    runs: "The Wire, between tracks, across whichever markets you buy.",
    keeps: "The audio master, usable on radio, podcast or hold music.",
    best: "A first buy, a seasonal push, or covering markets where a shoot isn't worth it.",
    color: "#b33dff",
  },
];

/**
 * The line that has to land in the first thirty seconds of any conversation.
 * Kept here so the page, the deck and the assistant all say it the same way.
 */
export const AD_PITCH_LINE =
  "We're not asking you to sponsor us. We make your advertising and we run it.";

/**
 * WHY A RING IS EASY TO SELL AS ADVERTISING AND HARD TO SELL AS SPONSORSHIP.
 *
 * This is the spine of the whole pitch, and it is structural rather than
 * persuasive — which is why it holds up in a room.
 *
 * A sponsor buys a NAME. Eight towns is not eight times better than one town,
 * because the name is the name. So sponsorship is a fixed goodwill spend,
 * argued for once a year, where every extra town is cost with no matching
 * return. Scaling it up makes it HARDER to say yes to.
 *
 * An advertiser buys CUSTOMERS. Eight towns is eight markets, and they already
 * hold a per-market ad budget — so taking the ring is not a new line item, it
 * is the line items they are already spending, pointed here instead of at the
 * local station. Scaling it up makes it EASIER to say yes to.
 *
 * And the part that closes it: our marginal cost of adding a market is close
 * to zero. The ring is already going there, the crew is already in the van,
 * the masters are already cut. So ring-wide can be priced cheaper PER TOWN
 * than a single town, which makes taking the whole ring the obviously correct
 * decision rather than an upsell. A station cannot do that — their cost per
 * market is real, so their price per market can only go up.
 */
export const RING_SPINE = [
  {
    q: "A sponsor buys a name. An advertiser buys customers.",
    a: "Eight towns is not eight times more name. It IS eight times more customers.",
  },
  {
    q: "Sponsorship is a new argument. Advertising is an existing budget.",
    a: "Nobody has to be talked into spending money they already spend — only into spending it here.",
  },
  {
    q: "Scaling up makes sponsorship harder and advertising easier.",
    a: "More towns means more cost and the same name, versus more towns and more customers.",
  },
  {
    q: "Our cost of adding a market is almost nothing.",
    a: "The ring is already going there. So the whole ring costs less per town than one town does.",
  },
];

/**
 * THE OTHER HALF: what pricing advertising this way DOES FOR SPONSORSHIP.
 *
 * If ring-wide advertising carries the revenue, sponsorship stops having to.
 * That is not a consolation — it is the point. Sponsorship has been forced to
 * behave like a revenue product, which is why the tiers ask a corner music shop
 * for market-partner money it does not have and does not enjoy spending.
 *
 * Freed from carrying the ring, sponsorship goes back to what it is actually
 * good at: a business on the main street of ONE town backing a band from that
 * same town. Their neighbours. The people who drink in the same bar. It is
 * small money, it is easy to say yes to, and it means something in a way a
 * logo on a regional poster never will.
 *
 * So the two products stop competing for the same pocket and start pointing in
 * opposite directions:
 *
 *   ADVERTISING scales UP   — regional and national budgets, whole rings.
 *   SPONSORSHIP scales DOWN — one shop, one band, one town.
 *
 * The advertiser pays for the ring to exist. The local sponsor adopts the band
 * that plays it. Neither one is asked to be the other.
 */
export const LOCAL_SPONSOR = {
  headline: "Back the band from your own town",
  line:
    "With advertisers funding the ring, sponsorship gets to be what it should always have " +
    "been — a local business standing behind local players. Not a tier. Your neighbours.",
  points: [
    {
      t: "One shop, one band",
      b: "Back a band from your town for the season. Your name travels with them to every stop on the ring.",
    },
    {
      t: "It stays in town",
      b: "The money goes to the band, not to a placement budget. You are paying players you could run into at the grocery store.",
    },
    {
      t: "Small enough to just do",
      b: "This is not a marketing decision that needs three meetings. It is the kind of thing a main-street business says yes to in one conversation.",
    },
    {
      t: "The soul of that stop",
      b: "Ring night in your town is your town's night. Being the business that made it happen reads differently to a room full of locals than any ad ever will.",
    },
  ],
};

export const AD_VS_SPONSOR = {
  advertising: {
    title: "Advertising",
    whose: "Your message",
    line: "Your product, your offer, your words. We write it, shoot it, cut it and run it — and you keep the files.",
    budget: "Comes out of the ad budget you already have.",
  },
  sponsorship: {
    title: "Sponsorship",
    whose: "Our message",
    line: "You back the ring and your name goes on it — the poster, the stage, the ring's own name.",
    budget: "Comes out of marketing or community spend.",
  },
};
