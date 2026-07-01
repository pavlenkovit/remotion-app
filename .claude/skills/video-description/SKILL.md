---
name: video-description
description: Generate upload-ready titles, captions and hashtags (TikTok / YouTube Shorts / Instagram Reels) for a rendered social-video — one file per language, with the FILM NAME in every title. Use when the user wants descriptions/captions for the videos produced by the social-video skill.
---

# Video Description

Writes the social-media copy for each rendered social video. The videos come from the
`social-video` skill (`Social-<lang>-<slug>`, one per audience language); this skill produces
the matching **title + caption + hashtags** for TikTok, YouTube Shorts and Instagram Reels,
in the audience's language, and the **film name is always in the title**.

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

Structure each file like this (in the audience's language):

```md
# <Film> — <phrase(s)>  ·  <lang>

## TikTok
**Title:** …
**Caption:** …
**Hashtags:** …

## YouTube Shorts
**Title:** …
**Description:** …
**Hashtags:** …

## Instagram Reels
**Caption:** …
**Hashtags:** …
```

## Copy rules

- **Title always contains the film name.** Pattern: `<Film>: «<phrase>» — <hook>` (localized).
  Keep it under ~100 chars (TikTok/IG especially). YouTube Shorts titles may be a touch longer
  and more descriptive; end them with `#Shorts`.
- **Language:** write in the audience's native language (ru/es). Keep the English phrase(s) in
  quotes, and include the native translation somewhere in the caption.
- **Hook:** lead with curiosity/relatability ("Знаешь, как сказать …?" / "¿Sabes decir …?").
- **What they learn:** name the phrase(s) and that it's real movie English.
- **CTA:** promote the app — "Учи английский по фильмам в VibeLing" / "Aprende inglés con
  películas en VibeLing". Mention it's free / on the App Store & Google Play when it fits.
- **Hashtags (8–15):** mix of
  - learning: `#английскийпофильмам #учуанглийский` / `#aprenderinglés #inglésconpelículas`
  - the film: `#BreakingBad` (+ actor/character if famous)
  - platform: `#reels #shorts #fyp #рекомендации` / `#parati`
  - brand: `#VibeLing`
- Tasteful emoji are fine (1–3). No clickbait lies.
- Per platform: TikTok = short punchy caption; YouTube Shorts = title + a fuller 1–2 sentence
  description; Instagram = caption then hashtags on their own line.

## Notes

- Overwrite existing `.md` on re-run.
- If the user only wants one platform or one language, produce just that.
- Keep the film name spelled correctly and localized if it has an official local title
  (e.g. keep "Breaking Bad" as-is — it's used untranslated in ru/es).
