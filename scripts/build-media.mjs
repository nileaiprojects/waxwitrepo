// Download every reel from Google Drive, optimize for web, and generate posters.
// Writes scripts/media-manifest.json with final paths + dimensions for the site to consume.
// Usage: node scripts/build-media.mjs
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname;
process.chdir(ROOT);

const GDOWN = 'scripts/.venv/bin/gdown';
const RAW = 'assets/_raw';
const VIDS = 'assets/videos';
const POSTERS = 'assets/posters';
for (const d of [RAW, VIDS, POSTERS]) fs.mkdirSync(d, { recursive: true });

// Bottom-center Waxwit watermark (transparent PNG). If present, it's burned into every clip.
const WATERMARK = 'assets/brand/watermark.png';
const WM_OPACITY = 0.5;   // 0–1
const WM_WIDTH_FRAC = 0.38; // watermark width as fraction of video width

const src = JSON.parse(fs.readFileSync('scripts/sources.json', 'utf8'));
const items = [];
for (const cat of src.categories)
  for (const it of cat.items)
    items.push({ ...it, catSlug: cat.slug, catName: cat.name, base: `${cat.slug}__${it.file}` });

const probe = (p) => {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${p}"`
    ).toString().trim();
    const [w, h] = out.split('x').map(Number);
    return w && h ? { w, h } : null;
  } catch { return null; }
};

const manifest = [];
const failed = [];
let i = 0;
for (const it of items) {
  i++;
  const tag = `[${i}/${items.length}] ${it.base}`;
  const rawPath = `${RAW}/${it.base}.mp4`;
  const outPath = `${VIDS}/${it.base}.mp4`;
  const posterPath = `${POSTERS}/${it.base}.jpg`;

  // 0. local / no-driveId items (e.g. videos uploaded & watermarked locally):
  //    reuse the already-optimized, committed output if present; else fall back
  //    to a local source file (it.localSrc). Drive-backed items are unaffected.
  if (!it.driveId) {
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
      const fdim = probe(outPath) || { w: 0, h: 0 };
      if (!fs.existsSync(posterPath)) {
        try { execSync(`ffmpeg -y -loglevel error -ss 1 -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' }); }
        catch { execSync(`ffmpeg -y -loglevel error -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' }); }
      }
      console.log(`${tag} local/reuse existing -> ${fdim.w}x${fdim.h}`);
      manifest.push({
        category: it.catSlug, categoryName: it.catName, title: it.title,
        video: outPath, poster: posterPath,
        w: fdim.w, h: fdim.h, orientation: fdim.h >= fdim.w ? 'portrait' : 'landscape',
      });
      continue;
    }
    if (it.localSrc && fs.existsSync(it.localSrc) && (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 50000)) {
      fs.copyFileSync(it.localSrc, rawPath);
    }
  }

  // 1. download (skip if already a valid-sized raw)
  if (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 50000) {
    if (!it.driveId) { console.error(`${tag} no driveId, local source, or existing output`); failed.push({ ...it, reason: 'no-source' }); continue; }
    console.log(`${tag} downloading ${it.driveId}`);
    try {
      execFileSync(GDOWN, ['--no-cookies', '--quiet', '-O', rawPath,
        `https://drive.google.com/uc?id=${it.driveId}`], { stdio: 'inherit' });
    } catch {
      console.error(`${tag} DOWNLOAD FAILED`);
      failed.push({ ...it, reason: 'download' });
      continue;
    }
  } else {
    console.log(`${tag} raw exists, skip download`);
  }
  const dim = probe(rawPath);
  if (!dim) { console.error(`${tag} not a valid video`); failed.push({ ...it, reason: 'invalid' }); continue; }
  const portrait = dim.h >= dim.w;

  // 2. optimize (downscale only, never upscale; long edge -> 1280) + bottom-center watermark
  let outW, outH;
  if (portrait) { outH = Math.min(1280, dim.h); outW = Math.round(dim.w * outH / dim.h); }
  else { outW = Math.min(1280, dim.w); outH = Math.round(dim.h * outW / dim.w); }
  outW -= outW % 2; outH -= outH % 2; // libx264 needs even dimensions
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 10000) {
    console.log(`${tag} encoding (${dim.w}x${dim.h} -> ${outW}x${outH} ${portrait ? 'portrait' : 'landscape'})`);
    const enc = `-c:v libx264 -profile:v high -crf 26 -preset fast -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart`;
    if (fs.existsSync(WATERMARK)) {
      const wmW = Math.max(120, Math.round(outW * WM_WIDTH_FRAC));
      const margin = Math.round(outH * 0.045);
      const fc = `[0:v]scale=${outW}:${outH}[v];[1:v]scale=${wmW}:-1,format=rgba,colorchannelmixer=aa=${WM_OPACITY}[wm];[v][wm]overlay=(main_w-overlay_w)/2:main_h-overlay_h-${margin}`;
      execSync(`ffmpeg -y -loglevel error -i "${rawPath}" -i "${WATERMARK}" -filter_complex "${fc}" ${enc} "${outPath}"`, { stdio: 'inherit' });
    } else {
      execSync(`ffmpeg -y -loglevel error -i "${rawPath}" -vf "scale=${outW}:${outH}" ${enc} "${outPath}"`, { stdio: 'inherit' });
    }
  }
  // 3. poster (frame ~1s in)
  if (!fs.existsSync(posterPath)) {
    try {
      execSync(`ffmpeg -y -loglevel error -ss 1 -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' });
    } catch {
      execSync(`ffmpeg -y -loglevel error -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' });
    }
  }
  const fdim = probe(outPath) || dim;
  const sizeMB = (fs.statSync(outPath).size / 1048576).toFixed(2);
  console.log(`${tag} done -> ${fdim.w}x${fdim.h}, ${sizeMB} MB`);
  manifest.push({
    category: it.catSlug, categoryName: it.catName, title: it.title,
    video: outPath, poster: posterPath,
    w: fdim.w, h: fdim.h, orientation: portrait ? 'portrait' : 'landscape',
  });
}

fs.writeFileSync('scripts/media-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\nDONE. ${manifest.length} ok, ${failed.length} failed.`);
if (failed.length) console.log('FAILED:', JSON.stringify(failed.map(f => ({ base: f.base, id: f.driveId, reason: f.reason }))));
