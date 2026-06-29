import { z } from "zod";
import wordsData from "./words.json";

export const exampleSchema = z.object({
  en: z.string(),
  ru: z.string(),
});

export const wordSchema = z.object({
  /** The word being looked up, e.g. "Hello". */
  word: z.string(),
  /** Phonetic transcription, e.g. "/həˈloʊ/". */
  phonetic: z.string(),
  /** Part of speech in Russian, e.g. "существительное". */
  partOfSpeech: z.string(),
  /** Translation(s), e.g. "привет; здравствуйте". */
  translation: z.string(),
  /** Usage examples (English + Russian). */
  examples: z.array(exampleSchema),
});

export const dictionarySchema = z.object({
  word: wordSchema,
});

export type Example = z.infer<typeof exampleSchema>;
export type WordData = z.infer<typeof wordSchema>;

/** All words available for rendering, loaded from words.json. */
export const words: WordData[] = wordsData;
