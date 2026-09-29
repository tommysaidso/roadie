# Contributing to ROADIE

Two-person flow (Benjamin + Dewey):

1. `git pull` on `main`.
2. Branch: `git checkout -b feature/<short-name>`.
3. Build before pushing: `npm run build` (must pass).
4. Push and open a PR; the other reviews and merges.
5. Never commit `.env` — it's gitignored. Share keys out-of-band.

Conventions: keep the "AI" seams swappable (`lib/match.ts`, `lib/llm.ts`,
`lib/assistant.ts`, `lib/contract.ts`). SQLite is dev-only; production → Postgres.
See `PORTING.md` for setup and `docs/` for architecture.
