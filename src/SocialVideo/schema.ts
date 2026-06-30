import { z } from "zod";

// ============================================================================
// Per-video data. One JSON file per video under ./videos/, validated here.
// The COMPONENT (index.tsx) is the reusable recipe; these JSONs are the data.
// ============================================================================

export const highlightSchema = z.object({
  /** Dictionary slug; the mockup video is mockups/<slug>.mp4 (rendered earlier). */
  slug: z.string(),
  /** Clip-local seconds (0 = cut start) where the phrase finishes being spoken. */
  atSec: z.number(),
});

export const subtitleSchema = z.object({
  /** Clip-local seconds (0 = cut start). */
  from: z.number(),
  to: z.number(),
  text: z.string(),
});

export const socialVideoSchema = z.object({
  /** Names the composition (`Social-<slug>`) and the render (`out/final/<slug>.mp4`). */
  slug: z.string(),
  /** Source clip path relative to public/, e.g. "clips/<name>.mp4" (a symlink). */
  clip: z.string(),
  /** [startSec, endSec] window cut out of the source clip. */
  cut: z.tuple([z.number(), z.number()]),
  /** Phrases to pause on during the subtitled pass, in order. */
  highlights: z.array(highlightSchema),
  /** English subtitles for the second pass. */
  subtitles: z.array(subtitleSchema),
  /** Pause + wipe length between the plain and subtitled passes. Default 18. */
  swipeFrames: z.number().optional(),
  /** Seconds the vibeling.png outro is held. Default 2. */
  outroSec: z.number().optional(),
});

/** Composition-level props schema (mirrors Dictionary's dictionarySchema). */
export const socialCompSchema = z.object({ config: socialVideoSchema });

export type Highlight = z.infer<typeof highlightSchema>;
export type Subtitle = z.infer<typeof subtitleSchema>;
export type SocialVideoData = z.infer<typeof socialVideoSchema>;

// ---------------------------------------------------------------------------
// Registry of all videos. To add one: drop a JSON in ./videos/, import it
// here, and add it to `sources`. Each is validated at load (errors show in
// Studio immediately) and gets a `Social-<slug>` composition via Root.tsx.
// ---------------------------------------------------------------------------
import sayMyName from "./videos/say-my-name-breaking-bad.json";

const sources: unknown[] = [sayMyName];

export const videos: SocialVideoData[] = sources.map((v) => socialVideoSchema.parse(v));
