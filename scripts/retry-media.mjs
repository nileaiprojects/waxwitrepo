// Retry the reels that Google Drive rate-limited during the first pass.
// Idempotent: only touches items whose optimized video is still missing.
// Uses cooldowns between attempts to get past Drive's "too many accesses" throttle.
// Usage (background recommended): node scripts/retry-media.mjs
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname;
process.chdir(ROOT);
const GDOWN = 'scripts/.venv/bin/gdown';
const RAW = 'assets/_raw', VIDS = 'assets/videos', POSTERS = 'assets/posters';
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const probe = (p) => { try { const o = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${p}"`).toString().trim(); const [w, h] = o.split('x').map(Number); return w && h ? { w, h } : null; } catch { return null; } };

const src = JSON.parse(fs.readFileSync('scripts/sources.json', 'utf8'));
const manifest = fs.existsSync('scripts/media-manifest.json')
  ? JSON.parse(fs.readFileSync('scripts/media-manifest.json', 'utf8')) : [];
const have = new Set(manifest.map((m) => m.video));

// Build ordered list of items still missing
const missing = [];
for (const cat of src.categories)
  for (const it of cat.items) {
    const base = `${cat.slug}__${it.file}`;
    if (!fs.existsSync(`${VIDS}/${base}.mp4`)) missing.push({ ...it, catSlug: cat.slug, catName: cat.name, base });
  }
console.log(`${missing.length} clips to recover.`);

async function download(it) {
  const rawPath = `${RAW}/${it.base}.mp4`;
  if (fs.existsSync(rawPath) && fs.statSync(rawPath).size > 50000) return true;
  const delays = [0, 20, 45, 90, 150, 240]; // cooldowns between attempts (seconds)
  for (let a = 0; a < delays.length; a++) {
    if (delays[a]) { console.log(`  cooldown ${delays[a]}s…`); await sleep(delays[a]); }
    try {
      execFileSync(GDOWN, ['--no-cookies', '--quiet', '-O', rawPath,
        `https://drive.google.com/uc?id=${it.driveId}`], { stdio: 'pipe' });
      if (fs.existsSync(rawPath) && fs.statSync(rawPath).size > 50000) return true;
    } catch (e) {
      console.log(`  attempt ${a + 1} failed`);
    }
  }
  return false;
}

const stillFailed = [];
let i = 0;
for (const it of missing) {
  i++;
  console.log(`[${i}/${missing.length}] ${it.base}`);
  const ok = await download(it);
  if (!ok) { stillFailed.push(it.base); console.log(`  GIVE UP ${it.base}`); continue; }
  const rawPath = `${RAW}/${it.base}.mp4`, outPath = `${VIDS}/${it.base}.mp4`, posterPath = `${POSTERS}/${it.base}.jpg`;
  const dim = probe(rawPath);
  if (!dim) { stillFailed.push(it.base); continue; }
  const portrait = dim.h >= dim.w;
  const scale = portrait ? `scale=-2:'min(1280,ih)'` : `scale='min(1280,iw)':-2`;
  execSync(`ffmpeg -y -loglevel error -i "${rawPath}" -vf "${scale}" -c:v libx264 -profile:v high -crf 26 -preset fast -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${outPath}"`, { stdio: 'inherit' });
  try { execSync(`ffmpeg -y -loglevel error -ss 1 -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' }); }
  catch { execSync(`ffmpeg -y -loglevel error -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' }); }
  const fdim = probe(outPath) || dim;
  if (!have.has(outPath)) {
    manifest.push({ category: it.catSlug, categoryName: it.catName, title: it.title, video: outPath, poster: posterPath, w: fdim.w, h: fdim.h, orientation: portrait ? 'portrait' : 'landscape' });
    have.add(outPath);
  }
  console.log(`  recovered -> ${fdim.w}x${fdim.h}`);
}

// re-sort manifest to source order
const order = [];
for (const cat of src.categories) for (const it of cat.items) order.push(`${VIDS}/${cat.slug}__${it.file}.mp4`);
manifest.sort((a, b) => order.indexOf(a.video) - order.indexOf(b.video));
fs.writeFileSync('scripts/media-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\nDONE. manifest now ${manifest.length} clips. stillFailed: ${stillFailed.length}`);
if (stillFailed.length) console.log(JSON.stringify(stillFailed));
