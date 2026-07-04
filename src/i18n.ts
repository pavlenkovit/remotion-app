// Localization for the fixed UI strings, per NATIVE language (the audience's
// language). The clip is always English; only the learner's language changes.
// Add a language here + to fetch-words' TARGET_LANGS to produce more variants.

export type NativeLang = "ru" | "es";

/** Native languages we render a video variant for. */
export const NATIVE_LANGS: NativeLang[] = ["ru", "es"];

type Strings = {
  /** Top banner headline shown above the clip on every social video. */
  header: string;
  /** Tagline shown next to the "VibeLing" pill in the app mockup. */
  tagline: string;
  /** Search bar "cancel" affordance. */
  cancel: string;
  /** "Add to dictionary" button. */
  addToDict: string;
  /** Toast line 1 for a phrase / single word. */
  addedPhrase: string;
  addedWord: string;
  /** Toast line 2. */
  forLearning: string;
  /** Examples section header. */
  examples: string;
  /** Part-of-speech labels (API returns them in English). */
  pos: Record<string, string>;
};

export const STRINGS: Record<NativeLang, Strings> = {
  ru: {
    header: "Добавляем полезные слова и фразы из фильмов",
    tagline: "Учим английский язык",
    cancel: "Отмена",
    addToDict: "Добавить в словарь",
    addedPhrase: "Фраза добавлена",
    addedWord: "Слово добавлено",
    forLearning: "для изучения",
    examples: "ПРИМЕРЫ",
    pos: {
      phrase: "фраза",
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
    header: "Añadimos palabras y frases útiles de las películas",
    tagline: "Aprende inglés",
    cancel: "Cancelar",
    addToDict: "Añadir al diccionario",
    addedPhrase: "Frase añadida",
    addedWord: "Palabra añadida",
    forLearning: "para aprender",
    examples: "EJEMPLOS",
    pos: {
      phrase: "frase",
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
  };
};

export const VARIANTS: Record<NativeLang, LangVariant> = {
  // ru = clean baseline: no flip, normal speed, white English + cool-grey translation.
  ru: {
    flip: false,
    speed: 1,
    subtitle: { fontSize: 58, color: "#ffffff", trFontSize: 44, trColor: "#aeb8c8" },
  },
  // es = differentiated: mirrored footage, +2% speed, warm yellow English +
  // warm-pale translation, slightly smaller.
  es: {
    flip: true,
    speed: 1.02,
    subtitle: { fontSize: 52, color: "#f2d06b", trFontSize: 40, trColor: "#e7d7ac" },
  },
};
