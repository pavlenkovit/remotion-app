---
name: social-video
description: Build a social-media video (Remotion) from a movie-scene clip — play it with English subtitles, pausing on highlighted phrases to show a phone mockup of adding that phrase to the dictionary. Use when the user asks to make a social/reels video from a film clip.
---

# Social Video

Builds a vertical (1080×1920, 30fps) Remotion video for social media out of a movie-scene
clip. The video teaches English vocabulary: it plays a scene with English subtitles and
pauses on chosen phrases to demo adding them to the dictionary app.

This is a Remotion project — read `.claude/skills/remotion-best-practices` and the existing
`src/Dictionary` composition for the house style (colors, springs, `interpolate`, `staticFile`).

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
   over the staged copy. End on a punchy beat, not dead air.
4. **Create the video JSON** (`src/SocialVideo/videos/<slug>.json`) with `slug`, `clip`,
   `film`, `highlights: []`, `subtitles: []`, and register it in `schema.ts`.
5. **Pick 3–4 highlights yourself** (see "Choosing highlights" below), add them to the JSON.
6. **Transcribe** (`npm run transcribe -- <slug>`) to fill subtitles + set each `atSec`, then
   **delete any trailing hallucinated lines** (whisper invents "Thank you." / "[silence]" over
   panting/quiet tails — remove them so subtitles stop with the last real line).
7. **Generate the mockups:** add the slugs to `src/Dictionary/words.json`, `npm run
   fetch-words`, `npm run render:mockups`.
8. **Render finals:** `npm run render:final -- <slug>`.
9. **Write the descriptions:** run the `video-description` skill for the slug.

### Choosing highlights (you pick them)

Pick **3–4** phrases from the transcribed dialogue that make good teaching material AND drive
engagement. Good mix: **1–2 genuinely useful idioms/expressions** (e.g. "goes belly up",
"clue you in") + **the iconic/quotable lines** of the scene (e.g. "I am the danger", "I am the
one who knocks"). Rules:

- Each highlight's **`slug` must be the spoken words hyphenated** (e.g. `goes-belly-up`) —
  `transcribe` locates it by collapsing the slug to `[a-z0-9]` and finding the segment whose
  text contains it, then sets `atSec` to that segment's end. If a phrase can't be matched this
  way, pick a different chunk.
- **Space them out** across the clip so pauses don't bunch up (each mockup adds ~5s).
- Prefer phrases that are real, reusable English — not filler. Iconic lines are fine because
  they're memorable, but include at least one broadly-useful expression.

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
changes per language is the branding captions, the mockup card content, and the mockup UI
labels — all localized via `src/i18n.ts`. Compositions are `Social-<lang>-<slug>` and
`Dictionary-<lang>-<slug>`; finals are `out/final/<slug>-<lang>.mp4`.

**To add a language:** add it to `NATIVE_LANGS` + `STRINGS` in `src/i18n.ts` and to
`TARGET_LANGS` in `scripts/fetch-words.mjs`, then re-run the pipeline below.

## Generating the phrase mockups (do this first)

The phone-mockup "adding the phrase" videos are **rendered from this project's `Dictionary`
composition** — one per (highlighted phrase × language). Generate them:

1. **Add slugs to the config.** Append each phrase's English slug to
   `src/Dictionary/words.json` (lowercase, hyphenated, e.g. `say my name` → `say-my-name`).
2. **Pull the data from the real backend API.** Run `npm run fetch-words`. For every slug ×
   language it calls the vibeling API (`POST https://api.vibeling.app/translate` then `/word`
   with header `X-App-Secret`), downloads the illustration into `public/words/`, and writes
   `src/Dictionary/words.generated.json` as `{ [lang]: WordData[] }`. (No more HTML scraping.)
   Each entry becomes a `Dictionary-<lang>-<slug>` composition.
3. **Render the mockups:** `npm run render:mockups` — renders every highlight × language into
   `public/mockups/<lang>/<slug>.mp4` (the files the social video plays inside the phone frame).

## Subtitles & highlight timing — transcribe, don't guess

**Never hand-guess subtitle text or timings** (you can't hear the clip — guesses are wrong).
After staging the clip and creating the video JSON, run:

```
npm run transcribe -- <slug>
```

This extracts the clip's audio (Remotion's bundled ffmpeg), runs whisper.cpp (`small.en`),
and writes `subtitles` (one line per spoken sentence, real `from`/`to`) into
`src/SocialVideo/videos/<slug>.json` — and sets each highlight's `atSec` to where its phrase
is actually spoken (collapsed substring match; warns if a phrase isn't found). First run
installs whisper.cpp + the model (cached afterward). Then only **correct misheard proper
nouns** (e.g. whisper writes "Eisenberg" for "Heisenberg") and nudge if needed.

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

## Scenario (sequence of the produced video)

There is **no plain first pass and no swipe** — the video starts straight on the subtitled clip.

1. **Subtitled clip.** Play the clip start to finish with the English subtitles in the band
   under the video.
2. **Highlight stops.** Each time playback reaches a highlighted phrase:
   - the clip **pauses** (freeze frame),
   - a **phone mockup** slides/fades in showing the mockup video of adding that phrase,
   - once that mockup video finishes playing, the clip **resumes**.
   - Repeat for every highlighted phrase, in order.
3. **Outro.** Show `public/video/vibeling.png` **full-screen** (`objectFit: cover`, fills the
   whole 1080×1920 frame) for **2 seconds** (60 frames at 30fps).

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
- **Registry:** `src/SocialVideo/schema.ts` validates each JSON (zod) and exports `videos`.
  `src/Root.tsx` maps `videos × NATIVE_LANGS` → a `Social-<lang>-<slug>` composition each,
  reading the clip's length in `calculateMetadata` (via `parseMedia`) for the total duration.

**To add a new video:** drop a `videos/<slug>.json`, import it in `schema.ts` and add it
to `sources`. That's it — no component changes, no new file per video.

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
- **Subtitles.** One cue at a time, **centered, bold white, soft drop
  shadow, no background box**, max ~920px wide, balanced wrapping, ~5-frame fade in/out at
  each cue's edges. Keep them legible against the black band — clean, not cramped over the
  footage.
- **Outro full-screen.** The promo image fills the entire frame (`objectFit: cover`), no bars.
- **Sounds** (`public/sounds/`): `click.wav` (`click-soft.wav`) is **baked into each Dictionary
  mockup** at the button tap (see below), so it plays in sync when the social video shows that
  mockup. Use `<Html5Audio>` (not `<Audio>`).
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
