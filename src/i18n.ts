// Localization for the fixed UI strings, per NATIVE language (the audience's
// language). The clip is always English; only the learner's language changes.
// Add a language here + to fetch-words' TARGET_LANGS to produce more variants.

export type NativeLang = "ru" | "es";

/** Native languages we render a video variant for. */
export const NATIVE_LANGS: NativeLang[] = ["ru", "es"];

type Strings = {
  /** FALLBACK top-banner headline. Every video should instead ship its own
      attention-grabbing, scene-specific `hook` in videos/<slug>.json (see the
      social-video skill); this generic line is only used when it's missing. */
  header: string;
  /** Countdown chip above the clip: "<nextPhraseIn> 3 <secShort>". */
  nextPhraseIn: string;
  secShort: string;
  /** Outro recap: title line above the list of what was learned. */
  recapTitle: string;
  /** Outro recap: call to action under the list, next to the logo. */
  recapCta: string;
  /** Tagline shown next to the "VibeLing" pill in the app mockup. */
  tagline: string;
  /** Search bar "cancel" affordance. */
  cancel: string;
  /** "Add to dictionary" button. */
  addToDict: string;
  /** The same button AFTER the tap — it turns green with a check mark. There is
      no confirmation modal; the button itself is the confirmation. */
  added: string;
  /** Examples section header. */
  examples: string;
  /** Part-of-speech labels (API returns them in English). */
  pos: Record<string, string>;
};

export const STRINGS: Record<NativeLang, Strings> = {
  ru: {
    header: "Изучаем полезные слова и фразы из фильмов",
    nextPhraseIn: "Новая фраза через",
    secShort: "с",
    recapTitle: "Сегодня выучили",
    recapCta: "Учи их в VibeLing",
    tagline: "Учим английский язык",
    cancel: "Отмена",
    addToDict: "Добавить в словарь",
    added: "Добавлено",
    examples: "ПРИМЕРЫ",
    pos: {
      phrase: "фраза",
      "verb phrase": "глагольная фраза",
      "noun phrase": "именная группа",
      "phrasal verb": "фразовый глагол",
      idiom: "идиома",
      expression: "выражение",
      noun: "существительное",
      verb: "глагол",
      adjective: "прилагательное",
      adverb: "наречие",
      pronoun: "местоимение",
      interjection: "междометие",
      preposition: "предлог",
    },
  },
  es: {
    header: "Aprendemos palabras y frases útiles de las películas",
    nextPhraseIn: "Nueva frase en",
    secShort: "s",
    recapTitle: "Hoy aprendimos",
    recapCta: "Apréndelas en VibeLing",
    tagline: "Aprende inglés",
    cancel: "Cancelar",
    addToDict: "Añadir al diccionario",
    added: "Añadido",
    examples: "EJEMPLOS",
    pos: {
      phrase: "frase",
      "verb phrase": "frase verbal",
      "noun phrase": "frase nominal",
      "phrasal verb": "verbo compuesto",
      idiom: "modismo",
      expression: "expresión",
      noun: "sustantivo",
      verb: "verbo",
      adjective: "adjetivo",
      adverb: "adverbio",
      pronoun: "pronombre",
      interjection: "interjección",
      preposition: "preposición",
    },
  },
};

/** Localize a part-of-speech value from the API (English), falling back to raw. */
export const localizePos = (lang: NativeLang, pos: string): string =>
  STRINGS[lang].pos[pos.toLowerCase().trim()] ?? pos;

/** "3 новых выражения" / "3 nuevas expresiones" — the outro recap's headline
    count. Russian needs the 1 / 2–4 / 5+ plural forms, so this is a function. */
export const phrasesLearned = (lang: NativeLang, n: number): string => {
  if (lang === "es") return `${n} ${n === 1 ? "nueva expresión" : "nuevas expresiones"}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "новое выражение"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "новых выражения"
        : "новых выражений";
  return `${n} ${noun}`;
};

// ---------------------------------------------------------------------------
// Per-language variant — makes each language's render visually/audibly distinct
// so TikTok/Reels don't flag the ru/es cuts of the same clip as duplicates.
// Applied automatically to EVERY social video (see src/SocialVideo/index.tsx).
// Keep one language as the "clean" baseline and nudge the other(s).
// ---------------------------------------------------------------------------
export type LangVariant = {
  /** Mirror the film footage horizontally. Subtitles / mockups / outro stay normal. */
  flip: boolean;
  /** Clip playback rate (1 = normal). A small change also shifts the audio fingerprint. */
  speed: number;
  /** Subtitle look, so the two variants read differently on screen. The
      subtitles sit on the black band, so COLOR (not a box) is the visible knob.
      Each cue shows the English line (`fontSize`/`color`) with the native
      translation under it (`trFontSize`/`trColor`). */
  subtitle: {
    fontSize: number;
    color: string;
    trFontSize: number;
    trColor: string;
    /** Colour of the UPCOMING highlight phrase inside the English subtitle line
        (it's marked before it's spoken so the viewer knows what's coming). */
    hlColor: string;
    /** "r,g,b" of the pulsing chip drawn behind that phrase. */
    hlRgb: string;
  };
};

export const VARIANTS: Record<NativeLang, LangVariant> = {
  // ru = clean baseline: no flip, normal speed, white English + cool-grey
  // translation, violet highlight chip.
  ru: {
    flip: false,
    speed: 1,
    subtitle: {
      fontSize: 58,
      color: "#ffffff",
      trFontSize: 44,
      trColor: "#aeb8c8",
      hlColor: "#ffffff",
      hlRgb: "139,92,246",
    },
  },
  // es = differentiated: mirrored footage, +2% speed, warm yellow English +
  // warm-pale translation, slightly smaller, pink highlight chip.
  es: {
    flip: true,
    speed: 1.02,
    subtitle: {
      fontSize: 52,
      color: "#f2d06b",
      trFontSize: 40,
      trColor: "#e7d7ac",
      hlColor: "#ffffff",
      hlRgb: "236,72,153",
    },
  },
};
