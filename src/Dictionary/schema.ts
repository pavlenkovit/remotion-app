import { z } from "zod";
import wordsData from "./words.generated.json";

export const exampleSchema = z.object({
  en: z.string(),
  ru: z.string(),
});

export const wordSchema = z.object({
  /** URL key on vibeling.app, e.g. "freedom" or "how-are-you". */
  slug: z.string(),
  /** The word/phrase being looked up, e.g. "Freedom". */
  word: z.string(),
  /** Phonetic transcription, e.g. "[ˈfriːdəm]". */
  phonetic: z.string(),
  /** Part of speech in Russian, e.g. "существительное". */
  partOfSpeech: z.string(),
  /** Translation, e.g. "Свобода". */
  translation: z.string(),
  /** Path (relative to public/) of the downloaded illustration, for staticFile(). */
  image: z.string(),
  /** Usage examples (English + Russian). */
  examples: z.array(exampleSchema),
});

export const dictionarySchema = z.object({
  word: wordSchema,
});

export type Example = z.infer<typeof exampleSchema>;
export type WordData = z.infer<typeof wordSchema>;

/**
 * All words available for rendering. Generated from src/Dictionary/words.json
 * (the slug list) by `npm run fetch-words`, which pulls content from
 * vibeling.app. Do not edit words.generated.json by hand.
 */
export const words: WordData[] = wordsData;
