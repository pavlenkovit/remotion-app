---
name: video-description
description: Generate upload-ready captions (TikTok / YouTube Shorts / Instagram Reels) for a rendered social-video — ONE file per video holding every language (ru first, then es), each caption a single continuous copy-paste block (no title/description/hashtags split). Use when the user wants descriptions/captions for the videos produced by the social-video skill.
---

# Video Description

Writes the social-media copy for each rendered social video. The videos come from the
`social-video` skill (`Social-<lang>-<slug>`, one per audience language); this skill produces
a ready-to-paste **caption** for TikTok, YouTube Shorts and Instagram Reels, in the audience's
language. Each platform's copy is ONE continuous block of text separated by line breaks — no
"title / description / hashtags" split — and the **film name always appears in the copy**.

You (the model) write the copy directly — there is no API for it. Follow the rules below.

## Inputs

Invoked with a video **slug** (or "all"). For each slug:

1. Read `src/SocialVideo/videos/<slug>.json`:
   - **`film`** — the movie/show name (e.g. "Breaking Bad"), when the video declares one.
     A video with NO `film` field is deliberately unattributed (the source couldn't be
     identified with confidence) — then name no film anywhere: no title mention, no
     `#BreakingBad`-style tag, no character names. Write the copy from the dialogue context
     instead ("мама возмущается, что дочь…"). Never guess a film to fill the gap.
   - **`highlights[].slug`** — the phrases taught (English), e.g. `say-my-name`, `goddamn-right`.
   - **`subtitles[].text`** — the scene's English dialogue (context for the hook).
   - **`hook[lang]`** — the banner headline burned into the video for that language. Use it as
     the angle for the caption (don't just copy it verbatim — the caption should extend it).
2. Languages: the keys of `src/Dictionary/words.generated.json` (currently `ru`, `es`) — same
   set as `NATIVE_LANGS` in `src/i18n.ts`. Write copy in each audience language.
3. The native translations of each phrase live in `words.generated.json`
   (`{[lang]:[{slug,word,translation}]}`) — use them so the caption is in the right language.

## Output

**ONE markdown file per video** — all languages in it, next to the rendered mp4s:

```
out/final/<slug>.md        (mp4s are out/final/<slug>-<lang>.mp4, one per language)
```

Languages are `##` sections in `NATIVE_LANGS` order — **Russian first, then Spanish** —
and the platforms are `###` sections inside each.

**Do NOT split into "Title / Description / Hashtags" fields.** Each platform section
is ONE continuous, copy-paste-ready block of text separated by line breaks — exactly
what you'd paste into the post box: the caption text, then the hashtags on their own
line(s). No `**Title:**` / `**Caption:**` / `**Hashtags:**` labels. Structure the file
like this (each caption in its own audience language):

```md
# <Film> — <phrase(s)>

## 🇷🇺 Русский

### TikTok
<caption text — film name + phrase(s) + translation + hook + CTA, as flowing
sentences broken across a few lines>

<hashtags on their own line>

### Instagram Reels
<caption text>

<hashtags>

### YouTube Shorts
<caption text; end the copy with #Shorts>

<hashtags>

### Дзен            ← ru only, always last in the ru section
<описание, СТРОГО ≤200 символов с пробелами>

<ключ, ключ, ключ, … — через запятую, без #>

## 🇪🇸 Español

### TikTok
…                    ← same platforms, no Дзен
```

### Platform order (it's the posting order)

Inside each language the sections appear in the order the user posts them, so the file is read
top to bottom while publishing — **TikTok, Instagram Reels, YouTube Shorts**. `ru` then gets
**Дзен last**; other languages stop after YouTube Shorts (Дзен is a Russian-language
platform). Same copy rules everywhere; only that last ru-only section differs.

### Дзен (ru only)

Дзен has **two separate input fields**, so this section is the one place with two blocks
instead of one:

1. **Описание — hard limit 200 characters including spaces.** Count them; if it's over,
   cut, don't hope. Same content as elsewhere (film + phrase + translation + a nudge to the
   app), just compressed to the essentials. No hashtags here — Дзен doesn't use them.
2. **Ключи — a comma-separated line of EXACTLY 5** (Дзен's limit), lowercase, **no `#`**,
   plain search phrases rather than tags. Five slots is nothing, so spend them on **reach,
   not precision** — pick what the most people actually search:
   - the film's **Russian** title first (`во все тяжкие` — far bigger demand than the English
     one), then the English title;
   - one "how they'd find us" phrase matching the source (`английский по сериалам` for a
     series, `английский по фильмам` for a film);
   - one or two broad learner queries (`разговорный английский`, `учить английский`).
   - **Drop the brand** (`vibeling`) and the phrase itself (`tread lightly`) — nobody searches
     them; at 10 keys they were free, at 5 they cost a real slot.

## Copy rules

- **One continuous block per platform** — no field labels, no separate title. Write it as
  flowing text broken over a few lines, then the hashtags on their own line. It should read
  as a single caption you can paste straight into the post box.
- **The film name always appears in the copy** (ideally in the first line), e.g. lead with
  `The Office: «…»` / `Breaking Bad: «…»`. It replaces the old "title" — just fold it into the
  opening sentence. For a video with no `film` (see Inputs), open with the situation from the
  dialogue instead and keep every film reference out.
- **Language:** write in the audience's native language (ru/es). Keep the English phrase(s) in
  quotes, and include the native translation somewhere in the text.
- **Hook:** lead with curiosity/relatability ("Знаешь, как сказать …?" / "¿Sabes decir …?").
- **What they learn:** name the phrase(s) and that it's real movie English.
- **CTA:** promote the app — "Учи английский по фильмам в VibeLing" / "Aprende inglés con
  películas en VibeLing". Mention it's free / on the App Store & Google Play when it fits.
- **Hashtags** on their own line at the end of the block. Count is per platform:
  **Instagram Reels — EXACTLY 5, that's the hard cap Instagram enforces**; TikTok and
  YouTube Shorts — 8–15. With only 5 slots on Instagram, spend them on reach, not
  precision: one film tag, one brand tag (`#VibeLing`), two broad learning tags, one
  platform tag (`#reels` / `#parati`) — and drop the niche synonyms. A mix of
  - learning: `#английскийпофильмам #учуанглийский` / `#aprenderinglés #inglésconpelículas`
  - the film: `#BreakingBad` (+ actor/character if famous)
  - platform: `#reels #shorts #fyp #рекомендации` / `#parati`
  - brand: `#VibeLing`
- Tasteful emoji are fine (1–3). No clickbait lies.
- Per platform length: TikTok = short and punchy; YouTube Shorts = a fuller 1–2 sentences and
  end the copy with `#Shorts`; Instagram = caption then hashtags on their own line.

## Notes

- Overwrite existing `.md` on re-run.
- If the user only wants one platform or one language, produce just that.
- Keep the film name spelled correctly and localized if it has an official local title
  (e.g. keep "Breaking Bad" as-is — it's used untranslated in ru/es).
