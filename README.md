# ROADIE

**The band's road kit.** ROADIE is the front-of-house web app that connects northern &
interior BC bands to venues, sponsors, and their public — and lets a band **be its own
bookie and manager**. AI does the booking, the routing, and the busywork.

It is the companion to **mymymy** (`D:\mymusicmymoneymyhustle`), which owns the *money*
side: catalog, ISWC/CWR registration, AI variants, and royalties. ROADIE owns the
*road* side: community, venues, touring, sponsorship, and the public-facing promo.

> Hub: **Kelowna, BC** — built/run by Dewey Mitchell. Goal: connect the bands in the
> north and interior that aren't in the Vancouver basin.

## Modules

| Module | What it does |
|---|---|
| **Garage / Studio** | Each band's road kit — clean profile, AI-polished bio, catalog (from mymymy), promo videos (Ken-Burns + living clip). |
| **Venues** | Rooms, capacities, open slots; **AI smart-placement** drops the right band into each empty night. |
| **Notice Board** | Community wall — who's touring where, gig gaps, runouts, openers wanted. No over-marketing. |
| **Tour Map** | Interactive BC map; plot the Okanagan runout loop. Offline SVG, no tiles. |
| **Discover** | Public face — fans find bands by frontage + music videos. |
| **Sponsors / ROI** | Liquor reps, music stores, hotels, van-rentals; live ROI dashboard + claimable tour perks. |
| **Calendar** | Auto-calendar of bookings + every open slot. Booking writes here automatically. |
| **Border & Visas** | Tour across CA/US/MX: visa/work route, tax withholding, gear carnet, port-of-entry - each linked to the official source, plus your immigration contact (Derwin Jordan). |
| **Ask ROADIE** | AI tour-manager: finds slots, routes runouts, knows BC rules, surfaces perks. Voice-ready. |
| **Auto-contracts** | One-click BC performance agreement generated on booking. |

## Run it (Windows / local dev)

```bash
cd roadie
npm install          # builds better-sqlite3 native module for your machine
npm run db:init      # creates + seeds data/roadie.db (Kelowna/BC mock data)
npm run dev          # http://localhost:3001
```

`npm run dev` auto-seeds first. To wipe & reseed: `npm run db:reset`.

> **Note:** `node_modules` is intentionally NOT shipped — `better-sqlite3` is a native
> module and must be built on your machine. Just run `npm install` once.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind 3 · better-sqlite3 · lucide-react · SWR —
matching mymymy's web stack. SQLite for local dev; swap to Postgres for multi-tenant.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/INTEGRATION.md](docs/INTEGRATION.md).
