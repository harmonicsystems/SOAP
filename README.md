# SOAP Note Builder

A local-first, offline-capable PWA for a school-based speech-language pathologist: collect
session trial data live and generate clean, EMR-pasteable SOAP notes fast.

**Live at:** https://soap.harmonic-systems.org

## How data is protected

- **No backend, no accounts, no network calls with data — ever.** Everything lives in your
  browser's IndexedDB, encrypted at rest.
- A passphrase you create on first run derives an AES-256 key (PBKDF2-SHA-256, 310,000
  iterations). Only the salt and an encrypted verification value are stored — never the
  passphrase or key.
- Every record is encrypted with AES-GCM and a fresh IV per write. The app auto-locks after
  15 minutes idle (configurable) and when the tab is hidden more than 5 minutes.
- Clients are identified by initials or short codes only — the app has no fields for names,
  birthdates, or school names.
- **Losing the passphrase means losing the data.** There is no recovery. Export backups
  regularly (Settings → Backup); browser storage can be evicted without warning.

## Local development

Requires Node 20 or 22.

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # vitest unit tests (crypto, backup, templates, note format, repo)
npm run build      # production build + gzip bundle-size gate (fails > 120 KB JS)
npm run preview    # serve the production build locally
npm run icons      # regenerate public/icon-*.png (only needed if the mark changes)
```

Tech: Svelte 5 + Vite, Dexie (IndexedDB), native WebCrypto, hand-rolled SVG charts, plain CSS,
vite-plugin-pwa. Hash-based routing (`#/clients`, `#/session/:id`) because GitHub Pages has no
SPA rewrites.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: install → test → build (with the
bundle-size gate) → deploy to GitHub Pages via `actions/deploy-pages`.

One-time repository setup:

1. Create the GitHub repo and push (for Harmonic Systems repos use the SSH alias:
   `git remote add origin git@github-harmonicsystems:harmonicsystems/SOAP.git`).
2. Repo **Settings → Pages** → Source: **GitHub Actions**.
3. After the first deploy, set the custom domain to `soap.harmonic-systems.org` (the build
   already ships `public/CNAME`) and check **Enforce HTTPS** once the certificate is issued.

DNS (at the harmonic-systems.org registrar):

```
CNAME  soap  →  harmonicsystems.github.io
```

## Backups

- **Export** (Settings → Backup, or the reminder banner) writes a single encrypted file,
  `soap-backup-YYYY-MM-DD.enc`, protected by the same passphrase.
- **Restore** on any device: create/unlock a vault, then Settings → Restore from backup. Choose
  replace (default) or merge (newer records win). You'll need the passphrase the backup was
  exported under.
- The header shows how old the last backup is; a banner nags when changes are more than 7 days
  newer than the last export.

## Performance budget

Total JS ≤ 120 KB gzipped, enforced by `scripts/check-bundle-size.mjs` in every build. No new
runtime dependencies without a size justification in a code comment.
