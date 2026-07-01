import { z } from "zod";
import wordsData from "./words.generated.json";
import type { NativeLang } from "../i18n";

export const exampleSchema = z.object({
  /** The example sentence in English (the language being learned). */
  original: z.string(),
  /** Its translation in the native language. */
  translation: z.string(),
});

export const wordSchema = z.object({
  /** English key, e.g. "freedom" or "say-my-name". */
  slug: z.string(),
  /** Native (audience) language this entry is localized for, e.g. "ru" | "es". */
  lang: z.string(),
  /** The English word/phrase being looked up, e.g. "Say my name". */
  word: z.string(),
  /** Phonetic transcription, e.g. "[seɪ maɪ neɪm]". */
  phonetic: z.string(),
  /** Part of speech as returned by the API (English), localized at render time. */
  partOfSpeech: z.string(),
  /** Translation in the native language, e.g. "Назови моё имя" / "Di mi nombre". */
  translation: z.string(),
  /** Path (relative to public/) of the downloaded illustration, for staticFile(). */
  image: z.string(),
  /** Usage examples (English + native translation). */
  examples: z.array(exampleSchema),
});

export const dictionarySchema = z.object({
  word: wordSchema,
});

export type Example = z.infer<typeof exampleSchema>;
export type WordData = z.infer<typeof wordSchema> & { lang: NativeLang };

/**
 * All words, flattened across languages. Generated from src/Dictionary/words.json
 * by `npm run fetch-words` (which calls the vibeling backend API for every target
 * language). Do not edit words.generated.json by hand. Each entry becomes a
 * `Dictionary-<lang>-<slug>` composition (see src/Root.tsx).
 */
const byLang = wordsData as Record<string, WordData[]>;
export const words: WordData[] = Object.values(byLang).flat();

/** Look up a single localized entry. */
export const findWord = (lang: string, slug: string): WordData | undefined =>
  words.find((w) => w.lang === lang && w.slug === slug);
