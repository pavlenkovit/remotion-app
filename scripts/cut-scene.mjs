// Cut one scene out of a long source video into public/clips/<slug>.mp4, so the
// social-video pipeline can consume it like any staged clip. Re-encodes (not a
// stream copy) so the cut is frame-accurate and starts/ends exactly where you
// asked — no leading black from a keyframe, no A/V drift.
//
// Usage:
//   npm run cut-scene -- /abs/path/to/source.mp4 <startSec> <endSec> <slug>
//
// Example:
//   npm run cut-scene -- ~/Downloads/office-bloopers.mp4 132.5 168.0 turtles-the-office
//
// Then set "clip": "clips/<slug>.mp4" in src/SocialVideo/videos/<slug>.json.
// public/clips is git-ignored, so the cut is never committed; the source stays
// wherever it lives on disk.
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const [, , srcArg, startArg, endArg, slugArg] = process.argv;
if (!srcArg || startArg === undefined || endArg === undefined || !slugArg) {
  console.error("Usage: npm run cut-scene -- /abs/path/to/source.mp4 <startSec> <endSec> <slug>");
  process.exit(1);
}

const src = resolve(srcArg);
if (!existsSync(src)) {
  console.error(`No such file: ${src}`);
  process.exit(1);
}

const start = Number(startArg);
const end = Number(endArg);
if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
  console.error(`Bad range: start=${startArg} end=${endArg} (need 0 <= start < end)`);
  process.exit(1);
}
const duration = end - start;
if (duration > 45) {
  console.warn(`⚠️  Scene is ${duration.toFixed(1)}s — social clips should be ≤40s. Cutting anyway.`);
}

const slug = slugArg.replace(/\.mp4$/i, "");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clipsDir = join(root, "public/clips");
mkdirSync(clipsDir, { recursive: true });
const out = join(clipsDir, `${slug}.mp4`);

// -ss before -i = fast keyframe seek; re-encoding then trims precisely to the
// requested start, so the cut is both quick (no full decode from 0) and accurate.
console.log(`Cutting ${start}s→${end}s (${duration.toFixed(2)}s) from ${src}`);
execFileSync(
  "npx",
  [
    "remotion", "ffmpeg", "-y",
    "-ss", String(start),
    "-i", src,
    "-t", String(duration),
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit", cwd: root },
);

console.log(`\n✓ ${out}`);
console.log(`  Set  "clip": "clips/${slug}.mp4"  in src/SocialVideo/videos/${slug}.json`);
