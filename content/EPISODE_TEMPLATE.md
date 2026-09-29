# How Episode One is built

This is the spec for a ROADIE TV interactive episode, written from `roadietv-ep01.json`
after the fact. Episode 01 works and later attempts have not, so this documents the
structure exactly — including the parts that look optional and are not.

**The one-line version:** an episode is a fixed narrated spine plus a bank of pre-rendered
answers. It is not a script with an AI attached. The AI never writes narration at play
time; it only *chooses* which already-rendered audio to play.

---

## Why it is built this way

A viewer interrupts mid-episode and asks something. If you generate the answer live you
pay three to five seconds of dead air while the model thinks and the TTS renders — and
that silence breaks the illusion completely. The viewer stops believing they are talking
to a documentary and starts believing they are waiting on a chatbot.

So every likely question is answered **ahead of time and cached as audio**. On interrupt
we classify intent, pick one to three atoms, and play them back to back behind a short
connector. The answer starts in well under a second. Only a genuinely novel question
falls through to live generation, and that result gets cached the moment it exists.

**Everything below exists to serve that.** If you drop the atoms and connectors and just
write a script, you have a video, not an episode.

---

## The five components

### 1. `beats` — the spine

The fixed narration, in order. Episode 01 has **10 beats** against a
`runtime_target_sec` of **150**, so roughly **15 seconds each**.

```json
{
  "id": "b1",
  "cue": "OPEN",
  "vo": "Most of this country never gets a show. Not because nobody wants one...",
  "grounds": ["s01"],
  "shots": [
    "Main street of a small mountain town at dusk, the marquee over a shuttered music hall dark and empty, no one on the sidewalk.",
    "A two-lane highway running away into empty country at last light, hydro poles marching to the horizon, no headlights in either direction."
  ]
}
```

- `cue` — a human label (`OPEN`, `PROBLEM`, `FIX`…). For the editor, not the render.
- `vo` — the exact words. **Fixed. Approved once, then rendered.**
- `grounds` — source ids every claim traces back to. Not decoration; see §Grounds.
- `shots` — **exactly two, always.** Never one. See §Visual rules.

### 2. `atoms` — the answer bank

The part people miss. Each atom is a self-contained answer to a question a viewer might
interrupt with. Episode 01 has **14**.

```json
{
  "id": "a_economics",
  "topic": "the economics",
  "intent": ["how does it pay", "economics", "margin", "revenue", "numbers"],
  "vo": "The money comes off advertising...",
  "grounds": ["s03", "s05", "s08"]
}
```

- `intent` — the phrasings that route here. Write these as **things a person actually
  says**, not keywords. This list is the entire classifier.
- `vo` — a complete answer that stands alone. It may be played after another atom, so it
  cannot depend on what came before it.
- No `shots` — atoms are audio over whatever is on screen.

Episode 01's atoms, as a coverage checklist for a new episode:

| id | covers |
|---|---|
| `a_ask` | what we want from you |
| `a_built` | what already exists |
| `a_venue_no` | what if the venue says no |
| `a_no_alcohol` | why no alcohol |
| `a_competition` | who else does this |
| `a_economics` | how it pays |
| `a_advertising` | advertising vs sponsorship |
| `a_local_hire` | local jobs |
| `a_scale` | how big it gets |
| `a_bands` | what bands get |
| `a_label` | are you a label |
| `a_roadietv` | what RoadieTV is |
| `a_route` | the route itself |
| `a_risk` | what could go wrong |

The pattern: **the objections and the follow-ups**, not the topics. A good atom answers
something a sceptic asks, not something a brochure covers.

### 3. `connectors` — the latency mask

Six one-second bridges: *"Good question."*, and similar. They play the instant an
interrupt is detected, while classification finishes. This is what buys the sub-second
feel. Without them the join is audible.

```json
{ "id": "c_ack", "vo": "Good question.", "audio": "conn/c_ack.mp3", "sec": 1.17 }
```

### 4. `voice`

```json
{
  "provider": "gemini-tts",
  "name": "Charon",
  "style": "measured, dry, confident — a narrator who has been on the road, not an announcer"
}
```

`name` is what the renderer passes to the API and is the only field that changes the
sound. `style` is a note to whoever writes the next episode so the *writing* matches —
it is not sent to the model.

### 5. `interrupt_policy` — the guardrails

