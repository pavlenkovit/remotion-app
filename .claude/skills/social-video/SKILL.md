---
name: social-video
description: Build social-media videos (Remotion) that teach English — play a scene with subtitles, pausing on useful phrases to show a phone mockup of adding them to the dictionary. Accepts either a single pre-trimmed clip OR a long video / YouTube link, which it downloads and cuts into several ≤40s scenes first. Use when the user asks to make social/reels videos from a film clip or from a long video/URL.
---

# Social Video

Builds a vertical (1080×1920, 30fps) Remotion video for social media out of a movie-scene
clip. The video teaches English vocabulary: it plays a scene with English subtitles and
pauses on chosen phrases to demo adding them to the dictionary app.

This is a Remotion project — read `.claude/skills/remotion-best-practices` and the existing
`src/Dictionary` composition for the house style (colors, springs, `interpolate`, `staticFile`).

## Two entry points

1. **A long video or a YouTube link** (the common case now). The user drops **only a URL**
   (or a path to a long video) and expects the whole thing end to end: download → cut into
   several short scenes → for each scene run the per-scene pipeline below → finished videos +
   descriptions. Do it all yourself, no confirmations. Start at **"From a long video → scenes"**.
2. **A single pre-trimmed clip** (a path to one short scene). Skip straight to the per-scene
   pipeline in **"Inputs — the user just drops an original clip"**.

## From a long video → scenes (do this when given a URL / long video)

Goal: turn one long video into **several standalone short scenes**, each ≤40s (shorter is
fine), each starting and ending on a **complete thought** — never mid-sentence. Then run the
normal per-scene pipeline for every scene.

1. **Download** (if given a URL). Use the **`youtube-download`** skill to fetch the full video
   in the best quality (default `~/Downloads`). For a local long file, skip this.
2. **Transcribe the whole thing** to get timestamped segments to cut on:
   ```
   npm run transcribe-full -- /abs/path/to/full-video.mp4
   ```
   This writes `out/<name>.transcript.json` — a list of `{ text, from, to }` segments for the
   entire video. Read it; this is your map for finding scene boundaries.
3. **Pick scene boundaries** from the transcript. A good scene:
   - is a **self-contained bit** — a joke, an exchange, one gag — with a **logical start**
     (beginning of a sentence/beat, not the tail of a prior line) and a **logical end** (the
     line lands; end on the punchy beat, not on trailing dead air or the next scene's setup).
   - is **≤40s** (aim 15–35s). If a good bit runs long, tighten the in/out points; if it can't
     fit without chopping a phrase, prefer a shorter self-contained sub-beat.
   - **stands alone** — it should make sense to a viewer who hasn't seen the rest.
   - Skip filler stretches (intros, logos, low-content chatter). You don't have to use the
     whole video — pick the segments that actually contain **useful, reusable English**.
4. **Cut each scene** into `public/clips/` with a frame-accurate re-encode:
   ```
   npm run cut-scene -- /abs/path/to/full-video.mp4 <startSec> <endSec> <slug>
   ```
   Choose a descriptive `<slug>` per scene (`<memorable-line>-<film>`, e.g.
   `turtles-the-office`). This writes `public/clips/<slug>.mp4`. Set the start/end from the
   transcript segment edges — but **whisper's `to` ends ~a syllable early, so add ~0.4s past
   the last word's `to` for `<endSec>`** (and don't start exactly on a `from`). A chopped
   final word makes the whole video end abruptly mid-word; a short trailing beat does not.
5. **For each scene, run the per-scene pipeline below** (identify film, create JSON pointing at
   `clips/<slug>.mp4`, pick 2–3 highlights, transcribe the scene, mockups, render, describe).
   Scenes are independent — you can do them one after another.

> The per-scene `stage-clip` step is only for entry point 2 (a pre-trimmed clip). When you cut
> with `cut-scene`, the clip is already in `public/clips/` — don't stage it again. Likewise the
> per-scene "trim trailing dead air" step is unnecessary if you chose a clean out-point here.

