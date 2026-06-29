// Fetches word data from vibeling.app by slug and generates the data the
// Dictionary video reads. The only thing you edit by hand is the slug list in
// src/Dictionary/words.json (e.g. "freedom", "apple", "how-are-you").
//
// For each slug it pulls https://vibeling.app/ru/dictionary/english/<slug>,
// parses the page, downloads the word image into public/words/, and writes the
// full data to src/Dictionary/words.generated.json.
//
// Run with:  npm run fetch-words

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SLUGS_FILE = join(ROOT, "src/Dictionary/words.json");
const OUT_FILE = join(ROOT, "src/Dictionary/words.generated.json");
const IMG_DIR = join(ROOT, "public/words");

const SOURCE = (slug) => `https://vibeling.app/ru/dictionary/english/${slug}`;

// ---------- tiny HTML helpers (no deps) ----------

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// Match `cls` as a whole class token (so "dict-translation" does NOT match
// "dict-translation-label"). Hyphens count as token boundaries here.
const classToken = (cls) => `class="[^"]*(?<![\\w-])${cls}(?![\\w-])[^"]*"`;

// Inner text of the first element carrying class token `cls`.
const byClass = (html, cls) => {
  const re = new RegExp(`${classToken(cls)}[^>]*>([\\s\\S]*?)<\\/`, "");
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
};

const allByClass = (html, cls) => {
  const re = new RegExp(`${classToken(cls)}[^>]*>([\\s\\S]*?)<\\/`, "g");
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(stripTags(m[1]));
  return out;
};

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------- parsing ----------

const parseWord = (html, slug) => {
  // The visible word is in the gradient highlight span; fall back to the slug.
  const highlight = html.match(/class="[^"]*dict-word-highlight[^"]*"[^>]*>([^<]+)</);
  const word = capitalize(
    highlight ? decodeEntities(highlight[1]).trim() : slug.split("-").join(" "),
  );

  // Transcription element contains an <svg> icon followed by the [..] text.
  const transBlock = html.match(/class="[^"]*dict-transcription[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  const transStripped = transBlock ? stripTags(transBlock[1]) : "";
  const bracket = transStripped.match(/\[[^\]]+\]/);
  const phonetic = bracket ? bracket[0] : transStripped;

  const partOfSpeech = byClass(html, "dict-pos");
  const translation = byClass(html, "dict-translation");

  const targets = allByClass(html, "dict-example-target");
  const glosses = allByClass(html, "dict-example-gloss");
  const examples = targets.map((en, i) => ({ en, ru: glosses[i] ?? "" }));

  const imgMatch = html.match(/class="[^"]*dict-image[^"]*"[^>]*src="([^"]+)"/);
  const imageUrl = imgMatch ? imgMatch[1] : "";

  return { slug, word, phonetic, partOfSpeech, translation, examples, imageUrl };
};

// ---------- image download ----------

const downloadImage = async (url, slug) => {
  if (!url) return "";
  const ext = (url.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)?.[1] ?? "jpg").toLowerCase();
  const file = `${slug}.${ext}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(IMG_DIR, file), buf);
  return `words/${file}`; // path relative to public/ for Remotion staticFile()
};

// ---------- main ----------

const main = async () => {
  const slugs = JSON.parse(await readFile(SLUGS_FILE, "utf-8"));
  await mkdir(IMG_DIR, { recursive: true });

  const result = [];
  for (const slug of slugs) {
    process.stdout.write(`• ${slug} … `);
    const res = await fetch(SOURCE(slug));
    if (!res.ok) {
      console.log(`SKIP (HTTP ${res.status})`);
      continue;
    }
    const html = await res.text();
    const { imageUrl, ...data } = parseWord(html, slug);
    const image = await downloadImage(imageUrl, slug).catch((e) => {
      console.log(`(image failed: ${e.message}) `);
      return "";
    });
    result.push({ ...data, image });
    console.log(`ok — "${data.word}" → "${data.translation}", ${data.examples.length} examples`);
  }

  await writeFile(OUT_FILE, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nWrote ${result.length} words to ${OUT_FILE.replace(ROOT + "/", "")}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
