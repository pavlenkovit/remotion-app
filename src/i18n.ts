// Localization for the fixed UI strings, per NATIVE language (the audience's
// language). The clip is always English; only the learner's language changes.
// Add a language here + to fetch-words' TARGET_LANGS to produce more variants.

export type NativeLang = "ru" | "es";

/** Native languages we render a video variant for. */
export const NATIVE_LANGS: NativeLang[] = ["ru", "es"];

type Strings = {
  /** Bold branding line above the video (first pass). */
  intro: string;
  /** Calmer line below the video (first pass). */
  sub: string;
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
    intro: "Учим английский по фильмам",
    sub: "Первый раз смотрим без субтитров",
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
    intro: "Aprende inglés con películas",
    sub: "La primera vez, míralo sin subtítulos",
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
