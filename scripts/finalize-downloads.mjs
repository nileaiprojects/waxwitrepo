// Pick up the rate-limited reels downloaded via the browser (in ~/Downloads),
// move + optimize them into the project, and refresh the manifest.
// origName = the exact Google Drive filename Chrome saves.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname;
process.chdir(ROOT);
const DL = path.join(os.homedir(), 'Downloads');
const RAW = 'assets/_raw', VIDS = 'assets/videos', POSTERS = 'assets/posters';

const ORIG = {
  'hotel-restaurants__park-inn-radisson': 'Parkinn by Radisson.mp4',
  'typography__lead-physician': 'Lead Physician.mp4',
  'typography__sn-capital': 'Sn capital.mp4',
  'typography__nile-technologies': 'Nile Technologies.mp4',
  'typography__care-exchange': 'Care Exchange intro.mp4',
  'promotional__hbx-group': 'HBX GROUP VIDEO 2.mp4',
  'promotional__promo-video': 'Video.mp4',
  'promotional__long-promo': 'Long Video one.mp4',
  'logo-animation__logo-main': 'Logo Animation Main.mp4',
  'logo-animation__ink-n-pixel': 'Ink n Pixel.mp4',
  'logo-animation__logo-reveal': 'Logo.mp4',
  'logo-animation__final-render': 'Final Render.mp4',
  'logo-animation__logo-animation-2': 'Logo animation.mp4',
  'logo-animation__logo-new': 'Logo new.mp4',
  'logo-animation__tech-adisa': 'LOGO Tech Adisa.mp4',
  'logo-animation__tribbiani-logo': 'Logo animation Tribbiani.mp4',
  'logo-animation__barrel-logo': 'Logo Barrel.mp4',
  'logo-animation__3d-logo-reveal-4k': '_Digital 3D Logo Reveal - FINAL (4K).mp4',
};

const norm = (s) => s.toLowerCase().replace(/\.mp4$/, '').replace(/[^a-z0-9]/g, '');
const probe = (p) => { try { const o = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${p}"`).toString().trim(); const [w, h] = o.split('x').map(Number); return w && h ? { w, h } : null; } catch { return null; } };
const dlFiles = fs.readdirSync(DL).filter((f) => /\.mp4$/i.test(f));
const findDownload = (orig) => {
  if (fs.existsSync(path.join(DL, orig))) return path.join(DL, orig);
  const target = norm(orig);
  // exact normalized, else startsWith (handles Chrome " (1)" suffixes)
  const hit = dlFiles.find((f) => norm(f) === target) || dlFiles.find((f) => norm(f).startsWith(target));
  return hit ? path.join(DL, hit) : null;
};

const src = JSON.parse(fs.readFileSync('scripts/sources.json', 'utf8'));
const manifest = fs.existsSync('scripts/media-manifest.json') ? JSON.parse(fs.readFileSync('scripts/media-manifest.json', 'utf8')) : [];
const have = new Set(manifest.map((m) => m.video));

const meta = {}; // base -> {title, catSlug, catName}
for (const cat of src.categories) for (const it of cat.items) meta[`${cat.slug}__${it.file}`] = { title: it.title, catSlug: cat.slug, catName: cat.name };

const stillMissing = [];
for (const [base, orig] of Object.entries(ORIG)) {
  const outPath = `${VIDS}/${base}.mp4`;
  if (fs.existsSync(outPath)) continue;
  const dl = findDownload(orig);
  if (!dl) { stillMissing.push(base); continue; }
  const rawPath = `${RAW}/${base}.mp4`;
  fs.copyFileSync(dl, rawPath);
  const dim = probe(rawPath);
  if (!dim) { stillMissing.push(base); continue; }
  const portrait = dim.h >= dim.w;
  const scale = portrait ? `scale=-2:'min(1280,ih)'` : `scale='min(1280,iw)':-2`;
  execSync(`ffmpeg -y -loglevel error -i "${rawPath}" -vf "${scale}" -c:v libx264 -profile:v high -crf 26 -preset fast -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${outPath}"`, { stdio: 'inherit' });
  const posterPath = `${POSTERS}/${base}.jpg`;
  try { execSync(`ffmpeg -y -loglevel error -ss 1 -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' }); }
  catch { execSync(`ffmpeg -y -loglevel error -i "${outPath}" -frames:v 1 -q:v 4 "${posterPath}"`, { stdio: 'inherit' }); }
  const fdim = probe(outPath) || dim;
  const m = meta[base];
  if (!have.has(outPath)) { manifest.push({ category: m.catSlug, categoryName: m.catName, title: m.title, video: outPath, poster: posterPath, w: fdim.w, h: fdim.h, orientation: portrait ? 'portrait' : 'landscape' }); have.add(outPath); }
  console.log(`recovered ${base} -> ${fdim.w}x${fdim.h}`);
}

// sort manifest to source order
const order = [];
for (const cat of src.categories) for (const it of cat.items) order.push(`${VIDS}/${cat.slug}__${it.file}.mp4`);
manifest.sort((a, b) => order.indexOf(a.video) - order.indexOf(b.video));
fs.writeFileSync('scripts/media-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`\nmanifest now ${manifest.length} clips. stillMissing(${stillMissing.length}): ${JSON.stringify(stillMissing)}`);
