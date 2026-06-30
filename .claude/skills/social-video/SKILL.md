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

- **`clip`** — path to the original video clip (a scene from a film). Required.
- **`highlights`** — the phrases/words to highlight, given in advance. For each one the user
  provides the phrase text and a **mockup video path** — a screen recording of adding that
  phrase to the dictionary (shown inside a phone mockup).
- (subtitle text for the scene — English subtitles to overlay on the replay).

Ask the user for anything not supplied. Store clips/mockups under `public/` and reference them
with `staticFile()`.

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

## Scenario (sequence of the produced video)

1. **First pass — plain clip.** Play the original clip start to finish with no overlays.
2. **Pause + swipe.** Freeze the clip on its last frame, then a swipe/wipe transition.
3. **Second pass — subtitled clip.** Play the same clip again, this time with the English
   subtitles overlaid at the top.
4. **Highlight stops.** During the second pass, each time playback reaches a highlighted
   phrase:
   - the clip **pauses** (freeze frame),
   - a **phone mockup** slides/fades in showing the mockup video of adding that phrase,
   - once that mockup video finishes playing, the clip **resumes**.
   - Repeat for every highlighted phrase, in order.
5. **Outro.** Show `public/video/vibeling.png` as a still for **2 seconds** (60 frames at 30fps).

## Conventions

- Format: 1080×1920 vertical, fps 30. Match `src/Dictionary` for fonts/colors.
- Register the composition in `src/Root.tsx`, computing `durationInFrames` from the clip
  length + transitions + mockup videos + the 2s outro (mirror `getDictionaryTiming`'s
  derived-timing pattern).
- Use `<OffthreadVideo>` for clip/mockup playback; freeze frames via `<Freeze>`.
- Keep timing data-derived so a different clip + highlights just works.

## Implementation notes (decided)

- **Composition:** `src/SocialVideo/index.tsx`, registered in `src/Root.tsx` as `SocialVideo`.
  All per-video settings (clip path, cut window, highlights, subtitles) live in the CONFIG
  block at the top of that file; timing is derived in `getSocialTiming(fps)`.
- **Trimming:** the full clip stays in `public/clips/`; the cut window is played with
  `OffthreadVideo` `trimBefore`/`trimAfter` (frames = seconds × fps). No ffmpeg needed.
- **Highlight pauses:** the second pass is split into `<Sequence>`s; at each highlight a
  `<Freeze>`d source frame sits under a dimmed overlay while the mockup `<OffthreadVideo>`
  slides up inside a **CSS phone frame** (no asset). Mockup length comes from
  `getDictionaryTiming(word)`.
- **Phone frame:** pure CSS (dark rounded bezel) — the mockup is already 1080×1920 (9:16).
- **Swipe:** a skewed purple (`COLORS.accent`) panel sweeping left→right over the frozen last
  frame, `SWIPE_FRAMES` long.

## Still placeholder — the user must tune in Studio

- **`HIGHLIGHTS[].atSec`** — clip-local seconds where each phrase is spoken (drives the pause).
- **`SUBTITLES`** — the real transcript + per-line timing of the cut window.
- **Audio handling** — currently the clip's own audio plays; ducking during mockups / a music
  bed is not yet defined.
