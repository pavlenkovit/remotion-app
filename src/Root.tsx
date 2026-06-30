import "./index.css";
import { Composition, staticFile } from "remotion";
import { parseMedia } from "@remotion/media-parser";
import { Dictionary, getDictionaryTiming } from "./Dictionary";
import { dictionarySchema, words } from "./Dictionary/schema";
import { SocialVideo, getSocialTiming } from "./SocialVideo";
import { videos, socialCompSchema } from "./SocialVideo/schema";

const FPS = 30;

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* One composition per video — same recipe, data from ./SocialVideo/videos/*.json.
          Add a JSON there and register it in ./SocialVideo/schema.ts. */}
      {videos.map((config) => (
        <Composition
          key={config.slug}
          id={`Social-${config.slug}`}
          component={SocialVideo}
          fps={FPS}
          width={1080}
          height={1920}
          schema={socialCompSchema}
          defaultProps={{ config }}
          // The clip plays in full — read its length from the file and derive
          // the whole video's duration from it. No start/end to configure.
          calculateMetadata={async ({ props }) => {
            const { slowDurationInSeconds } = await parseMedia({
              src: staticFile(props.config.clip),
              fields: { slowDurationInSeconds: true },
              acknowledgeRemotionLicense: true,
            });
            const clipDurationInFrames = Math.round(slowDurationInSeconds * FPS);
            const { durationInFrames } = getSocialTiming(FPS, props.config, clipDurationInFrames);
            return { durationInFrames, fps: FPS, props: { ...props, clipDurationInFrames } };
          }}
        />
      ))}

      {/* One composition per word — same scenario, content fetched from vibeling.app.
          Add a slug to src/Dictionary/words.json, then run `npm run fetch-words`. */}
      {words.map((word) => (
        <Composition
          key={word.slug}
          id={`Dictionary-${word.slug}`}
          component={Dictionary}
          durationInFrames={getDictionaryTiming(word).durationInFrames}
          fps={30}
          width={1080}
          height={1920}
          schema={dictionarySchema}
          defaultProps={{ word }}
        />
      ))}
    </>
  );
};
