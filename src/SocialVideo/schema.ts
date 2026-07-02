import { z } from "zod";

// ============================================================================
// Per-video data. One JSON file per video under ./videos/, validated here.
// The COMPONENT (index.tsx) is the reusable recipe; these JSONs are the data.
// ============================================================================

export const highlightSchema = z.object({
  /** Dictionary slug; the mockup video is mockups/<slug>.mp4 (rendered earlier). */
  slug: z.string(),
  /** Clip seconds (0 = clip start) where the phrase finishes being spoken. */
  atSec: z.number(),
});

export const subtitleSchema = z.object({
  /** Clip seconds (0 = clip start). */
  from: z.number(),
  to: z.number(),
  /** English (spoken) line. */
  text: z.string(),
  /** Native translations per language ({ ru, es }), filled by `transcribe`.
      Shown under the English line in that language's variant. */
  tr: z.record(z.string(), z.string()).optional(),
});

export const socialVideoSchema = z.object({
  /** Names the composition (`Social-<slug>`) and the render (`out/final/<slug>.mp4`). */
  slug: z.string(),
  /** Source clip path relative to public/, e.g. "clips/<name>.mp4" (a symlink).
      The clip plays in full — its length is read automatically from the file. */
  clip: z.string(),
  /** The film/show the scene is from, e.g. "Breaking Bad". Used by the
      video-description skill to put the title in the caption/name. */
  film: z.string().optional(),
  /** Phrases to pause on during the subtitled pass, in order. */
  highlights: z.array(highlightSchema),
  /** English subtitles overlaid on the clip. */
  subtitles: z.array(subtitleSchema),
  /** Seconds the vibeling.png outro is held. Default 2. */
  outroSec: z.number().optional(),
});

/**
 * Composition-level props. `clipDurationInFrames` and `clipAspect` are filled
 * in by `calculateMetadata` in Root.tsx (read from the clip file), not the JSON.
 */
export const socialCompSchema = z.object({
  config: socialVideoSchema,
  /** Audience's native language ("ru" | "es") — drives branding + mockups. */
  lang: z.enum(["ru", "es"]).optional(),
  clipDurationInFrames: z.number().optional(),
  clipAspect: z.number().optional(),
});

export type Highlight = z.infer<typeof highlightSchema>;
export type Subtitle = z.infer<typeof subtitleSchema>;
export type SocialVideoData = z.infer<typeof socialVideoSchema>;

// ---------------------------------------------------------------------------
// Registry of all videos. To add one: drop a JSON in ./videos/, import it
// here, and add it to `sources`. Each is validated at load (errors show in
// Studio immediately) and gets a `Social-<slug>` composition via Root.tsx.
// ---------------------------------------------------------------------------
import sayMyName from "./videos/say-my-name-breaking-bad.json";
import iAmTheDanger from "./videos/i-am-the-danger-breaking-bad.json";

const sources: unknown[] = [sayMyName, iAmTheDanger];

export const videos: SocialVideoData[] = sources.map((v) => socialVideoSchema.parse(v));
