// Fetches word data from the real vibeling backend API and generates the data
// the Dictionary video reads — for EVERY target (native) language, so we can
// render one video per audience.
//
// The slug list is DERIVED from the highlights in src/SocialVideo/videos/*.json
// (videos/ is the single source of truth) — nothing to hand-maintain. Words for
// deleted videos are pruned: words.generated.json only holds current slugs and
// stale illustrations in public/words/ are removed.
//
// For each slug × language it:
//   1. POST /translate  (en -> lang)   → the native translation of the phrase
//   2. POST /word        (enrichWord)  → transcription, part of speech, examples
//   3. downloads the illustration once per slug into public/words/
// and writes src/Dictionary/words.generated.json as { [lang]: WordData[] }.
//
// Run with:  npm run fetch-words

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VIDEOS_DIR = join(ROOT, "src/SocialVideo/videos");
const OUT_FILE = join(ROOT, "src/Dictionary/words.generated.json");
const IMG_DIR = join(ROOT, "public/words");

// Union of highlight slugs across all current videos — the single source of truth.
const slugsFromVideos = () => [
  ...new Set(
    readdirSync(VIDEOS_DIR)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => JSON.parse(readFileSync(join(VIDEOS_DIR, f), "utf8")).highlights ?? [])
      .map((h) => h.slug),
  ),
];

// Delete illustrations in public/words/ whose slug is no longer used by any video.
const pruneImages = async (keepSlugs) => {
  if (!existsSync(IMG_DIR)) return;
  const keep = new Set(keepSlugs);
  for (const f of await readdir(IMG_DIR)) {
    const slug = f.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    if (!keep.has(slug)) {
      await unlink(join(IMG_DIR, f));
      console.log(`  pruned stale illustration public/words/${f}`);
    }
  }
};

// Native languages to generate. Keep in sync with NATIVE_LANGS in src/i18n.ts.
const TARGET_LANGS = ["ru", "es"];
const LEARN_LANG = "en"; // the clips are English

const BASE_URL = "https://api.vibeling.app";
const APP_SECRET = "gEASDeP8Wfi1UHTtQD23DgApbAoJ21RPovK";
const META = { version: "1.0.0", os: "iOS", uid: "vbl_render_bot" };

const api = async (path, body) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "X-App-Secret": APP_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, meta: META }),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${res.statusText}`);
  return res.json();
};

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const phraseFromSlug = (slug) => slug.split("-").join(" ");

const downloadImage = async (url, slug) => {
  if (!url) return "";
  const ext = (url.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)?.[1] ?? "jpg").toLowerCase();
  const file = `${slug}.${ext}`;
  const dest = join(IMG_DIR, file);
  if (existsSync(dest)) return `words/${file}`; // image is language-independent
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${url} -> HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return `words/${file}`;
};

const main = async () => {
  const slugs = slugsFromVideos();
  await mkdir(IMG_DIR, { recursive: true });

  const byLang = Object.fromEntries(TARGET_LANGS.map((l) => [l, []]));

  for (const slug of slugs) {
    const enPhrase = phraseFromSlug(slug);
    let image = "";
    for (const lang of TARGET_LANGS) {
      process.stdout.write(`• ${slug} [${lang}] … `);
      try {
        const { translations } = await api("/translate", {
          words: [enPhrase],
          sourceLanguage: LEARN_LANG,
          targetLanguage: lang,
        });
        const toWord = translations?.[0] ?? enPhrase;
        const w = await api("/word", {
          fromWord: enPhrase,
          toWord,
          fromLanguage: LEARN_LANG,
          toLanguage: lang,
        });
        // Download the illustration once per slug (shared across languages).
        if (!image) {
          image = await downloadImage(w.imageUrl, slug).catch((e) => {
            process.stdout.write(`(image failed: ${e.message}) `);
            return "";
          });
        }
        byLang[lang].push({
          slug,
          lang,
          word: capitalize(w.fromWord || enPhrase),
          phonetic: w.transcription ? `[${w.transcription}]` : "",
          partOfSpeech: w.partOfSpeech ?? "",
          translation: capitalize(w.toWord || toWord),
          image,
          examples: (w.examples ?? []).map((e) => ({
            original: e.original,
            translation: e.translation,
          })),
        });
        console.log(`ok — "${w.fromWord}" → "${w.toWord}", ${(w.examples ?? []).length} examples`);
      } catch (e) {
        console.log(`FAIL: ${e.message}`);
      }
    }
  }

  await writeFile(OUT_FILE, JSON.stringify(byLang, null, 2) + "\n");
  const counts = TARGET_LANGS.map((l) => `${l}:${byLang[l].length}`).join(", ");
  console.log(`\nWrote ${OUT_FILE.replace(ROOT + "/", "")} (${counts})`);

  // Drop illustrations for words no longer referenced by any video.
  await pruneImages(slugs);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
