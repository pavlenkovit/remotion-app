// Renders the phone-mockup videos the social videos play — one per
// (highlight phrase × native language) — into public/mockups/<lang>/<slug>.mp4.
// The needed phrases are derived from the highlights in src/SocialVideo/videos/*.json,
// and the languages from the generated word data.
//
// Usage:
//   npm run render:mockups            # all highlights, all languages
//   npm run render:mockups -- <lang>  # just one language
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync, existsSync, unlinkSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Retry a render on failure — Remotion's webpack bundling intermittently crashes
// with `wasm-hash.js … reading 'length'` (corrupt on-disk cache under Node 22/23);
// clearing that cache and retrying fixes it, so a flaky bundle can't abort the batch.
const renderWithRetry = (comp, out) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execFileSync("npx", ["remotion", "render", comp, out], { stdio: "inherit", cwd: root });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      console.warn(`  ${comp} failed (attempt ${attempt}); clearing webpack cache and retrying…`);
      rmSync(join(root, "node_modules/.cache/webpack"), { recursive: true, force: true });
    }
  }
};
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

const keep = new Set(slugs);
for (const lang of targetLangs) {
  const dir = join(root, "public/mockups", lang);
  mkdirSync(dir, { recursive: true });
  // videos/ is the source of truth: drop mockups for phrases no longer used by
  // any video so deleting a video (or a highlight) cleans up its mockup files.
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".mp4") && !keep.has(f.replace(/\.mp4$/, ""))) {
        unlinkSync(join(dir, f));
        console.log(`Pruned stale public/mockups/${lang}/${f}`);
      }
    }
  }
  for (const slug of slugs) {
    const out = join(dir, `${slug}.mp4`);
    console.log(`Rendering Dictionary-${lang}-${slug} → public/mockups/${lang}/${slug}.mp4`);
    renderWithRetry(`Dictionary-${lang}-${slug}`, out);
  }
}
