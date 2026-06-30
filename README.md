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

This reads the slug list and for each word:

- downloads the page `https://vibeling.app/ru/dictionary/english/<slug>`,
- parses the translation, transcription, part of speech and examples,
- saves the illustration into `public/words/<slug>.jpg`,
- writes everything to `src/Dictionary/words.generated.json`.

> `words.generated.json` and the images in `public/words/` are generated — don't
> edit them by hand. Re-run `npm run fetch-words` whenever you change the slug
> list.

### 3. Preview in the studio

```console
npm run dev
```

Each word becomes its own composition in the sidebar, named
`Dictionary-<slug>` (e.g. `Dictionary-freedom`, `Dictionary-how-are-you`).
Click one to preview and scrub it.

### 4. Render the video

Render one word by its composition id:

```console
npx remotion render Dictionary-freedom out/freedom.mp4
```

The file lands in `out/` (git-ignored). Swap the id for any other word.

## How it fits together

| File | Role |
| --- | --- |
| `src/Dictionary/words.json` | **The only file you edit** — the list of slugs. |
| `scripts/fetch-words.mjs` | Parser: slug list → content + images. Run via `npm run fetch-words`. |
| `src/Dictionary/words.generated.json` | Generated content for every word. |
| `public/words/*.jpg` | Generated illustrations (served via Remotion `staticFile`). |
| `src/Dictionary/schema.ts` | The word data shape (Zod schema) + loads the generated data. |
| `src/Dictionary/index.tsx` | The shared scenario: search/typing scene + word-detail scene. |
| `src/Dictionary/ui.tsx`, `Keyboard.tsx` | Reusable UI pieces (status bar, search bar, keyboard…). |
| `src/Root.tsx` | Registers one `Dictionary-<slug>` composition per word. |

Timing (typing speed, scene transition, total length) is derived from the word
length in `getDictionaryTiming`, so short words and long phrases both fit.

## Why content is fetched at build time (not during render)

Remotion renders inside a headless browser, where a live cross-origin request to
vibeling.app would be blocked by CORS, and remote images are less reliable than
local ones. Fetching once with `npm run fetch-words` keeps renders fast,
reproducible and offline-friendly.

## Social videos (movie-scene → reels)

A second composition, `SocialVideo`, turns a movie-scene clip into a vertical
(1080×1920, 30fps) social video: it plays the clip, swipes, replays it with
English subtitles, and pauses on chosen phrases to show a phone mockup of adding
them to the dictionary.

The clip is played **in full** — pre-trim it to the scene you want before staging
it; the video's total length is read from the file automatically (no start/end and
no duration to configure).

Like the word videos, the **recipe is shared** (one component) and each video is
just **data**: one JSON file per video in `src/SocialVideo/videos/`. You never
copy a new `index.tsx` per video.

### Make a new social video — step by step

#### 1. Stage the source clip (symlink, not a copy)

The heavy original stays on disk; only a symlink lands in the project (Remotion
can read files under `public/` only):

```console
npm run stage-clip -- /path/to/original.mp4 my-scene.mp4
```

This creates `public/clips/my-scene.mp4 → /path/to/original.mp4`
(`public/clips` is git-ignored).

#### 2. Build the phone mockups for the highlighted phrases

Each highlighted phrase needs a mockup video, rendered from the `Dictionary`
composition. For every phrase:

1. add its slug to [`src/Dictionary/words.json`](src/Dictionary/words.json) and
   run `npm run fetch-words` (see the word-video steps above), then
2. render the mockup into `public/mockups/<slug>.mp4`:

   ```console
   npx remotion render Dictionary-<slug> public/mockups/<slug>.mp4
   ```

   The mockup filename must equal the phrase slug — the composition looks up
   `mockups/<slug>.mp4` automatically.

#### 3. Write the video's JSON

Create `src/SocialVideo/videos/<slug>.json`:

```json
{
  "slug": "my-scene",
  "clip": "clips/my-scene.mp4",
  "highlights": [
    { "slug": "im-the-danger", "atSec": 12 },
    { "slug": "knock-knock", "atSec": 28 }
  ],
  "subtitles": [
    { "from": 10, "to": 14, "text": "I am the danger." },
    { "from": 26, "to": 30, "text": "Knock knock." }
  ]
}
```

- `clip` plays in full; its length is read from the file (no `cut`/duration).
- `highlights[].atSec` — clip second where the phrase finishes; that's where the
  clip pauses to show `mockups/<slug>.mp4`.
- `subtitles` — `from`/`to`/`text` in clip seconds.
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

#### 5. Tune the timing in the studio

```console
npm run dev
```

Open `Social-my-scene`, scrub it, and adjust `atSec` and the subtitle timings in
the JSON until they match the clip. The studio re-reads the JSON live.

#### 6. Render

```console
npm run render:final -- my-scene     # one video → out/final/my-scene.mp4
npm run render:final                 # render every video in src/SocialVideo/videos/
```

### Where renders go

`out/` is git-ignored and split into three folders:

| Folder | What | Command |
| --- | --- | --- |
| `out/final/` | finished social videos, named by slug | `npm run render:final [-- <slug>]` |
| `out/renders/` | scratch composition renders (e.g. a `Dictionary-<slug>` preview) | `npm run render:preview <id>` |
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
