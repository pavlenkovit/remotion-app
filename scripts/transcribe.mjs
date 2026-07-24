// Auto-generate subtitles (and best-effort highlight timings) for a social video
// by transcribing the clip's own audio with Whisper. No manual timing guessing.
//
// Usage: npm run transcribe -- <slug>
//
// Pipeline: extract 16kHz mono wav (Remotion's bundled ffmpeg) -> whisper.cpp
// transcribe with word timestamps -> write `subtitles` (one line per speech
// segment) into src/SocialVideo/videos/<slug>.json, and set each highlight's
// `atSec` to the end of the segment where its phrase is spoken (when matched).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } from "@remotion/install-whisper-cpp";
import { reportFormal } from "./formal-you.mjs";

const WHISPER_VERSION = "1.5.5";
const MODEL = "small.en"; // accurate enough for clear movie dialogue

// Native languages to translate the subtitles into (keep in sync with
// NATIVE_LANGS in src/i18n.ts). Each subtitle shows English + these.
const TARGET_LANGS = ["ru", "es"];
const VIBELING_URL = "https://api.vibeling.app";
const VIBELING_SECRET = "gEASDeP8Wfi1UHTtQD23DgApbAoJ21RPovK";
const VIBELING_META = { version: "1.0.0", os: "iOS", uid: "vbl_render_bot" };

/** Translate a batch of English lines into `lang` via the vibeling API. */
const translateLines = async (lines, lang) => {
  const res = await fetch(`${VIBELING_URL}/translate`, {
    method: "POST",
    headers: { "X-App-Secret": VIBELING_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ words: lines, sourceLanguage: "en", targetLanguage: lang, meta: VIBELING_META }),
  });
  if (!res.ok) throw new Error(`/translate (${lang}) -> HTTP ${res.status} ${res.statusText}`);
  return (await res.json()).translations ?? [];
};

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run transcribe -- <slug>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, `src/SocialVideo/videos/${slug}.json`);
const video = JSON.parse(readFileSync(jsonPath, "utf8"));
const clipPath = join(root, "public", video.clip);

// 1) Extract audio with the ffmpeg bundled in @remotion/cli.
const cacheDir = join(root, "node_modules/.cache/whisper");
mkdirSync(cacheDir, { recursive: true });
const wav = join(cacheDir, `${slug}.wav`);
console.log(`[1/4] Extracting audio -> ${wav}`);
execFileSync("npx", ["remotion", "ffmpeg", "-y", "-i", clipPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], {
  stdio: "inherit",
  cwd: root,
});

// 2) Install whisper.cpp + model (cached after the first run).
const whisperDir = join(root, "whisper.cpp");
console.log(`[2/4] Ensuring whisper.cpp ${WHISPER_VERSION} + model ${MODEL}`);
await installWhisperCpp({ version: WHISPER_VERSION, to: whisperDir });
await downloadWhisperModel({ model: MODEL, folder: whisperDir });

// 3) Transcribe with word-level timestamps.
console.log(`[3/4] Transcribing`);
const out = await transcribe({
  inputPath: wav,
  whisperPath: whisperDir,
  whisperCppVersion: WHISPER_VERSION,
  model: MODEL,
  tokenLevelTimestamps: true,
  language: "en",
});

// 4) Rebuild clean words from the word-level captions, then group into subtitle
//    lines (one per sentence / speaker turn).
const { captions } = toCaptions({ whisperCppOutput: out });

const words = [];
for (const c of captions) {
  const piece = c.text.trim();
  if (!piece) continue;
  const isDash = piece === "-" || piece === "–";
  const isPunct = !isDash && /^[^A-Za-z0-9]+$/.test(piece);
  const startsWord = isDash || ((c.text.startsWith(" ") && !isPunct) || words.length === 0);
  if (isPunct && words.length) {
    // Attach trailing punctuation to the previous word.
    const w = words[words.length - 1];
    w.text += piece;
    w.to = c.endMs;
  } else if (startsWord) {
    words.push({ text: piece, from: c.startMs, to: c.endMs });
  } else {
    const w = words[words.length - 1];
    w.text += piece;
    w.to = c.endMs;
  }
}

const segments = [];
let cur = null;
const flush = () => {
  if (cur && cur.text.trim()) segments.push({ from: round(cur.from / 1000), to: round(cur.to / 1000), text: cur.text.trim() });
  cur = null;
};
for (const w of words) {
  if (w.text === "-" || w.text === "–") {
    flush(); // speaker change / new line
    continue;
  }
  if (!cur) cur = { from: w.from, to: w.to, text: "" };
  cur.text += (cur.text ? " " : "") + w.text;
  cur.to = w.to;
  if (/[.!?]$/.test(w.text)) flush(); // sentence end
}
flush();

video.subtitles = segments;

// Best-effort: locate each highlight phrase, set its atSec to the spoken end and
// lift the phrase's REAL spelling out of the line.
const collapse = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The substring of `text` that spells `needle` (already collapsed), with the
 * original apostrophes/casing — "you're looking at me", not "youre looking at me".
 * Matching ignores everything but letters/digits, so an index map carries the hit
 * back to offsets in the original string. Null when the phrase isn't in the line.
 */
const spellingOf = (text, needle) => {
  const map = [];
  let norm = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if (/[a-z0-9]/.test(c)) {
      norm += c;
      map.push(i);
    }
  }
  const at = norm.indexOf(needle);
  if (at < 0) return null;
  return text.slice(map[at], map[at + needle.length - 1] + 1);
};

for (const h of video.highlights ?? []) {
  const phrase = collapse(h.slug.replace(/-/g, " "));
  const seg = segments.find((s) => collapse(s.text).includes(phrase));
  if (seg) {
    h.atSec = seg.to;
    // A slug can't hold an apostrophe, so without this the dictionary card and
    // the outro recap would read "The way youre looking at me".
    const spoken = spellingOf(seg.text, phrase);
    if (spoken) h.text = spoken;
    console.log(`  highlight "${h.slug}" -> atSec ${seg.to}, text "${spoken ?? "?"}" ("${seg.text}")`);
  } else {
    console.warn(`  highlight "${h.slug}" NOT found in transcript — kept atSec ${h.atSec}`);
  }
}

// Translate every subtitle line into each native language (English + translation
// are shown together). One batched request per language.
if (segments.length) {
  const texts = segments.map((s) => s.text);
  for (const lang of TARGET_LANGS) {
    try {
      const translations = await translateLines(texts, lang);
      segments.forEach((s, i) => {
        s.tr = s.tr ?? {};
        s.tr[lang] = translations[i] ?? "";
      });
      console.log(`  translated ${translations.length} lines -> ${lang}`);
      // The API translates each line blind and defaults to the polite form; film
      // dialogue is almost always informal. Flag those lines for a rewrite.
      reportFormal(
        segments.map((s, i) => ({ label: `${lang} #${i + 1}`, text: s.tr[lang] ?? "" })),
        lang,
      );
    } catch (err) {
      console.warn(`  translation to ${lang} failed (${err.message}) — subtitles kept English-only`);
    }
  }
}

writeFileSync(jsonPath, JSON.stringify(video, null, 2) + "\n");
console.log(`[4/4] Wrote ${segments.length} subtitle lines to ${jsonPath}`);

function round(n) {
  return Math.round(n * 100) / 100;
}
