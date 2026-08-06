// Auto-generate subtitles (and best-effort highlight timings) for a social video
// by transcribing the clip's own audio with Whisper. No manual timing guessing.
//
// Usage: npm run transcribe -- <slug>
//
// Pipeline: extract 16kHz mono wav (Remotion's bundled ffmpeg) -> whisper.cpp
// transcribe with DTW-aligned word timestamps (see transcribeWithDtw — the
// default token timestamps ignore silence and run ahead of the speech) -> write
// `subtitles` (one line per speech segment) into src/SocialVideo/videos/<slug>.json,
// and set each highlight's `atSec` to the end of the segment where its phrase is
// spoken (when matched).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { installWhisperCpp, downloadWhisperModel } from "@remotion/install-whisper-cpp";
import { reportFormal } from "./formal-you.mjs";

const WHISPER_VERSION = "1.5.5";
// small.en is accurate enough for clear movie dialogue. Some clips (quiet or
// music-heavy) come back unpunctuated or mis-heard — retry those with
// `WHISPER_MODEL=medium.en npm run transcribe -- <slug>`. The name is also passed
// to whisper.cpp's `--dtw`, which only accepts its known presets (tiny/base/
// small/medium/large + .en variants).
const MODEL = process.env.WHISPER_MODEL ?? "small.en";

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
// --retime: re-time the EXISTING subtitles instead of regenerating them. Same
// transcription pass, but only each cue's `from`/`to` (and the highlights'
// `atSec`) are rewritten — the lines and their hand-fixed translations survive.
// That's what you run on a finished video after a timing fix; a plain run would
// re-translate every line from scratch and lose the «ты» rewrites.
const RETIME = process.argv.includes("--retime");
if (!slug || slug.startsWith("--")) {
  console.error("Usage: npm run transcribe -- <slug> [--retime]");
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
const captions = transcribeWithDtw(wav);

const words = [];
for (const c of captions) {
  const piece = c.text.trim();
  if (!piece) continue;
  const isDash = piece === "-" || piece === "–";
  const isPunct = !isDash && /^[^A-Za-z0-9]+$/.test(piece);
  const startsWord = isDash || ((c.text.startsWith(" ") && !isPunct) || words.length === 0);
  if (isPunct && words.length) {
    // Attach trailing punctuation to the previous word, but KEEP that word's end:
    // DTW aligns a lone "." or "?" to wherever it likes (often into the next
    // pause), and letting it move the end would put the cue back out of sync.
    words[words.length - 1].text += piece;
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
// Whisper occasionally returns a whole clip as one unpunctuated run with the
// word timestamps packed end-to-end. Punctuation and dashes then never fire and
// the entire scene collapses into a single subtitle — unreadable, and every
// highlight lands on that one line's end (all the pauses stack on one frame).
// These two fallbacks split such a run; on a normally punctuated clip neither
// triggers, since sentences end well before either bound.
const GAP_MS = 800;
const MAX_CHARS = 70;
for (const w of words) {
  if (w.text === "-" || w.text === "–") {
    flush(); // speaker change / new line
    continue;
  }
  if (cur && w.from - cur.to > GAP_MS) flush(); // pause / speaker change
  if (cur && cur.text.length + 1 + w.text.length > MAX_CHARS) flush(); // runaway line
  if (!cur) cur = { from: w.from, to: w.to, text: "" };
  cur.text += (cur.text ? " " : "") + w.text;
  cur.to = w.to;
  if (/[.!?]$/.test(w.text)) flush(); // sentence end
}
flush();

const collapse = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

if (RETIME) {
  // Re-time the lines that are already in the JSON: walk the fresh word stream
  // once, matching each existing cue's letters against it (the transcript is the
  // same text, so this is a plain in-order substring search), and take the cue's
  // bounds from the words that spell it. Text and `tr` are left untouched.
  const cuesToTime = video.subtitles ?? [];
  const stream = words.map((w) => collapse(w.text));
  const norm = stream.join("");
  // Character offset -> word index, so a hit in `norm` maps back to words.
  const wordAt = stream.flatMap((s, i) => Array(s.length).fill(i));

  // Pass 1 — anchor every line we can find verbatim, in order.
  const span = cuesToTime.map(() => null);
  let cursor = 0;
  cuesToTime.forEach((cue, i) => {
    const needle = collapse(cue.text);
    const at = needle ? norm.indexOf(needle, cursor) : -1;
    if (at < 0) return;
    span[i] = [wordAt[at], wordAt[at + needle.length - 1]];
    cursor = at + needle.length;
  });

  // Pass 2 — a line whisper hears differently than it's written ("$5 bud vases"
  // came back as "bid habits") finds no anchor. It's still SOMEWHERE between its
  // neighbours, so give it the words left over in that gap, split between several
  // unmatched lines in proportion to their length.
  for (let i = 0; i < span.length; i++) {
    if (span[i]) continue;
    let j = i;
    while (j < span.length && !span[j]) j++;
    const lo = i > 0 && span[i - 1] ? span[i - 1][1] + 1 : 0;
    const hi = j < span.length && span[j] ? span[j][0] - 1 : words.length - 1;
    const free = hi - lo + 1;
    if (free > 0) {
      const weights = [];
      for (let k = i; k < j; k++) weights.push(Math.max(1, collapse(cuesToTime[k].text).length));
      const total = weights.reduce((a, b) => a + b, 0);
      let at = lo;
      for (let k = i; k < j; k++) {
        const take = k === j - 1 ? hi - at + 1 : Math.max(1, Math.round((weights[k - i] / total) * free));
        span[k] = [at, Math.min(hi, at + take - 1)];
        at = span[k][1] + 1;
      }
      console.warn(`  "${cuesToTime[i].text}" not heard verbatim — timed from the gap between its neighbours`);
    }
    i = j - 1;
  }

  let missed = 0;
  cuesToTime.forEach((cue, i) => {
    if (!span[i]) {
      missed++;
      console.warn(`  no match for "${cue.text}" — kept ${cue.from}–${cue.to}`);
      return;
    }
    const [from, to] = [round(words[span[i][0]].from / 1000), round(words[span[i][1]].to / 1000)];
    if (from !== cue.from || to !== cue.to) {
      console.log(`  ${cue.from}–${cue.to} -> ${from}–${to}  "${cue.text}"`);
    }
    cue.from = from;
    cue.to = to;
  });
  console.log(`  re-timed ${cuesToTime.length - missed}/${cuesToTime.length} lines`);
}

video.subtitles = RETIME ? video.subtitles : segments;
const cues = video.subtitles ?? [];

// Best-effort: locate each highlight phrase, set its atSec to the spoken end and
// lift the phrase's REAL spelling out of the line.

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
  const seg = cues.find((s) => collapse(s.text).includes(phrase));
  if (seg) {
    h.atSec = seg.to;
    // A slug can't hold an apostrophe, so without this the dictionary card and
    // the outro recap would read "The way youre looking at me". On --retime the
    // phrase is whatever the user curated — only its timing is being fixed.
    const spoken = RETIME ? h.text : spellingOf(seg.text, phrase);
    if (spoken && !RETIME) h.text = spoken;
    console.log(`  highlight "${h.slug}" -> atSec ${seg.to}, text "${spoken ?? "?"}" ("${seg.text}")`);
  } else {
    console.warn(`  highlight "${h.slug}" NOT found in transcript — kept atSec ${h.atSec}`);
  }
}

// Translate every subtitle line into each native language (English + translation
// are shown together). One batched request per language. Skipped on --retime:
// the lines already have their (hand-checked) translations.
if (!RETIME && segments.length) {
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
console.log(`[4/4] Wrote ${cues.length} subtitle lines to ${jsonPath}`);

function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Word timings that actually match the audio.
 *
 * whisper.cpp has TWO kinds of token timestamps. The default ones (what
 * `@remotion/install-whisper-cpp`'s `transcribe()` + `toCaptions()` return) are
 * PACKED: every token starts exactly where the previous one ended, so silence
 * simply doesn't exist in that timeline. A pause between two lines then shows
 * up as a subtitle appearing seconds before it's spoken — on the Friends shop
 * clip the last line was timed at 10.62s while it is actually said at 13.39s.
 *
 * The real alignment is whisper.cpp's DTW pass (`--dtw <model>`, one `t_dtw`
 * per token, in centiseconds), which the Remotion wrapper doesn't expose — so
 * we call the binary ourselves. `-ml 1 -sow` makes it emit one word per
 * segment; `-ojf` writes the tokens (with `t_dtw`) to JSON.
 *
 * Returns `{ text, startMs, endMs }[]` — the same shape `toCaptions()` gave,
 * so the grouping below is unchanged. DTW yields one point per token (where the
 * word STARTS), so a word's end is the next word's start, capped by a rough
 * spoken-length estimate; without that cap a word before a pause would stretch
 * across the whole silence.
 */
function transcribeWithDtw(wavPath) {
  const bin = [join(whisperDir, "main"), join(whisperDir, "build/bin/whisper-cli")].find((p) => existsSync(p));
  if (!bin) throw new Error(`whisper.cpp binary not found in ${whisperDir}`);
  const outBase = join(cacheDir, `${slug}-dtw`);
  execFileSync(
    bin,
    // prettier-ignore
    ["-m", join(whisperDir, `ggml-${MODEL}.bin`), "-f", wavPath, "--dtw", MODEL,
     "-ml", "1", "-sow", "-np", "-l", "en", "-ojf", "-of", outBase],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const raw = JSON.parse(readFileSync(`${outBase}.json`, "utf8"));
  // Drop whisper's control tokens ([_BEG_], [_TT_123]) — they carry no t_dtw.
  const tokens = (raw.transcription ?? [])
    .flatMap((s) => s.tokens ?? [])
    .filter((t) => typeof t.t_dtw === "number" && t.t_dtw >= 0 && !/^\s*\[_.*_\]\s*$/.test(t.text));
  if (!tokens.length) throw new Error("whisper.cpp returned no DTW-timed tokens");

  const CHAR_MS = 60; // rough per-letter speaking rate
  const TAIL_MS = 200; // release of the final consonant / short trailing vowel
  return tokens.map((t, i) => {
    const startMs = t.t_dtw * 10;
    const nextMs = i + 1 < tokens.length ? tokens[i + 1].t_dtw * 10 : Infinity;
    const letters = t.text.replace(/[^A-Za-z0-9]/g, "").length;
    return { text: t.text, startMs, endMs: Math.max(startMs, Math.min(nextMs, startMs + letters * CHAR_MS + TAIL_MS)) };
  });
}
