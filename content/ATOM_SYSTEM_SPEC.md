# The Atom System — a portable spec

Self-contained description of the interactive-media pattern built for ROADIE TV,
written so it can be rebuilt somewhere else, for a different purpose, without
this codebase. Nothing below depends on ROADIE — the domain words are just
examples.

Hand this whole file to an assistant in another project and say *"build me this,
for X."*

---

## 1. What it is

Media that can be **interrupted mid-play and answer for itself**, then carry on
— and, if asked, navigate itself to the part you now care about.

Not a chatbot beside a video. Not a transcript search. The media knows its own
argument, and the answers are *part of the work*, authored and approved like the
script.

**The trick that makes it feel alive:** every likely answer is written and
rendered to audio **ahead of time**. Generating live costs 3–5 seconds of dead
air, and that silence is what makes a viewer stop believing and start waiting.
Pre-rendered, an answer begins in under a second.

Everything else in this spec exists to serve that one property.

---

## 2. The five parts

### Spine (`beats`)

The fixed narration, in order. What plays if nobody interrupts.

```json
{
  "id": "b1",
  "cue": "OPEN",
  "vo": "The words spoken, verbatim.",
  "grounds": ["s01"],
  "shots": ["one sentence: subject, place, time of day, state",
            "a DIFFERENT angle — never one clip looping"]
}
```

Target ~15 seconds of narration per beat; 8–12 beats for a 2–3 minute piece.

### Atoms — **the part people miss**

Self-contained answers to things a viewer might interrupt with. This *is* the
interactivity. A piece with a spine and no atoms is a video.

```json
{
  "id": "a_economics",
  "topic": "how it pays",
  "intent": ["how does it pay", "what's the margin", "where does the money come from"],
  "vo": "A complete answer that stands alone.",
  "grounds": ["s03", "s05"],
  "jump_to": "b7",
  "voice": "Fenrir",
  "character": "the promoter"
}
```

Three rules, each learned by breaking it:

1. **Must stand alone.** Atoms play in any order and may be chained. Anything
   opening "as I mentioned" breaks the moment it plays first.
2. **Intents are spoken phrasings, not keywords.** `"revenue"` fails where
   `"how does it pay"` works. People ask questions; they don't type search terms.
3. **Cover objections, not topics.** The atoms that earn their place answer what
   a sceptic asks, not what a brochure covers.

`jump_to` names the beat where that subject lives in the spine, which turns
*"take me to that bit"* into a lookup instead of a guess.

`voice` + `character` let an atom be a **different person**. A second voice
answering a different kind of question reads as a cast rather than a narrator
doing accents, and costs nothing but naming another prebuilt voice.

### Connectors — the latency mask

Six one-second bridges: *"Good question."*, *"Right —"*. They play the instant an
interrupt is detected, while classification finishes. This is what buys the
sub-second feel. Without them the join is audible. **Episode-independent — write
once, reuse forever.**

### Voice

```json
{ "provider": "gemini-tts", "name": "Charon",
  "style": "measured, dry — a narrator who has been on the road, not an announcer" }
```

`name` is the only field that changes the sound. `style` is a note to whoever
writes the next one, so the *writing* matches.

### Policy

```json
{
  "on_interrupt": "Pause the spine, answer from the plan only, then offer to resume.",
  "reorder": "Remaining beats may be reordered so the ones matching the visitor's subject play next.",
  "outside_scope": "Relate to an outside example ONLY to explain, then return. Never introduce a number, partner, date or claim that is not in the source.",
  "unknown": "Say the plan does not cover it and name who would know. Never invent."
}
```

`reorder` is the subtle one: after a question about money, the money beats play
next. The piece reshapes itself around the viewer's interest. This is the thing
frame-level systems (X-Ray and similar) structurally cannot do — they index
*what is on screen now*; this knows *what the whole work argues*.

---

## 3. Two files, and never confuse them

```
source.json        THE WORDS. Human-edited. Truth for text.
manifest.json      THE RENDER. Audio paths + measured durations. Machine-written.
```

An atom in the source with no audio in the manifest **is not real yet** — the
player has nothing to reach for. Any editor must show that difference rather
than hide it. This is the single most common way one of these ships broken.

Gate rendering on `status: "approved"`. Rendering costs API quota and you do not
want a half-written draft burning it.

---

## 4. Matching — the genuinely hard part

Infinite phrasings, finite atoms. Ladder, fastest first:

| Step | Cost | Notes |
|---|---|---|
| 1. Literal hit on an intent phrase | ~0ms | keyword overlap, with a singular/tense fold |
| 2. Vector similarity over atom embeddings | ~1ms local | after one small embedding call |
| 3. Live generation | seconds | cache the result immediately |

**Ship the embeddings inside the manifest.** Embed each atom once at render
time; embed the question at ask time; cosine similarity in the browser. Semantic
similarity does the generalising you would otherwise do by hand.

Size: 14 atoms × 768 dims × 4 bytes ≈ **43KB**, or ~11KB at int8. No vector
database, no service, nothing to keep alive. The piece carries its own brain.

**Pin the embedding model** and store its name in the manifest. Vectors from two
model versions are not comparable, and a silent upgrade breaks matching quietly.

### The growth loop

Cache live answers keyed by the question's **embedding, not its text**, so
"how much does it cost" and "what's the price" hit one entry. Anything asked
more than N times gets promoted into a real atom, rendered in the voice, and
joins the bank permanently.

**You never have to enumerate phrasings.** Real viewers tell you, and the
fallthrough rate falls toward zero on its own. Gate promotion on human approval —
those are words going out in the work's voice.

### Back-references

*"Wait, what about what we just talked about"* needs a short stack of the last
few atoms and beats played. When a question contains a back-reference
(*"that"*, *"what you just said"*, *"go back to"*), resolve against the stack
instead of the whole bank. Cheap to build, and it is most of the difference
between feeling alive and feeling dumb.

---

## 5. What the picture does while it answers

Pausing every time is jarring. Scale it to answer length:

| Answer | Behaviour |
|---|---|
| under ~5s | **hold frame**, duck the bed — barely a seam |
| 5–20s | **defocus / blur**, duck — clearly an aside, still moving |
| over 20s | **full pause** — it is a real conversation now |

Full-pausing for a six-word answer makes it feel like a kiosk.

---

## 6. Authoring surface (what to build for the operator)

- List atoms with a **rendered / not-rendered** badge and real duration
- Edit id, topic, intents (one per line), answer, grounds, jump-to, character
- **Voice one atom** without re-rendering the whole piece — a full re-render
  burns quota and re-rolls every other line's delivery
- **Record a take** in the browser, then either keep that voice or transcribe it
  and re-render the words in the work's voice. (True timbre-morph to a prebuilt
  TTS voice is not available — but a real take's phrasing and emphasis is what
  actually makes a line sound human, and that transfers.)
- **Warn before rendering** on the three failure modes below

Save writes the source only, never the manifest, write-then-rename. Rendering
must save first, or it voices stale words.

---

## 7. Why re-implementations feel flat

Almost always one of these three:

1. **Too few atoms.** Under about a dozen and viewers hit "the plan doesn't
   cover that" fast, which breaks the illusion harder than a wrong answer.
2. **Keyword intents.** See rule 2 above.
3. **Order-dependent atoms.** See rule 1.

A fourth, if it applies: **no connectors**, so every answer starts with an
audible gap.

---

## 8. Pipeline

```
source.json  --(TTS per beat / atom / connector)-->  audio files
             --(video gen or stock per shot)------>  clips
             --------------------------------------> manifest.json
```

- TTS returns raw PCM; wrap to WAV, then mp3 (~a quarter the bytes for identical
  speech). **Have a WAV fallback** — a box without ffmpeg must still be able to
  voice a line rather than erroring.
- Write **measured** durations into the manifest, never estimates. The player
  schedules against them.
- Strip generated video's own audio; the narration is the only audio track.
- On quota exhaustion, leave gaps and report them. Re-runs fill only what is
  missing.

### Shots: four sources, in order of what to try

1. **Licensed stock** — a real shot beats a generated one, costs nothing extra
2. **Generated** — for what cannot be bought
3. **Stock as a reference, then generate** — when words cannot pin a specific
   thing (an exact vehicle, a real storefront), feed a photo and generate *from*
   it
4. **Shot for real** — worth more than any of the above

Write the shot prompt first regardless of source: it is the same sentence
whether it becomes a generation prompt or a stock search.

---

## 9. Minimum viable build order

1. source + manifest, one voice, 8 beats, 12 atoms, 6 connectors
2. player: spine playback, interrupt, connector, atom, resume
3. keyword matching (ship this — it works for the first hundred questions)
4. embeddings in the manifest + local similarity
5. conversation stack for back-references
6. hold-frame / blur instead of always pausing
7. promotion loop

Steps 1–3 are a working product. Everything after is polish that compounds.