## Inputs — the user just drops an original clip; do the rest yourself

The default invocation is **only a path to an original clip** (e.g. `~/Desktop/original
video/0702.mov`). Do NOT ask the user to supply highlights, subtitles, film name, mockups, or
a slug — **decide all of it yourself** and run the whole pipeline end to end without pausing
for confirmation. Only ask if something is genuinely ambiguous (e.g. the clip isn't a
recognizable film scene and no film can be inferred).

Given just the clip, do this in order (details in the sections below):

1. **Identify the scene.** Extract a frame or two (`ffmpeg -ss … -frames:v 1`) and recognize
   the film/show → set `film` and a descriptive `slug` (`<memorable-line>-<film>`, e.g.
   `i-am-the-danger-breaking-bad`).
2. **Stage** the clip into `public/clips/` (below).
3. **Trim trailing dead air.** Clips often have several seconds of silence / reaction shots /
   panting at the end. Extract tail frames, find where the meaningful audio ends, and
   re-encode a tight cut (`ffmpeg -t <sec> -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac`)
   over the staged copy. End on a punchy beat, not dead air — but leave a **short trailing
   beat (~0.4s) after the last word finishes**, never cut right on it, or the video ends
   abruptly mid-syllable.
4. **Create the video JSON** (`src/SocialVideo/videos/<slug>.json`) with `slug`, `clip`,
   `film`, `highlights: []`, `subtitles: []`. It's auto-discovered — no `schema.ts` edit.
5. **Pick 2–3 highlights yourself** (see "Choosing highlights" below), add them to the JSON.
6. **Transcribe** (`npm run transcribe -- <slug>`) to fill subtitles + set each `atSec`, then
   **delete any trailing hallucinated lines** (whisper invents "Thank you." / "[silence]" over
   panting/quiet tails — remove them so subtitles stop with the last real line).
7. **Generate the mockups:** `npm run fetch-words` (word data is derived
   automatically from the video highlights — no list to hand-edit), then `npm run
   render:mockups`.
8. **Render finals:** `npm run render:final -- <slug>`.
9. **Write the descriptions:** run the `video-description` skill for the slug.

### Choosing highlights (you pick them)

Pick **2–3** highlights per scene — **2 for a short scene (~15–25s), 3 for a longer one
(~25–40s)**. A highlight can be a **phrase/idiom OR a single word** — whatever is genuinely
worth learning.

**The one criterion that matters: is it useful in real life?** Choose things the viewer could
actually reuse in everyday English — practical idioms, common expressions, useful words
("give it back", "to be fair", "way to go", "call us a cab"). That is the primary filter, above
"iconic" or "funny". A memorable/quotable line is a bonus **only if it's also reusable**; skip
lines that are famous but useless in real conversation, and skip filler ("yeah", "okay", proper
nouns, scene-specific nonsense).

Rules:

- Each highlight's **`slug` must be the spoken words hyphenated** (e.g. `goes-belly-up`) —
  `transcribe` locates it by collapsing the slug to `[a-z0-9]` and finding the segment whose
  text contains it, then sets `atSec` to that segment's end. If a phrase can't be matched this
  way, pick a different chunk.
- **Space them out** across the clip so pauses don't bunch up (each mockup adds ~5s).
- If a scene has fewer than 2 genuinely useful items, it's a weak scene — prefer to pick a
  different segment of the source video rather than pad with filler highlights.

**Stage the clip into `public/clips/`** (Remotion can only read files under `public/`):

```
npm run stage-clip -- /abs/path/to/original.mov
```

This **copies** the file to `public/clips/<name>`. It must be a real copy, not a symlink:
Remotion's webpack bundler crashes on symlinked media and its static server 404s on them.
`public/clips` is git-ignored, so the copy is never committed and the original stays wherever
it lives on disk. Then set `"clip": "clips/<name>"` in the video's JSON
(`src/SocialVideo/videos/<slug>.json`). Mockups also live under `public/mockups/`.

## Multiple languages from one English clip

