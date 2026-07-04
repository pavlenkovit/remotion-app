---
name: video-description
description: Generate upload-ready captions (TikTok / YouTube Shorts / Instagram Reels) for a rendered social-video — one file per language, each a single continuous copy-paste block (no title/description/hashtags split) with the FILM NAME in the copy. Use when the user wants descriptions/captions for the videos produced by the social-video skill.
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
   - **`film`** — the movie/show name (e.g. "Breaking Bad"). If missing, infer it from the
     slug's trailing words or ASK the user; never omit it from the title.
   - **`highlights[].slug`** — the phrases taught (English), e.g. `say-my-name`, `goddamn-right`.
   - **`subtitles[].text`** — the scene's English dialogue (context for the hook).
2. Languages: the keys of `src/Dictionary/words.generated.json` (currently `ru`, `es`) — same
   set as `NATIVE_LANGS` in `src/i18n.ts`. Write copy in each audience language.
3. The native translations of each phrase live in `words.generated.json`
   (`{[lang]:[{slug,word,translation}]}`) — use them so the caption is in the right language.

## Output

One markdown file per (video × language), next to the rendered mp4:

```
out/final/<slug>-<lang>.md      (mp4 is out/final/<slug>-<lang>.mp4)
```

**Do NOT split into "Title / Description / Hashtags" fields.** Each platform section
is ONE continuous, copy-paste-ready block of text separated by line breaks — exactly
what you'd paste into the post box: the caption text, then the hashtags on their own
line(s). No `**Title:**` / `**Caption:**` / `**Hashtags:**` labels. Structure each file
like this (in the audience's language):

```md
# <Film> — <phrase(s)>  ·  <lang>

## TikTok
<caption text — film name + phrase(s) + translation + hook + CTA, as flowing
sentences broken across a few lines>

<hashtags on their own line>

## YouTube Shorts
<caption text; end the copy with #Shorts>

<hashtags>

## Instagram Reels
<caption text>

<hashtags>
```

## Copy rules

- **One continuous block per platform** — no field labels, no separate title. Write it as
  flowing text broken over a few lines, then the hashtags on their own line. It should read
  as a single caption you can paste straight into the post box.
- **The film name always appears in the copy** (ideally in the first line), e.g. lead with
  `The Office: «…»` / `Breaking Bad: «…»`. It replaces the old "title" — just fold it into the
  opening sentence.
- **Language:** write in the audience's native language (ru/es). Keep the English phrase(s) in
  quotes, and include the native translation somewhere in the text.
- **Hook:** lead with curiosity/relatability ("Знаешь, как сказать …?" / "¿Sabes decir …?").
- **What they learn:** name the phrase(s) and that it's real movie English.
- **CTA:** promote the app — "Учи английский по фильмам в VibeLing" / "Aprende inglés con
  películas en VibeLing". Mention it's free / on the App Store & Google Play when it fits.
- **Hashtags (8–15)** on their own line at the end of the block, a mix of
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
