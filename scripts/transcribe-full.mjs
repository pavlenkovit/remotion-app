// One-off: transcribe an arbitrary video file (whole thing) into a timestamped
// segment list, to help slice a compilation into logical scenes.
// Usage: node scripts/transcribe-full.mjs /abs/path/to/video.mp4 [out.json]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } from "@remotion/install-whisper-cpp";

const WHISPER_VERSION = "1.5.5";
const MODEL = "small.en";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/transcribe-full.mjs /abs/path/to/video.mp4 [out.json]");
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = process.argv[3] ?? join(root, "out", `${basename(src).replace(/\W+/g, "_")}.transcript.json`);

const cacheDir = join(root, "node_modules/.cache/whisper");
mkdirSync(cacheDir, { recursive: true });
const wav = join(cacheDir, `full-${basename(src).replace(/\W+/g, "_")}.wav`);
console.log(`[1/4] Extracting audio -> ${wav}`);
execFileSync("npx", ["remotion", "ffmpeg", "-y", "-i", src, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], {
  stdio: "inherit",
  cwd: root,
});

const whisperDir = join(root, "whisper.cpp");
console.log(`[2/4] Ensuring whisper.cpp ${WHISPER_VERSION} + model ${MODEL}`);
await installWhisperCpp({ version: WHISPER_VERSION, to: whisperDir });
await downloadWhisperModel({ model: MODEL, folder: whisperDir });

console.log(`[3/4] Transcribing (this takes a while for 8 min)`);
const out = await transcribe({
  inputPath: wav,
  whisperPath: whisperDir,
  whisperCppVersion: WHISPER_VERSION,
  model: MODEL,
  tokenLevelTimestamps: true,
  language: "en",
});

const { captions } = toCaptions({ whisperCppOutput: out });

// Group word-level captions into sentence-ish segments: break on sentence
// punctuation or a >0.8s gap between words.
const words = captions
  .map((c) => ({ text: (c.text ?? "").trim(), from: c.startInSeconds, to: c.endInSeconds }))
  .filter((w) => w.text);

const segments = [];
let cur = null;
for (const w of words) {
  if (!cur) {
    cur = { from: w.from, to: w.to, text: w.text };
    continue;
  }
  const gap = w.from - cur.to;
  cur.text += (/^[.,!?;:']/.test(w.text) ? "" : " ") + w.text;
  cur.to = w.to;
  if (gap > 0.8 || /[.!?]$/.test(w.text)) {
    segments.push(cur);
    cur = null;
  }
}
if (cur) segments.push(cur);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(segments, null, 2));
console.log(`[4/4] Wrote ${segments.length} segments -> ${outPath}`);
for (const s of segments) {
  console.log(`${s.from.toFixed(1).padStart(6)}  ${s.to.toFixed(1).padStart(6)}   ${s.text}`);
}