One English clip produces **one video per audience language** (`NATIVE_LANGS` in
`src/i18n.ts`, currently `ru` + `es`). The clip and English subtitles stay the same; what
changes per language is the branding captions, the mockup card content, the mockup UI
labels, the **outro image**, and the **variant differentiation** (below) — all driven by
`src/i18n.ts`. Compositions are `Social-<lang>-<slug>` and `Dictionary-<lang>-<slug>`;
finals are `out/final/<slug>-<lang>.mp4`.

**To add a language:** add it to `NATIVE_LANGS` + `STRINGS` + `VARIANTS` in `src/i18n.ts`
and to `TARGET_LANGS` in `scripts/fetch-words.mjs`, add a `public/video/vibeling-<lang>.png`
outro, then re-run the pipeline below.

### Per-language differentiation (anti-duplicate)

Because every language reuses the **same film clip + audio**, TikTok/Reels can flag the
cuts as duplicates. To avoid that, each language has a **`VARIANTS[lang]`** entry in
`src/i18n.ts` that is applied automatically to EVERY social video:

- **`flip`** — mirror the footage horizontally (`scaleX(-1)`); subtitles / mockups / outro
  stay un-mirrored. Only use it when the scene has no readable on-screen text.
- **`speed`** — clip playback rate (e.g. `1.02`). Also shifts the audio fingerprint. The
  timing (`getSocialTiming`) divides each play segment's on-screen length by `speed`, and
  `Subtitles` maps composition frames back to clip seconds with it — so a different speed
  just works.
- **`subtitle`** — `{ fontSize, color, trFontSize, trColor }` (English line + translation
  line). Subtitles sit on the black band, so **color** is the visible knob (a box would be
  invisible). Keep one language the clean baseline (`ru`: no flip, `speed:1`, white English +
  cool-grey translation) and differentiate the other(s) (`es`: flip, `1.02`, warm-yellow
  English + warm-pale translation). The **outro** is also per-language
  (`video/vibeling-<lang>.png`).

Keep changes subtle enough to still look intentional. When adding a language, give it a
distinct `VARIANTS` entry.

## Generating the phrase mockups (do this first)

The phone-mockup "adding the phrase" videos are **rendered from this project's `Dictionary`
composition** — one per (highlighted phrase × language). Generate them:

1. **Pull the data from the real backend API.** Run `npm run fetch-words`. The slug list is
   **derived automatically** from the highlights in `src/SocialVideo/videos/*.json` (there is
   no hand-maintained word list — `videos/` is the single source of truth). For every slug ×
   language it calls the vibeling API (`POST https://api.vibeling.app/translate` then `/word`
   with header `X-App-Secret`), downloads the illustration into `public/words/`, and writes
   `src/Dictionary/words.generated.json` as `{ [lang]: WordData[] }`. Each entry becomes a
   `Dictionary-<lang>-<slug>` composition. It also **prunes** `public/words/` illustrations
   whose slug is no longer used by any video.
2. **Render the mockups:** `npm run render:mockups` — renders every highlight × language into
   `public/mockups/<lang>/<slug>.mp4` (the files the social video plays inside the phone frame),
   and **prunes** mockups for phrases no longer used by any video.

## Subtitles & highlight timing — transcribe, don't guess

