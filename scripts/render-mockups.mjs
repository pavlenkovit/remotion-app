// Renders the phone-mockup videos the social videos play — one per
// (highlight phrase × native language) — into public/mockups/<lang>/<slug>.mp4.
// The needed phrases are derived from the highlights in src/SocialVideo/videos/*.json,
// and the languages from the generated word data.
//
// Usage:
//   npm run render:mockups            # all highlights, all languages
//   npm run render:mockups -- <lang>  # just one language
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = join(root, "src/SocialVideo/videos");
const generated = JSON.parse(readFileSync(join(root, "src/Dictionary/words.generated.json"), "utf8"));
const LANGS = Object.keys(generated);

// Union of highlight slugs across all videos.
const slugs = [
  ...new Set(
    readdirSync(videosDir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => JSON.parse(readFileSync(join(videosDir, f), "utf8")).highlights ?? [])
      .map((h) => h.slug),
  ),
];

const langArg = process.argv[2];
const targetLangs = langArg ? LANGS.filter((l) => l === langArg) : LANGS;

for (const lang of targetLangs) {
  const dir = join(root, "public/mockups", lang);
  mkdirSync(dir, { recursive: true });
  for (const slug of slugs) {
    const out = join(dir, `${slug}.mp4`);
    console.log(`Rendering Dictionary-${lang}-${slug} → public/mockups/${lang}/${slug}.mp4`);
    execFileSync("npx", ["remotion", "render", `Dictionary-${lang}-${slug}`, out], {
      stdio: "inherit",
      cwd: root,
    });
  }
}
