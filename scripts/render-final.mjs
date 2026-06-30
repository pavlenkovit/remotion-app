// Renders finished social videos into out/final/<slug>.mp4.
//
// Usage:
//   npm run render:final                       # render every video in src/SocialVideo/videos/
//   npm run render:final -- say-my-name-breaking-bad   # render just one (by slug)
//
// Compositions are registered as `Social-<slug>` (see src/Root.tsx); the file
// name is the slug, so it's descriptive — never "social-video".
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = join(root, "src/SocialVideo/videos");

const all = readdirSync(videosDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(videosDir, f), "utf8")).slug);

const arg = process.argv[2];
const targets = arg ? all.filter((slug) => slug === arg) : all;

if (!targets.length) {
  console.error(arg ? `No video with slug "${arg}".` : "No videos found.");
  console.error(`Available: ${all.join(", ") || "(none)"}`);
  process.exit(1);
}

const outDir = join(root, "out/final");
mkdirSync(outDir, { recursive: true });

for (const slug of targets) {
  const out = join(outDir, `${slug}.mp4`);
  console.log(`Rendering Social-${slug} → ${out}`);
  execFileSync("npx", ["remotion", "render", `Social-${slug}`, out], {
    stdio: "inherit",
    cwd: root,
  });
}
