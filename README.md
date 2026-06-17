# Waxwit — Digital Marketing Studio website

A bold, colorful, single-page static site for **Waxwit**, a digital marketing studio.
The portfolio showcases the reels, brand films, motion graphics and logo animations Waxwit
has produced for its clients. Built with plain **HTML / CSS / vanilla JS** — no build step,
no framework, host anywhere.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works — `npx serve`, VS Code Live Server, etc. Opening `index.html`
directly via `file://` also works, but a server is recommended so video paths resolve cleanly.)

## Project structure

```
index.html            # all sections / markup
css/styles.css        # design system + all styles (brand colors & fonts are CSS variables at top)
js/data.js            # AUTO-GENERATED portfolio data (categories + clips). Do not hand-edit.
js/main.js            # nav, filtering, lightbox, marquees, scroll reveals, contact form
assets/
  videos/             # self-hosted, web-optimized .mp4 reels (committed)
  posters/            # poster thumbnails for each clip (committed)
  brand/              # logo / favicon
  _raw/               # raw Drive downloads (git-ignored; regenerated on demand)
scripts/
  sources.json        # source of truth: category -> clip -> Google Drive file ID
  build-media.mjs     # download from Drive + optimize (ffmpeg) + generate posters
  gen-data.mjs        # media-manifest.json -> js/data.js
  media-manifest.json # generated record of final clips + dimensions
```

## Editing content

- **Copy / sections** (hero, services, about, contact): edit `index.html`.
- **Services & client list**: edit the `SERVICES` and `CLIENTS` arrays in `js/main.js`.
- **Brand colors & fonts**: edit the CSS variables at the top of `css/styles.css`
  (`--c-pink`, `--c-violet`, fonts, etc.). The logo lives inline as SVG in `index.html`
  and as `assets/brand/favicon.svg`.
- **Contact details**: search `index.html` for `placeholder` — email, phone and the
  contact form (currently a demo) are flagged for you to fill in / wire up.

## Adding or replacing reels

1. Add an entry to the relevant category in `scripts/sources.json`
   (`{ "title", "file", "driveId" }`), or drop an `.mp4` into `assets/videos/`.
2. Regenerate media + data:

   ```bash
   # one-time: create the venv for gdown (Drive downloader)
   python3 -m venv scripts/.venv && scripts/.venv/bin/pip install gdown

   node scripts/build-media.mjs   # downloads any new IDs, optimizes, makes posters
   node scripts/gen-data.mjs      # rewrites js/data.js
   ```

Re-running is safe and incremental — already-downloaded/encoded files are skipped.

## How the videos got here

The original content lived on a Google Sites portfolio with Google-Drive-embedded reels.
The Drive file IDs were extracted from the page, downloaded with `gdown`, then transcoded
with `ffmpeg` (H.264, long edge ≤ 1280px, CRF 26, faststart) and given poster frames.
`scripts/sources.json` is the durable record of every clip and its Drive ID.

## Deploy

It's a static site — deploy the folder to Netlify, Vercel, GitHub Pages, Cloudflare Pages,
or any static host. No build command needed; publish directory is the project root.

> Heads-up: `assets/videos/` is a few hundred MB. For Git-based hosts consider
> [Git LFS](https://git-lfs.com/) (`git lfs track "assets/videos/*.mp4"`) or move the
> videos to a CDN and update the paths in `js/data.js`.
