# Dictionary word videos

A [Remotion](https://www.remotion.dev) project that turns a single word into a
short vertical (1080×1920) video in the style of a dictionary app: a search +
typing intro, then a word card with image, transcription, translation and usage
examples.

The scenario (layout + animations) is shared. The **content** for each word —
translation, examples, transcription, part of speech and illustration — is
pulled automatically from [vibeling.app](https://vibeling.app) by its URL slug.
You only ever edit a list of words.

## Setup

```console
npm i
```

## Make a new video — step by step

### 1. Add the word(s)

Edit [`src/Dictionary/words.json`](src/Dictionary/words.json). It is just a list
of **slugs** — the part of the vibeling.app URL after `…/english/`:

```json
[
  "freedom",
  "apple",
  "run",
  "how-are-you"
]
```

- Single word → the word itself: `"freedom"`.
- A phrase → words joined by dashes, exactly as in the site URL:
  `"how-are-you"` (from `https://vibeling.app/ru/dictionary/english/how-are-you`).

### 2. Fetch the content

```console
npm run fetch-words
```

This reads the slug list and, for each word **× each target language** (`ru`, `es` —
see `TARGET_LANGS` in the script), calls the real vibeling backend API:

- `POST https://api.vibeling.app/translate` — the native translation of the phrase,
- `POST https://api.vibeling.app/word` — transcription, part of speech, examples,
- saves the illustration into `public/words/<slug>.jpg` (shared across languages),
- writes everything to `src/Dictionary/words.generated.json` as `{ [lang]: WordData[] }`.

> `words.generated.json` and the images in `public/words/` are generated — don't
> edit them by hand. Re-run `npm run fetch-words` whenever you change the slug list.

### 3. Preview in the studio

```console
npm run dev
```

Each word × language becomes its own composition, named `Dictionary-<lang>-<slug>`
(e.g. `Dictionary-ru-freedom`, `Dictionary-es-how-are-you`). Click one to preview.

### 4. Render the video

Render one word by its composition id:

```console
npx remotion render Dictionary-ru-freedom out/renders/freedom-ru.mp4
```

The file lands in `out/` (git-ignored). Swap the id for any other word × language.

## How it fits together

| File | Role |
| --- | --- |
| `src/Dictionary/words.json` | **The only file you edit** — the list of English slugs. |
| `scripts/fetch-words.mjs` | Calls the vibeling API per slug × language → content + images. |
| `src/Dictionary/words.generated.json` | Generated content, keyed by language. |
| `public/words/*.jpg` | Generated illustrations (served via Remotion `staticFile`). |
| `src/i18n.ts` | `NATIVE_LANGS` + all fixed UI strings, per language. |
| `src/Dictionary/schema.ts` | The word data shape (Zod schema) + loads the generated data. |
| `src/Dictionary/index.tsx` | The shared scenario: search/typing scene + word-detail scene. |
| `src/Dictionary/ui.tsx`, `Keyboard.tsx` | Reusable UI pieces (status bar, search bar, keyboard…). |
| `src/Root.tsx` | Registers a `Dictionary-<lang>-<slug>` composition per word × language. |

Timing (typing speed, scene transition, total length) is derived from the word
length in `getDictionaryTiming`, so short words and long phrases both fit.

## Why content is fetched at build time (not during render)

Remotion renders inside a headless browser, where live cross-origin API calls
would be blocked by CORS and remote images are less reliable than local ones.
Fetching once with `npm run fetch-words` keeps renders fast, reproducible and
offline-friendly.

## Social videos (movie-scene → reels)

A second composition, `SocialVideo`, turns a movie-scene clip into a vertical
(1080×1920, 30fps) social video: it plays the clip, swipes, replays it with
English subtitles, and pauses on chosen phrases to show a phone mockup of adding
them to the dictionary.

The clip is played **in full** — pre-trim it to the scene you want before staging
it; the video's total length is read from the file automatically (no start/end and
no duration to configure).

House look (same for every video): the clip is shown **full width, centered, with
black bars** (never cropped). The branding line sits **above** the video and the
subtitles/subcaption **below** it. These rules are baked into `src/SocialVideo/index.tsx`.

**One English clip → one video per audience language.** The clip and English
subtitles are the same; the branding, the mockup card, and the mockup UI labels are
localized per language via `src/i18n.ts` (`NATIVE_LANGS`, currently `ru` + `es`).
Compositions are `Social-<lang>-<slug>`; finals are `out/final/<slug>-<lang>.mp4`.

Like the word videos, the **recipe is shared** (one component) and each video is
just **data**: one JSON file per video in `src/SocialVideo/videos/` (language-agnostic).
You never copy a new `index.tsx` per video.

### Make a new social video — step by step

#### 1. Stage the source clip

Remotion can only read files under `public/`, so copy the clip there:

```console
npm run stage-clip -- /path/to/original.mov my-scene.mov
```

This copies it to `public/clips/my-scene.mov`. It has to be a real copy, not a
symlink (Remotion's bundler/static server don't handle symlinked media). The copy
is never committed (`public/clips` is git-ignored) and your original stays put.

#### 2. Build the phone mockups for the highlighted phrases

Each highlighted phrase needs a mockup video per language, rendered from the
`Dictionary` composition:

1. add its slug to [`src/Dictionary/words.json`](src/Dictionary/words.json) and
   run `npm run fetch-words` (see the word-video steps above), then
2. render all needed mockups (every highlight × language) into
   `public/mockups/<lang>/<slug>.mp4`:

   ```console
   npm run render:mockups
   ```

   The social video looks up `mockups/<lang>/<slug>.mp4` automatically.

#### 3. Write the video's JSON

Create `src/SocialVideo/videos/<slug>.json`:

```json
{
  "slug": "my-scene",
  "clip": "clips/my-scene.mov",
  "highlights": [
    { "slug": "im-the-danger", "atSec": 0 },
    { "slug": "knock-knock", "atSec": 0 }
  ],
  "subtitles": []
}
```

- `clip` plays in full; its length is read from the file (no `cut`/duration).
- `highlights[].slug` — which phrases to pause on (the only thing you pick by hand).
  `atSec` is filled in by the transcription step below.
- `subtitles` are generated in the next step — leave the array empty.
- Optional: `swipeFrames` (default 18), `outroSec` (default 2).

#### 4. Register it

In [`src/SocialVideo/schema.ts`](src/SocialVideo/schema.ts) add one import and
push it into `sources`:

```ts
import myScene from "./videos/my-scene.json";

const sources: unknown[] = [sayMyName, myScene];
```

The JSON is validated (Zod) on load, and `src/Root.tsx` automatically registers a
`Social-<slug>` composition.

#### 5. Generate subtitles from the audio

```console
npm run transcribe -- my-scene
```

Extracts the clip's audio (bundled ffmpeg), runs whisper.cpp (`small.en`), and writes
the `subtitles` (one line per spoken sentence, with real timings) plus each highlight's
`atSec` into the JSON. **Don't hand-write subtitles** — they'll be mistimed. First run
installs whisper.cpp + the model (cached afterwards).

#### 6. Check / fine-tune (optional)

```console
npm run dev
```

Open `Social-<lang>-my-scene` and scrub. Usually you only fix a misheard word (e.g.
whisper writes "Eisenberg" for "Heisenberg") or nudge a stray timing in the JSON. The
studio re-reads it live.

#### 7. Render

```console
npm run render:final -- my-scene        # one scene, every language → out/final/my-scene-<lang>.mp4
npm run render:final -- my-scene es     # one scene, one language
npm run render:final                    # every scene × every language
```

#### 8. Captions for upload

The **`video-description`** skill writes upload-ready titles, captions and hashtags
(TikTok / YouTube Shorts / Instagram) — one `out/final/<slug>-<lang>.md` per language,
with the film name (from the JSON's `film` field) in every title.

### Where renders go

`out/` is git-ignored and split into three folders:

| Folder | What | Command |
| --- | --- | --- |
| `out/final/` | finished social videos, named `<slug>-<lang>` | `npm run render:final [-- <slug> [<lang>]]` |
| `out/renders/` | scratch composition renders (e.g. a `Dictionary-<lang>-<slug>` preview) | `npm run render:preview <id>` |
| `out/images/` | screenshots / verification stills | — |

## Other commands

```console
npm run lint            # eslint + tsc
npx remotion upgrade    # upgrade Remotion
```

## Remotion docs & help

- [Fundamentals](https://www.remotion.dev/docs/the-fundamentals)
- [Discord](https://discord.gg/6VzzNDwUwV)
- [Issues](https://github.com/remotion-dev/remotion/issues/new)

Note that for some entities a company license is needed.
[Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
