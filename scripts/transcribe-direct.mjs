// Like scripts/transcribe.mjs, but calls the whisper.cpp binary directly instead
// of @remotion/install-whisper-cpp's transcribe() wrapper — the wrapper is killed
// with SIGTERM in this environment (Metal->CPU fallback), while the plain binary
// works fine. Segment-level JSON (-oj) is grouped into subtitle lines, highlight
// atSec is matched, and lines are translated via the vibeling API. Same output
// shape as transcribe.mjs so the rest of the pipeline is unchanged.
//
// Usage: node scripts/transcribe-direct.mjs <slug>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MODEL_BIN = "whisper.cpp/ggml-small.en.bin";
const WHISPER_BIN = "whisper.cpp/main";
const TARGET_LANGS = ["ru", "es"];
const VIBELING_URL = "https://api.vibeling.app";
const VIBELING_SECRET = "gEASDeP8Wfi1UHTtQD23DgApbAoJ21RPovK";
const VIBELING_META = { version: "1.0.0", os: "iOS", uid: "vbl_render_bot" };

const translateLines = async (lines, lang) => {
  const res = await fetch(`${VIBELING_URL}/translate`, {
    method: "POST",
    headers: { "X-App-Secret": VIBELING_SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({ words: lines, sourceLanguage: "en", targetLanguage: lang, meta: VIBELING_META }),
  });
  if (!res.ok) throw new Error(`/translate (${lang}) -> HTTP ${res.status} ${res.statusText}`);
  return (await res.json()).translations ?? [];
};

const round = (n) => Math.round(n * 100) / 100;

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/transcribe-direct.mjs <slug>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, `src/SocialVideo/videos/${slug}.json`);
const video = JSON.parse(readFileSync(jsonPath, "utf8"));
const clipPath = join(root, "public", video.clip);

const cacheDir = join(root, "node_modules/.cache/whisper");
mkdirSync(cacheDir, { recursive: true });
const wav = join(cacheDir, `${slug}.wav`);
console.log(`[1/4] Extracting audio -> ${wav}`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", clipPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], {
  stdio: "inherit",
  cwd: root,
});

console.log(`[2/4] Transcribing (direct whisper.cpp)`);
const outBase = join(cacheDir, slug);
execFileSync(join(root, WHISPER_BIN), ["-m", join(root, MODEL_BIN), "-f", wav, "-oj", "-of", outBase, "-l", "en"], {
  stdio: ["ignore", "ignore", "inherit"],
  cwd: root,
});

// Strip whisper stage-directions / sound tags like "[ Clears throat ]" or
// "(laughing)" from within a line, and collapse the leftover whitespace.
const clean = (t) =>
  (t ?? "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();

const whisper = JSON.parse(readFileSync(`${outBase}.json`, "utf8"));
const segments = (whisper.transcription ?? [])
  .map((s) => ({ from: round(s.offsets.from / 1000), to: round(s.offsets.to / 1000), text: clean(s.text) }))
  .filter((s) => s.text && /[A-Za-z0-9]/.test(s.text)); // drop empty / tag-only lines

video.subtitles = segments;

// Locate each highlight phrase and set its atSec to the spoken end.
const collapse = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
for (const h of video.highlights ?? []) {
  const phrase = collapse(h.slug.replace(/-/g, " "));
  const seg = segments.find((s) => collapse(s.text).includes(phrase));
  if (seg) {
    h.atSec = seg.to;
    console.log(`  highlight "${h.slug}" -> atSec ${seg.to} ("${seg.text}")`);
  } else {
    console.warn(`  highlight "${h.slug}" NOT found in transcript — kept atSec ${h.atSec}`);
  }
}

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
    } catch (err) {
      console.warn(`  translation to ${lang} failed (${err.message}) — subtitles kept English-only`);
    }
  }
}

writeFileSync(jsonPath, JSON.stringify(video, null, 2) + "\n");
console.log(`[4/4] Wrote ${segments.length} subtitle lines to ${jsonPath}`);
