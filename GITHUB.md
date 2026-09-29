# Putting ROADIE on GitHub

## One-time (Benjamin, owner)
The unzipped folder already has a git repo with the first commit. Create an empty
GitHub repo (no README/license — keep it empty), then:

```bash
cd roadie                       # the unzipped project folder
git branch -M main
git remote add origin https://github.com/<your-user>/roadie.git
git push -u origin main
```

## Add Dewey
GitHub → repo → Settings → Collaborators → Add people → Dewey's username.
He accepts the email invite.

## Dewey's first run
```bash
git clone https://github.com/<your-user>/roadie.git
cd roadie
cp .env.example .env            # fill keys (see PORTING.md)
npm install
npm run dev                     # http://localhost:3001
```

## Day-to-day
Branch → build → PR → merge. See CONTRIBUTING.md.

---

## Alternative: private download from your own domain (no GitHub)
ROADIE can hand out its own bundle behind a secret link:

1. Build/refresh a zip and place it on the server (e.g. `/volume2/docker/mymymy/roadie/dist/roadie.zip`).
2. In `.env`: set `ROADIE_DIST_PATH=/app/dist/roadie.zip` and `ROADIE_DOWNLOAD_TOKEN=<long-random-string>`.
3. Share: `https://roadie.mymymy.studio/api/grab?key=<token>` — Dewey clicks, downloads, unzips, `npm install`, `npm run dev`.

Wrong/no token returns 404, so the link stays private. Good for quick updates;
GitHub is still better for two-person co-development (history, PRs, diffs).
