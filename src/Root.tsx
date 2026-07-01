import "./index.css";
import { Composition, staticFile } from "remotion";
import { parseMedia } from "@remotion/media-parser";
import { Dictionary, getDictionaryTiming } from "./Dictionary";
import { dictionarySchema, words } from "./Dictionary/schema";
import { SocialVideo, getSocialTiming } from "./SocialVideo";
import { videos, socialCompSchema } from "./SocialVideo/schema";
import { NATIVE_LANGS } from "./i18n";

const FPS = 30;

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* One composition per (video × native language) — same recipe, data from
          ./SocialVideo/videos/*.json, localized via ./i18n.ts. The clip stays
          English; the audience's language changes the branding + mockups. */}
      {videos.flatMap((config) =>
        NATIVE_LANGS.map((lang) => (
          <Composition
            key={`${lang}-${config.slug}`}
            id={`Social-${lang}-${config.slug}`}
            component={SocialVideo}
            fps={FPS}
            width={1080}
            height={1920}
            schema={socialCompSchema}
            defaultProps={{ config, lang }}
            // The clip plays in full — read its length from the file and derive
            // the whole video's duration from it. No start/end to configure.
            calculateMetadata={async ({ props }) => {
              const { slowDurationInSeconds, dimensions } = await parseMedia({
                src: staticFile(props.config.clip),
                fields: { slowDurationInSeconds: true, dimensions: true },
                acknowledgeRemotionLicense: true,
              });
              const clipDurationInFrames = Math.round(slowDurationInSeconds * FPS);
              const clipAspect = dimensions ? dimensions.width / dimensions.height : undefined;
              const { durationInFrames } = getSocialTiming(FPS, props.config, clipDurationInFrames, props.lang);
              return { durationInFrames, fps: FPS, props: { ...props, clipDurationInFrames, clipAspect } };
            }}
          />
        )),
      )}

      {/* One composition per (word × language) — content from the vibeling API.
          Add a slug to src/Dictionary/words.json, then run `npm run fetch-words`. */}
      {words.map((word) => (
        <Composition
          key={`${word.lang}-${word.slug}`}
          id={`Dictionary-${word.lang}-${word.slug}`}
          component={Dictionary}
          durationInFrames={getDictionaryTiming(word).durationInFrames}
          fps={FPS}
          width={1080}
          height={1920}
          schema={dictionarySchema}
          defaultProps={{ word }}
        />
      ))}
    </>
  );
};
