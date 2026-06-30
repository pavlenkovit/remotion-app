import "./index.css";
import { Composition } from "remotion";
import { Dictionary, getDictionaryTiming } from "./Dictionary";
import { dictionarySchema, words } from "./Dictionary/schema";
import { SocialVideo, getSocialTiming } from "./SocialVideo";
import { videos, socialCompSchema } from "./SocialVideo/schema";

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
          durationInFrames={getSocialTiming(30, config).durationInFrames}
          fps={30}
          width={1080}
          height={1920}
          schema={socialCompSchema}
          defaultProps={{ config }}
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
