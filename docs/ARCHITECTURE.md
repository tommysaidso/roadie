# ROADIE — Architecture

## Where ROADIE sits

```
            ┌─────────────────────────────┐         ┌──────────────────────────────┐
   PUBLIC   │           ROADIE            │  works  │            mymymy            │
  VENUES ──▶│  community · venues · book  │◀───────▶│  catalog · ISWC · CWR · $$   │
   BANDS    │  tour map · sponsors · AI   │  /api   │  variants · royalties        │
 SPONSORS   │  Next.js 15 + SQLite (3001) │         │  FastAPI + Postgres (8000)   │
            └─────────────────────────────┘         └──────────────────────────────┘
                 FRONT OF HOUSE (the road)                THE MONEY (the catalog)
```

ROADIE never touches ISWC/CWR/royalty logic — it **reads** a band's works from mymymy
for the public profile & promo, and owns everything about getting that band on a stage.

## Data model (SQLite — `lib/schema.sql`)

- **Identity:** `users`, `bands` (+ `mymymy_artist_id` link), `venues`
- **Booking:** `venue_slots` → `bookings` → `contracts` (auto-generated BC agreement)
- **Community:** `notices` (touring / gig_gap / seeking_opener / runout …)
- **Touring:** `tours`, `tour_stops`
- **Money in:** `sponsors`, `ad_placements` (ROI), `perks` (hotel nights / van days / gear / tabs)
- **Promo:** `works_cache` (thin mirror of mymymy works + promo video kind)
- **Knowledge:** `region_rules` (BC liquor / minors / noise / routing)

## The "AI" pieces (heuristic now, LLM-ready)

| Piece | File | Swap-in |
|---|---|---|
| Smart placement (band ↔ slot scoring) | `lib/match.ts` | keep heuristic as features → LLM/ranker |
| Auto-contract | `lib/contract.ts` | template → e-sign provider |
| ROADIE assistant | `lib/assistant.ts` | rule router → Claude + tool calls + voice (Cartesia) |
| Tour routing | `app/map` + seed loop | heuristic loop → real drive-time optimizer |

Each is deterministic so the app runs **fully offline** for demos; each is a clean seam
to drop a real model behind.

## API surface (`app/api/*`)

`bands` · `venues` · `slots` · `notices` · `match` · `book` · `sponsors` · `roi` ·
`works` (mymymy adapter) · `calendar` · `assistant` · `tour`

## Roadmap

1. **Now (this scaffold):** all modules runnable on mock BC data, SQLite, heuristic AI.
2. Real accounts/auth (band vs venue vs booker vs sponsor vs public front/back ends).
3. Live mymymy link (`MYMYMY_API_URL`) → real catalogs on profiles.
4. Claude + voice behind `Ask ROADIE`; OCR/voice intake for venue avails.
5. Promo video generation (Ken-Burns + living clip) from mymymy masters.
6. Real e-sign contracts; Stripe for sponsor billing; ROI attribution from bookings.
7. Postgres + multi-tenant; deploy (Vercel/Fly + Neon), or Cloudflare (Workers/D1/R2).
