---
name: social-video
description: Build a social-media video (Remotion) from a movie-scene clip — play it, swipe, replay with English subtitles, and pause on highlighted phrases to show a phone mockup of adding that phrase to the dictionary. Use when the user asks to make a social/reels video from a film clip.
---

# Social Video

Builds a vertical (1080×1920, 30fps) Remotion video for social media out of a movie-scene
clip. The video teaches English vocabulary: it shows a scene, replays it with subtitles, and
pauses on chosen phrases to demo adding them to the dictionary app.

This is a Remotion project — read `.claude/skills/remotion-best-practices` and the existing
`src/Dictionary` composition for the house style (colors, springs, `interpolate`, `staticFile`).

## Inputs

The skill is invoked with:

- **`clip`** — path to the video clip, already trimmed to the scene you want (it plays in
  full — there is no in-app trimming). Required.
- **`highlights`** — the phrases/words to highlight, given in advance. For each one the user
  provides the phrase text and a **mockup video path** — a screen recording of adding that
  phrase to the dictionary (shown inside a phone mockup).
- (subtitle text for the scene — English subtitles to overlay on the replay).

Ask the user for anything not supplied.

**Stage the clip into `public/clips/`** (Remotion can only read files under `public/`):

```
npm run stage-clip -- /abs/path/to/original.mov
```

This **copies** the file to `public/clips/<name>`. It must be a real copy, not a symlink:
Remotion's webpack bundler crashes on symlinked media and its static server 404s on them.
`public/clips` is git-ignored, so the copy is never committed and the original stays wherever
it lives on disk. Then set `"clip": "clips/<name>"` in the video's JSON
(`src/SocialVideo/videos/<slug>.json`). Mockups also live under `public/mockups/`.

## Generating the phrase mockups (do this first)

The phone-mockup "adding the phrase" videos are **rendered from this project's `Dictionary`
composition** — one per highlighted phrase. Do NOT expect the user to supply them as files;
generate them:

1. **Add slugs to the config.** Append each phrase's vibeling.app slug to
   `src/Dictionary/words.json`. Slugs are lowercase, hyphenated, apostrophes/punctuation
   dropped (e.g. `say my name` → `say-my-name`). Verify the page exists first:
   `curl -s -o /dev/null -w "%{http_code}" https://vibeling.app/ru/dictionary/english/<slug>`
   — a `200` means it's there, `404` means the phrase has no page yet (flag it to the user;
   the pipeline can only pull pages that already exist on vibeling.app).
2. **Pull the data.** Run `npm run fetch-words`. This scrapes each page, downloads the
   illustration into `public/words/`, and writes `src/Dictionary/words.generated.json`. Each
   slug becomes a `Dictionary-<slug>` composition in the Studio (see `src/Root.tsx`).
3. **Render the mockup video** for each phrase:
   `npx remotion render Dictionary-<slug> public/mockups/<slug>.mp4`
   These rendered files are the mockup videos the social video plays inside the phone frame.

The social-video composition then references `public/mockups/<slug>.mp4` for each highlight.

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
- **`out/renders/`** — scratch Remotion video renders (e.g. a `Dictionary-<slug>`
  preview). Use `npm run render:preview <composition-id>`.
- **`out/final/`** — the finished social videos, one per scene, named by the
  video's `slug` (e.g. `say-my-name-breaking-bad.mp4`), **never** `social-video.mp4`.
  Render with `npm run render:final` (all videos) or
  `npm run render:final -- <slug>` (one).

Note: the phone-mockup videos that the composition plays via `staticFile()` are
NOT "out" artifacts — they belong in `public/mockups/<slug>.mp4` (see below).

## Scenario (sequence of the produced video)

1. **First pass — plain clip.** Play the clip start to finish, with the branding caption
   **"Учим английский по фильмам"** under the video (no subtitles yet).
2. **Pause + swipe.** Freeze the clip on its last frame, then a swipe/wipe transition.
3. **Second pass — subtitled clip.** Play the same clip again with the English subtitles
   in the band under the video.
4. **Highlight stops.** During the second pass, each time playback reaches a highlighted
   phrase:
   - the clip **pauses** (freeze frame),
   - a **phone mockup** slides/fades in showing the mockup video of adding that phrase,
   - once that mockup video finishes playing, the clip **resumes**.
   - Repeat for every highlighted phrase, in order.
5. **Outro.** Show `public/video/vibeling.png` as a still for **2 seconds** (60 frames at 30fps).

## One recipe, many videos (data-driven)

There is **one** component for ALL videos — do NOT make a new `index.tsx` per video.
The component is the reusable recipe; each video is just data:

- **Component (recipe):** `src/SocialVideo/index.tsx`. Takes a `config` prop
  (`SocialVideoData`); timing is derived in `getSocialTiming(fps, config, clipLen)`.
- **Data (per video):** one JSON file in `src/SocialVideo/videos/<slug>.json` with
  `{ slug, clip, highlights, subtitles, swipeFrames?, outroSec? }`.
  `highlights` are `{ slug, atSec }` (the mockup is `mockups/<slug>.mp4`); `subtitles`
  are `{ from, to, text }` in clip seconds. **No `cut`/duration** — the clip is played
  in full and its length is read from the file.
- **Registry:** `src/SocialVideo/schema.ts` validates each JSON (zod) and exports `videos`.
  `src/Root.tsx` maps `videos` → a `Social-<slug>` composition each, reading the clip's
  length in `calculateMetadata` (via `parseMedia`) to set the total duration.

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
- **First pass caption.** Show the fixed branding line **"Учим английский по фильмам"**
  (constant `INTRO_CAPTION`) under the video for the whole plain pass; gentle fade-in.
- **Subtitles (second pass).** One cue at a time, **centered, bold white, soft drop
  shadow, no background box**, max ~920px wide, balanced wrapping, ~5-frame fade in/out at
  each cue's edges. Keep them legible against the black band — clean, not cramped over the
  footage.

## Conventions

- Format: 1080×1920 vertical, fps 30. Match `src/Dictionary` for fonts/colors.
- Use `<OffthreadVideo>` for clip/mockup playback; freeze frames via `<Freeze>`.
- Keep timing data-derived so a different clip + highlights just works.

## Implementation notes (decided)

- **Whole clip, no trimming:** the clip plays start to finish. Stage a pre-trimmed scene
  under `public/clips/` (copied via `stage-clip`); `calculateMetadata` reads its length so there is no
  `cut` window or duration to configure. (`OffthreadVideo` `trimBefore`/`trimAfter` is
  still used internally to split the second pass at each highlight.)
- **Highlight pauses:** the second pass is split into `<Sequence>`s; at each highlight a
  `<Freeze>`d source frame sits under a dimmed overlay while the mockup `<OffthreadVideo>`
  slides up inside a **CSS phone frame** (no asset). Mockup length comes from
  `getDictionaryTiming(word)`.
- **Phone frame:** pure CSS (dark rounded bezel) — the mockup is already 1080×1920 (9:16).
- **Swipe:** a skewed purple (`COLORS.accent`) panel sweeping left→right over the frozen last
  frame, `swipeFrames` long (config; default 18).

## Tuning (mostly automatic)

- **`subtitles` + `highlights[].atSec`** — generated by `npm run transcribe -- <slug>` from
  the clip audio; don't hand-author them. Only fix misheard words or nudge a stray timing.
- **Audio handling** — currently the clip's own audio plays; ducking during mockups / a music
  bed is not yet defined.
