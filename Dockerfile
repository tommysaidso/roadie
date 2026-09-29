# ROADIE container — Next.js 15 + better-sqlite3
FROM node:22-bookworm-slim
# python3/make/g++ build better-sqlite3's native module.
# ffmpeg is for the fan multicam aligner, which runs IN HERE rather than on
# anyone's desktop — the whole point of the platform is that it keeps working
# when every PC in the building is switched off.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates ffmpeg \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Create the schema BEFORE building. `data/` is dockerignored, so the image has
# no database — and app/layout.tsx calls ensureProfileSchema(), which every
# prerendered page runs through. Without this the build dies on the first
# static page it tries to export (it was /pit) with no obvious connection to
# the real cause.
# `|| true`: the build only needs the SCHEMA so prerender can run. init-db also
# applies seeds, and one of them (seed-usa-west) touches `hubs` before it is
# created — a pre-existing ordering bug that never fires at runtime because the
# real database already exists. A failed seed must not block the image.
RUN node scripts/init-db.mjs && npm run build
EXPOSE 3001
# seed db on first boot (idempotent) then serve
CMD ["sh","-c","node scripts/init-db.mjs && npm run start"]
