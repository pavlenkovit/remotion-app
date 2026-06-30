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
import { installWhisperCpp, downloadWhisperModel, transcribe } from "@remotion/install-whisper-cpp";

const WHISPER_VERSION = "1.5.5";
const MODEL = "small.en"; // accurate enough for clear movie dialogue

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

// 4) Build subtitles from speech segments and write them back.
const segments = out.transcription
  .map((s) => ({ from: round(s.offsets.from / 1000), to: round(s.offsets.to / 1000), text: s.text.trim() }))
  .filter((s) => s.text);

video.subtitles = segments;

// Best-effort: locate each highlight phrase and set its atSec to the spoken end.
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

writeFileSync(jsonPath, JSON.stringify(video, null, 2) + "\n");
console.log(`[4/4] Wrote ${segments.length} subtitle lines to ${jsonPath}`);

function round(n) {
  return Math.round(n * 100) / 100;
}
