// Renders finished social videos into out/final/<slug>-<lang>.mp4 — one per
// (video × native language). Compositions are `Social-<lang>-<slug>` (src/Root.tsx).
//
// Usage:
//   npm run render:final                     # every video, every language
//   npm run render:final -- <slug>           # one video, every language
//   npm run render:final -- <slug> <lang>    # one video, one language
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync, unlinkSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Render one composition, retrying on failure. Remotion's webpack bundling
// intermittently crashes with `wasm-hash.js … reading 'length'` (a corrupt
// on-disk cache under Node 22/23); a retry after clearing that cache fixes it.
// Without this, a single flaky bundle silently aborts a whole batch render.
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

// videos/ is the source of truth: on a full render (no slug filter), drop any
// out/final artifact (rendered .mp4 or its .md description) that no longer maps
// to a current video × language — so deleting a video's JSON makes its finished
// render + description disappear on the next render.
if (!slugArg) {
  const validBases = new Set(slugs.flatMap((s) => LANGS.map((l) => `${s}-${l}`)));
  for (const f of readdirSync(outDir)) {
    const base = f.replace(/\.(mp4|md)$/, "");
    if (base !== f && !validBases.has(base)) {
      unlinkSync(join(outDir, f));
      console.log(`Pruned stale out/final/${f}`);
    }
  }
}

for (const slug of targetSlugs) {
  for (const lang of targetLangs) {
    const out = join(outDir, `${slug}-${lang}.mp4`);
    console.log(`Rendering Social-${lang}-${slug} → ${out}`);
    renderWithRetry(`Social-${lang}-${slug}`, out);
  }
}
