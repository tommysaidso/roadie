# ROADIE — porting & co-dev guide (for Dewey + Benjamin)

ROADIE is the front-of-house app for BC bands: community, venues, AI booking, tour map,
sponsors, posters, and the public/fan side. It's the companion to **mymymy** (catalog,
ISWC/CWR registration, royalties). This guide gets it running on a fresh machine and set
up so two people can build on it together.

## 1. Prerequisites
- **Node.js 20+** (LTS) — https://nodejs.org
- **Git** — https://git-scm.com
- (Optional) **Docker Desktop** — only if deploying the container build.

## 2. Get the code
Either copy the `roadie` folder over, or clone the repo once it's pushed to GitHub:
```bash
git clone <your-repo-url> roadie
cd roadie
```

## 3. Configure
```bash
cp .env.example .env
```
Fill in `.env` (everything optional except it just runs leaner without keys):
- `MYMYMY_API_URL` — `https://app.mymymy.studio` (or `http://localhost:8000` in local dev).
- `GEMINI_API_KEY` — turns on live AI + Gemini voice for Ask ROADIE (else offline brain + browser voice).
- **Google (all under the `mymymy` Google Cloud project):**
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — enable *Maps JavaScript API* in the mymymy project, make a key, restrict it to `roadie.mymymy.studio` + `localhost`.
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from the mymymy OAuth client (already present if you copied mymymy's `.env`).
  - `GOOGLE_REFRESH_TOKEN` — generate once (Gmail + Drive scopes) via the OAuth Playground, paste it in. Enables emailing pitch sheets/contracts and saving posters to Drive.

> The `.env` is gitignored — secrets never get committed. Share keys out-of-band.

## 4. Run (dev)
```bash
npm install        # builds the native SQLite module for this machine
npm run dev        # http://localhost:3001  (auto-seeds the SQLite DB first run)
```
Reset/reseed the sample data anytime: `npm run db:reset`.

Windows shortcut: double-click `launch.bat` (installs on first run, starts, opens the browser).

## 5. Deploy (live, on the mymymy domain)
The tunnel + DNS are already set: `roadie.mymymy.studio → roadie-web:3001`.
On the NAS stack:
```bash
# copy this folder to /volume2/docker/mymymy/roadie  then in UGOS Container Manager:
# mymymy project -> Down -> Build -> Start
```
(`docker-compose.nas.yml` in the mymymy repo already has the `roadie` service.)

## 6. Project map
```
app/            Next.js routes (pages + /api/* handlers)
  garage venues board map discover sponsors calendar crossing roadie poster
  backend/      venue + advertiser consoles
  api/          bands venues slots notices match book sponsors roi works
                calendar assistant tour opportunities crossing voice google/*
components/      Shell (mobile-first nav), maps, poster studio, chat, widgets
lib/            db (SQLite), schema.sql, match (AI placement), contract,
                assistant + llm + context, mymymy adapter, google, opportunities
scripts/        init-db.mjs (+ seed-international.mjs)
docs/           ARCHITECTURE, INTEGRATION, ROADMAP
```

## 7. Co-developing
- `main` is the shared branch. Each person works on a feature branch, opens a PR.
- The "AI" pieces are deliberately simple, swappable seams: `lib/match.ts` (placement),
  `lib/assistant.ts` + `lib/llm.ts` (brain), `lib/contract.ts`, `components/PosterStudio.tsx`.
- SQLite is for local/dev. For multi-user production, migrate `lib/db.ts` to Postgres
  (mymymy already runs Postgres — ROADIE can share an instance).

## 8. What's stubbed vs live
- Live now: all modules on seeded BC data, AI placement, posters, mobile UI, offline map.
- Switches on with a key: Gemini brain/voice, Google Maps, Gmail/Drive, live mymymy catalog.
- Next up (see docs/ROADMAP.md): accounts/auth, promo-video generation, e-sign contracts,
  drive-time routing, multi-tenant + Postgres.
