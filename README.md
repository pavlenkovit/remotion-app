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