**Never hand-guess subtitle text or timings** (you can't hear the clip — guesses are wrong).
After staging the clip and creating the video JSON, run:

```
npm run transcribe -- <slug>
```

This extracts the clip's audio (Remotion's bundled ffmpeg), runs whisper.cpp (`small.en`),
and writes `subtitles` (one line per spoken sentence, real `from`/`to`) into
`src/SocialVideo/videos/<slug>.json` — and sets each highlight's `atSec` to where its phrase
is actually spoken (collapsed substring match; warns if a phrase isn't found). It then
**translates every subtitle line into each native language** via the vibeling `/translate`
API and stores them as `subtitle.tr = { ru, es }`. First run installs whisper.cpp + the model
(cached afterward). Then only **correct misheard proper nouns** (e.g. whisper writes
"Eisenberg" for "Heisenberg") and nudge if needed — if you edit an English line by hand,
re-run transcribe (or re-translate) so its `tr` stays in sync.

**Every subtitle shows English + the native translation** (always, both lines). The English
line is the hero; the translation sits under it in a smaller, per-language style (see
`VARIANTS[lang].subtitle` — `fontSize`/`color` for English, `trFontSize`/`trColor` for the
translation). A cue with no `tr[lang]` just shows English.

## Output locations (keep `out/` tidy)

`out/` is git-ignored and split into three folders — never dump files at its root:

- **`out/images/`** — screenshots / verification stills (PNG).
- **`out/renders/`** — scratch Remotion video renders (e.g. a `Dictionary-<lang>-<slug>`
  preview). Use `npm run render:preview <composition-id>`.
- **`out/final/`** — the finished social videos, one per (scene × language), named
  `<slug>-<lang>.mp4` (e.g. `say-my-name-breaking-bad-es.mp4`), **never** `social-video.mp4`.
  Render with `npm run render:final` (all), `npm run render:final -- <slug>` (one scene, all
  languages), or `npm run render:final -- <slug> <lang>` (one).

Note: the phone-mockup videos that the composition plays via `staticFile()` are
NOT "out" artifacts — they belong in `public/mockups/<lang>/<slug>.mp4` (see below).

**Render/bundle crashing with `wasm-hash.js … Cannot read properties of undefined
(reading 'length')`?** That's webpack's persistent FILESYSTEM cache corrupting under Node 22.
`remotion.config.ts` already forces an in-memory webpack cache (`cache: { type: "memory" }`)
to stop it recurring. If you still hit it (e.g. a stale on-disk cache), clear it once with
`rm -rf node_modules/.cache/webpack`. A one-off transient failure on a single mockup usually
just needs a retry — so `render:final` and `render:mockups` now **auto-retry each render up to
3×**, clearing `node_modules/.cache/webpack` between attempts. ⚠️ When rendering in a shell
loop by hand, always check each render's exit status and retry: a crashed bundle prints only
`Node.js v…` and exits non-zero, and if you mask that (e.g. `... | tail -1; echo done`) the
batch looks green while the output files are silently left stale (old or missing).

## Scenario (sequence of the produced video)

There is **no plain first pass and no swipe** — the video starts straight on the subtitled clip.

1. **Subtitled clip.** Play the clip start to finish with the English subtitles in the band
   under the video.
2. **Highlight stops.** Each time playback reaches a highlighted phrase:
   - the clip **pauses** (freeze frame),
   - a **phone mockup** slides/fades in showing the mockup video of adding that phrase,
   - once that mockup video finishes playing, the clip **resumes**.
   - Repeat for every highlighted phrase, in order.
3. **Outro.** Show the **localized** promo image `public/video/vibeling-<lang>.png`
   **full-screen** (`objectFit: cover`, fills the whole 1080×1920 frame) for **2 seconds**
   (60 frames at 30fps).

## One recipe, many videos (data-driven)

There is **one** component for ALL videos — do NOT make a new `index.tsx` per video.
The component is the reusable recipe; each video is just data:

- **Component (recipe):** `src/SocialVideo/index.tsx`. Takes a `config` prop
  (`SocialVideoData`); timing is derived in `getSocialTiming(fps, config, clipLen)`.
- **Data (per video):** one JSON file in `src/SocialVideo/videos/<slug>.json` with
  `{ slug, clip, highlights, subtitles, outroSec? }`.
  `highlights` are `{ slug, atSec }` (the mockup is `mockups/<lang>/<slug>.mp4`); `subtitles`
  are `{ from, to, text }` in clip seconds. **No `cut`/duration** — the clip is played
  in full and its length is read from the file. The JSON is language-agnostic; the
  per-language strings come from `src/i18n.ts`.
- **Registry:** `src/SocialVideo/schema.ts` **auto-discovers** every `./videos/*.json`
  (via `require.context`), validates each (zod) and exports `videos` — no manual imports.
  `src/Root.tsx` maps `videos × NATIVE_LANGS` → a `Social-<lang>-<slug>` composition each,
  reading the clip's length in `calculateMetadata` (via `parseMedia`) for the total duration.

**`videos/` is the single source of truth — no accumulating garbage.** Add a video by just
dropping a `videos/<slug>.json` (no `schema.ts` edit). **Delete** a video by deleting its
JSON: on the next full run the derived artifacts are pruned automatically —
`npm run render:final` removes its `out/final/<slug>-<lang>.mp4`, `npm run render:mockups`
removes its `public/mockups/<lang>/<slug>.mp4`, and `npm run fetch-words` drops any
`public/words/` illustration and `words.generated.json` entry no longer referenced by a
highlight. (Prune happens on a full run — i.e. `render:final`/`render:mockups` with no
`<slug>`/`<lang>` filter.) The staged clip in `public/clips/` is git-ignored; delete it by hand
if you want the bytes gone.

## Look & feel — house rules (identical for EVERY video)

Reference format: "Английский по фильмам" shorts
(e.g. https://www.youtube.com/shorts/8g8zp0AUpLo). These rules are enforced in
`src/SocialVideo/index.tsx` — keep code and this list in sync.

- **Letterbox, never crop.** The clip is shown **full width, centered, with black bars**
  top/bottom (`objectFit: contain`). Do NOT crop/zoom it to fill the 9:16 frame.
- **Caption/subtitle band.** Text lives in the black area **directly under the video**,
  not over it. Its Y is computed from the clip's real aspect ratio (`dimensions` read via
  `parseMedia` in `calculateMetadata`, passed as `clipAspect`), so it hugs the video for
  any aspect.
- **App tagline.** In the phone mockup, next to the **"VibeLing"** pill sits a localized
  tagline (`STRINGS[lang].tagline`, e.g. "Учим английский язык" / "Aprende inglés") — muted,
  smaller than the pill.
- **Subtitles.** One cue at a time, **centered, bold, soft drop shadow, no background box**,
  ~940px wide, balanced wrapping, ~5-frame fade in/out at each cue's edges. **English on top +
  the native translation underneath** (always), the translation smaller/dimmer per
  `VARIANTS[lang].subtitle`. Keep them legible against the black band — clean, not cramped
  over the footage.
- **Outro full-screen.** The localized promo image (`video/vibeling-<lang>.png`) fills the
  entire frame (`objectFit: cover`), no bars.
- **Sounds** (`public/sounds/`): `click.wav` (`click-soft.wav`) is **baked into each Dictionary
  mockup** at the button tap (see below), so it plays in sync when the social video shows that
  mockup. Use `<Html5Audio>` (not `<Audio>`).
- **Mockup music bed.** While the clip is paused on a mockup (frozen + muted), a soft music
  bed plays (`sounds/inspiring-dreams-soft.wav`, added in the mockup `<Sequence>` of
  `src/SocialVideo/index.tsx` via `MOCKUP_MUSIC`). It restarts each pause and stops when the
  clip resumes. Its level is **pre-baked** (Html5Audio ignores `volume` at render) — to change
  the volume or track, regenerate with `node scripts/soften-audio.mjs <src> public/sounds/inspiring-dreams-soft.wav <gain>`
  (current gain 0.256, source trimmed to 15s from the start — no intro trim). Rather than
  cutting the track's soft ramp-up, the music **starts `MUSIC_LEAD_SEC` (~0.5s) before the
  freeze** (its Sequence overlaps the tail of the preceding play segment) so it's already
  playing when the pause hits. The clip is muted during the pause, so the music is the sole
  audio; keep it clearly audible but not overpowering. Re-render the finals after any change.
  ⚠️ **`Html5Audio`'s `volume` prop is IGNORED during render**, and this project's bundled
  ffmpeg has no working `volume`/`volumedetect` filter. To set a sound's level, **pre-bake the
  gain into the file** with `node scripts/soften-audio.mjs <in> <out.wav> <gain>` (it decodes to
  wav, scales the int16 PCM in Node, writes a canonical wav). That's why the click uses
  `click-soft.wav` (at 0.5 gain). After changing a
  baked sound, **re-render the mockups** (for the click) / the final. The frozen clip under the
  mockups is `muted` so only these sounds play. (Also note: `-ac 1` downmix and
  reading a wav at a fixed offset 44 both give false peak readings — always parse the data
  chunk and measure per-channel when verifying audio levels.)

## Conventions

- Format: 1080×1920 vertical, fps 30. Match `src/Dictionary` for fonts/colors.
- Use `<OffthreadVideo>` for clip/mockup playback; freeze frames via `<Freeze>`.
- Keep timing data-derived so a different clip + highlights just works.

## Implementation notes (decided)

- **Whole clip, no trimming:** the clip plays start to finish. Stage a pre-trimmed scene
  under `public/clips/` (copied via `stage-clip`); `calculateMetadata` reads its length so there is no
  `cut` window or duration to configure. (`OffthreadVideo` `trimBefore`/`trimAfter` is
  still used internally to split the clip at each highlight.)
- **Lead-out pad (don't clip the last syllable):** whisper ends each segment ~a syllable
  early, so a phrase's `to`/`atSec` lands a hair before the word actually finishes. Using it
  verbatim as a hard boundary cuts the last syllable. `PHRASE_LEAD_OUT_SEC` (~0.35s, in
  `src/SocialVideo/index.tsx`) is added to **both** the freeze/pause frame (so the mockup
  pops up only after the phrase finishes) and the subtitle disappearance (so the cue stays up
  through the trailing syllable), capped so it never runs into the next boundary. This is
  automatic — don't hand-pad `atSec` in the JSON. The clip's own **audio always plays in
  full** (the last play `<Sequence>` runs to the file's end; `calculateMetadata` uses
  `Math.ceil` on the clip length so the tail is never shaved). If a finished video still ends
  mid-word, the **source clip file itself was cut too tight** — see the cut/trim steps below.
- **Highlight pauses:** the subtitled clip is split into `<Sequence>`s; at each highlight a
  `<Freeze>`d source frame sits under a dimmed overlay while the mockup `<OffthreadVideo>`
  slides up inside a **CSS phone frame** (no asset). Mockup length comes from
  `getDictionaryTiming(word)`. The frozen frame is the exact clip frame that was showing
  right before the pause, so playback stops and later resumes on the same frame.
  ⚠️ **Freeze correctly:** pick the source frame with `trimBefore={freezeAt}` and hold it
  with `<Freeze frame={0}>` — **not** `<Freeze frame={freezeAt}>`. `<Freeze>` offsets the
  frozen timeline by the enclosing `<Sequence>`'s `from`, so `frame={freezeAt}` on a late
  mockup pushes the internal frame past the composition duration and extracts the wrong
  frame (the bug where "the 2nd word froze on the wrong background frame").
- **Phone frame:** pure CSS (dark rounded bezel) — the mockup is already 1080×1920 (9:16).
- **No first pass / no swipe:** the video opens directly on the subtitled clip (timing
  `cursor` starts at 0). There is no plain playthrough and no wipe transition.
- **Click sound:** baked into the `Dictionary` composition itself — an `<Html5Audio>` of
  `sounds/click-soft.wav` at scene-2 local frame `PRESS_AT` (the button tap). Because it's part of
  the rendered `public/mockups/<lang>/<slug>.mp4`, the social video plays it in sync automatically.
  **After changing the click sound or `PRESS_AT`, re-render the mockups** so it's re-baked.

## Tuning (mostly automatic)

- **`subtitles` + `highlights[].atSec`** — generated by `npm run transcribe -- <slug>` from
  the clip audio; don't hand-author them. Only fix misheard words or nudge a stray timing.
- **Audio handling** — currently the clip's own audio plays; ducking during mockups / a music
  bed is not yet defined.
