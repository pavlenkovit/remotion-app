// Fetches word data from the real vibeling backend API and generates the data
// the Dictionary video reads — for EVERY target (native) language, so we can
// render one video per audience. The only thing you edit by hand is the English
// slug list in src/Dictionary/words.json (e.g. "freedom", "say-my-name").
//
// For each slug × language it:
//   1. POST /translate  (en -> lang)   → the native translation of the phrase
//   2. POST /word        (enrichWord)  → transcription, part of speech, examples
//   3. downloads the illustration once per slug into public/words/
// and writes src/Dictionary/words.generated.json as { [lang]: WordData[] }.
//
// Run with:  npm run fetch-words

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SLUGS_FILE = join(ROOT, "src/Dictionary/words.json");
const OUT_FILE = join(ROOT, "src/Dictionary/words.generated.json");
const IMG_DIR = join(ROOT, "public/words");

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
  const slugs = JSON.parse(await readFile(SLUGS_FILE, "utf-8"));
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
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