```json
{
  "on_interrupt": "Pause the spine, answer from the plan only, then offer to resume.",
  "reorder": "Remaining beats may be reordered so the ones matching the visitor's subject and intent play next.",
  "outside_scope": "Relate to an outside example ONLY to explain, then return to the plan. Never introduce a number, partner, date or claim that is not in the source.",
  "unknown": "Say the plan does not cover it and name who would know. Never invent."
}
```

`reorder` is the subtle one: after an interrupt about money, the money beats play next.
The episode reshapes itself around what the viewer cares about.

---

## Visual rules — the line that stops the nonsense

```
Every shot must read as LIVE MUSIC — stage, PA, lighting truss, instruments,
crowd or tour trucks visible. Never road construction, never camping or hiking,
never generic industry. Two shots per beat, cut between them; never one clip looping.
```

This exists because the video model was handed "the ring" and "a tent" and returned
**road construction and a camping tent**. It reads those words literally. The rule is a
negative constraint carried into every shot prompt, and it is not optional.

**Two shots per beat, cut between them.** One clip over fifteen seconds of narration
loops visibly and looks cheap.

### Writing a shot prompt

Look at the ones that worked. They are one sentence, concrete, and contain a subject, a
place, a time of day and a state:

> *Main street of a small mountain town at dusk, the marquee over a shuttered music hall
> dark and empty, no one on the sidewalk.*

Not "a sad small town". Name what is in frame and what light it is in.

---

## Grounds — every claim is traceable

`grounds: ["s03", "s05"]` on a beat or atom points at the source that backs it. Combined
with `interrupt_policy.unknown` ("never invent"), this is what keeps the episode honest
when a viewer pushes. If a line has no ground, it should not be in the episode.

---

## The build pipeline

```
content/roadietv-epNN.json          <- you write this, then set status: "approved"
        │
        │  node scripts/render-roadietv.mjs
        ▼
public/roadietv/epNN/
        vo/b1.mp3 … b10.mp3         <- one per beat
        atoms/a_*.mp3               <- one per atom
        conn/c_*.mp3                <- one per connector
        clips/                      <- two video clips per beat
        manifest.json               <- what the player reads
```

- **`status` must be `"approved"`** or the renderer refuses. Deliberate — rendering costs
  API quota and you do not want a half-written script burning it. `--force` overrides.
- TTS is `gemini-2.5-flash-preview-tts`, raw PCM wrapped to WAV, then **converted to mp3
  at 96k**. WAV is four times the bytes for identical speech; ship mp3 to browsers.
- The renderer writes `sec` (real measured duration via ffprobe) into the manifest. The
  player needs true lengths, not estimates.
- Veo's own audio is **stripped** from every clip — the voice-over is the only audio
  track.
- Quota exhaustion is handled by leaving gaps and telling you to rerun tomorrow. Reruns
  fill only what is missing.

### Re-rendering one line

You rarely want a full re-render: it burns quota and re-rolls the delivery of every other
line. To change one atom, render just that one with the same model and voice, then update
its `vo` and `sec` in `manifest.json`. That is how `a_economics` was changed to lead with
advertising without touching the other thirteen.

---

## Checklist for a new episode

1. Write **8–12 beats** to a runtime target (~15s of narration each).
2. Give every beat **two** shot prompts obeying the visual rules.
3. Write **12–16 atoms** — objections and follow-ups, each standing alone.
4. Give every atom **real spoken phrasings** in `intent`.
5. Reuse the **connectors** as-is; they are episode-independent.
6. Put **grounds** on everything. No ground, no line.
7. Copy `interrupt_policy` and `visual_rules` verbatim unless you have a reason.
8. Set `status: "approved"` only when the words are final.
9. Render. Check `manifest.json` has a `sec` on every entry — a missing one means that
   piece failed and the player will stumble there.

## The three things that make it feel alive

If a new episode feels flat next to Episode 01, it is almost always one of these:

1. **Not enough atoms.** Fewer than a dozen and the viewer hits "the plan doesn't cover
   that" quickly, which kills the illusion faster than a wrong answer would.
2. **Keyword intents instead of spoken ones.** `["revenue"]` fails where
   `["how does it pay", "what's the margin"]` works, because people ask questions, they
   do not type search terms.
3. **Atoms that depend on order.** An atom that opens "as I mentioned" breaks the moment
   it is the first thing played.
