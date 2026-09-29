// OUTREACH — the advertising drip, and the language every touchpoint shares.
//
// Written to be sent BY BEN, not by the platform. Nothing in here goes out on
// its own: the console renders it, he reads it, he sends it. Outward comms are
// his voice and his call, and a drip that fires itself is exactly how a
// half-right sentence reaches a client under his name.
//
// The whole sequence is built on one correction: we had been asking businesses
// to SPONSOR when they had an ADVERTISING budget sitting there unspent. Every
// mail below leads with their message, not ours.
//
// House style, from how he actually writes: short, raw, direct, no throat
// clearing, no "I hope this finds you well", no closing paragraph that repeats
// the opening one. Jokes stay in.

export type DripMail = {
  key: string;
  when: string;                // when to send it
  subject: string;
  body: string;
  why: string;                 // what this one is for — shown in the console
};

const SIGN = `Ben Easterday
EV Entertainment & Production Group
roadie.mymymy.studio`;

/**
 * The advertiser sequence.
 *
 * Deliberately four mails. A local business owner does not read a nurture
 * sequence; he reads the first one, ignores two, and answers the one that
 * happens to land the week he was thinking about it anyway. So each one has to
 * stand alone and make the same offer in a different way, rather than build on
 * the last.
 */
export const ADVERTISER_DRIP: DripMail[] = [
  {
    key: "open",
    when: "Day 0 — the first contact",
    subject: "We make the ad, not the ask",
    why: "Kills the sponsorship assumption in the first line, before they file it under charity.",
    body: `Hi {{name}},

Quick one, and it's not a sponsorship ask.

We run a touring circuit through {{market}} — real rooms, real crowds, cameras already up. What we actually sell is advertising: we write and shoot your commercial at your place, cut it, and run it across the circuit. Your offer, your words, your people.

And you keep the files. Master and every cut-down, yours forever, run them anywhere you like.

Most people we talk to hear "music circuit" and reach for the community budget. This isn't that. This comes out of the ad money you already spend, and you end up with something better than what you're spending it on now.

Worth ten minutes?

${SIGN}`,
  },
  {
    key: "ring",
    when: "Day 5 — if no reply",
    subject: "The whole ring costs less per town than one town",
    why: "The structural argument. This is the one that moves a regional buyer from one market to all of them.",
    body: `Hi {{name}},

One thing worth knowing if you're weighing this up.

Buying one town is the expensive way to do it. We're already going to every stop on the ring — same crew, same shoot, same masters — so adding markets barely costs us anything, and the price per town drops hard as you add them.

A station can't do that. Their cost goes up with every market, so their price does too.

That means taking the whole ring is usually the cheaper decision per customer reached, not the bigger one. It's the opposite of how this normally works.

Happy to put a number in front of you for {{market}} alone and for the full ring, so you can see the gap.

${SIGN}`,
  },
  {
    key: "own",
    when: "Day 12 — if still no reply",
    subject: "What you actually own at the end of it",
    why: "For the buyer who is comparing us to their current radio or TV contract on price alone.",
    body: `Hi {{name}},

Different angle on this one.

Whatever you're spending on advertising right now — when the contract ends, what do you still have? With most stations the answer is nothing. You rented attention and it's gone.

Everything we shoot for you is yours. The 30, the cut-downs, the vertical stuff for socials, all the masters. Run them on another station, on your own site, on your phone, in five years. No usage window, no re-licensing, no asking us.

So the spend stops being rent and starts being something you own.

If you want, send me what you're paying now and I'll tell you straight whether we can beat it. If we can't I'll say so.

${SIGN}`,
  },
  {
    key: "local",
    when: "Day 20 — the soft close",
    subject: "Ring night in {{market}}",
    why: "The emotional close, and the one that works on a main-street business who wants to be part of the night.",
    body: `Hi {{name}},

Last one from me on this.

When the ring plays {{market}}, it's a room full of people who live there. Your customers, mostly. We can shoot your spot that night, in that room, with that crowd in it — which lands differently than an ad cut in a studio somewhere and dropped into a break.

If the advertising side isn't for you, there's a smaller version: back one of the bands from your own town for the season. Your name travels with them to every stop on the ring, and the money goes to the players rather than a placement budget. Costs a fraction of an ad buy and means more to the people in that room.

Either way — say the word and I'll send what it looks like.

${SIGN}`,
  },
];

/**
 * The one-paragraph version, for anywhere a full mail is too much — a text, a
 * DM, the top of a deck, the thing you say when someone asks what you do.
 */
export const ADVERTISER_SHORT =
  `We're not asking you to sponsor us. We run a touring circuit and we make advertising ` +
  `for the businesses in the towns it plays — we script it, shoot it at your place, cut ` +
  `it and run it across the ring, and you keep every file forever. It comes out of the ` +
  `ad budget you already have, and the whole ring costs less per town than buying one town.`;

/** Fill {{name}} / {{market}} without dragging in a template engine. */
export function fillMail(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
