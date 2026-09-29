# ROADIE ↔ mymymy integration

## Principle
mymymy = source of truth for **works** (ISWC, variants, ISRCs, royalties).
ROADIE = source of truth for **road** (bands' public profile, venues, bookings, tours, sponsors).
They join on `bands.mymymy_artist_id`.

## How it works today
`lib/mymymy.ts` → `getBandWorks(bandId, mymymyArtistId)`:
1. If `MYMYMY_API_URL` is reachable, GET `/library/works?artist=<id>` (1.5s timeout).
2. Otherwise fall back to the local `works_cache` table (seeded mock).

`/api/works?bandId=` returns the works + a status flag, so the Garage & Discover pages
render the same whether mymymy is up or not.

## To go live against mymymy
1. Start mymymy: `cd D:\mymusicmymoneymyhustle\infra && docker compose up` (FastAPI on :8000).
2. Set `MYMYMY_API_URL=http://localhost:8000` in ROADIE's `.env`.
3. Confirm/seed `bands.mymymy_artist_id` values to match mymymy artist IDs.
4. (Optional) add a real `/library/works` endpoint in mymymy returning
   `{ works: [{ iswc, title, primary_genre, variant_count, hero_video, cover_url }] }`.

## Promo videos
mymymy holds the masters/variants in R2. ROADIE requests two promo renders per work:
- **kenburns** — static cover + slow pan (cheap, always-available).
- **living** — full motion clip.
Stored as `works_cache.hero_video` kind; the generation job is a future module.

## Shared identity (future)
Single sign-on so a band logs into ROADIE and mymymy with one account; ROADIE shows the
"road" tabs, mymymy shows the "money" tabs.
