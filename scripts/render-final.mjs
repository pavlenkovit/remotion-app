// Renders finished social videos into out/final/<slug>-<lang>.mp4 — one per
// (video × native language). Compositions are `Social-<lang>-<slug>` (src/Root.tsx).
//
// Usage:
//   npm run render:final                     # every video, every language
//   npm run render:final -- <slug>           # one video, every language
//   npm run render:final -- <slug> <lang>    # one video, one language
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = join(root, "src/SocialVideo/videos");
const generated = JSON.parse(readFileSync(join(root, "src/Dictionary/words.generated.json"), "utf8"));
const LANGS = Object.keys(generated); // languages we actually generated data for

const slugs = readdirSync(videosDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(videosDir, f), "utf8")).slug);

const slugArg = process.argv[2];
const langArg = process.argv[3];
const targetSlugs = slugArg ? slugs.filter((s) => s === slugArg) : slugs;
const targetLangs = langArg ? LANGS.filter((l) => l === langArg) : LANGS;

if (!targetSlugs.length || !targetLangs.length) {
  console.error(`No match. Videos: ${slugs.join(", ") || "(none)"}; langs: ${LANGS.join(", ")}`);
  process.exit(1);
}

const outDir = join(root, "out/final");
mkdirSync(outDir, { recursive: true });

for (const slug of targetSlugs) {
  for (const lang of targetLangs) {
    const out = join(outDir, `${slug}-${lang}.mp4`);
    console.log(`Rendering Social-${lang}-${slug} → ${out}`);
    execFileSync("npx", ["remotion", "render", `Social-${lang}-${slug}`, out], {
      stdio: "inherit",
      cwd: root,
    });
  }
}
