import React from "react";
import {
  AbsoluteFill,
  Freeze,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getDictionaryTiming } from "../Dictionary";
import { words, findWord } from "../Dictionary/schema";
import type { SocialVideoData, Subtitle } from "./schema";
import { type NativeLang } from "../i18n";

// ============================================================================
// This is the reusable RECIPE. Everything describing a particular video comes
// in as `config` (a SocialVideoData) — see ./schema.ts and ./videos/*.json.
// ============================================================================

const DEFAULT_OUTRO_SEC = 2; // vibeling.png held at the end

// ----------------------------------------------------------------------------
// House rules — identical for EVERY social video (keep in sync with the skill).
// ----------------------------------------------------------------------------
const COMP_W = 1080;
const COMP_H = 1920;
/** Fallback clip aspect (w/h) when the file's real dimensions aren't available. */
const DEFAULT_ASPECT = 16 / 9;
/** Shared text font stack. */
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The clip is shown FULL WIDTH and centered, never cropped — letterboxed with
 * black bars. Returns the Y (px) of the bottom edge of the displayed video, so
 * the subtitles sit in the black band just under it.
 */
const videoBottomY = (aspect: number): number => {
  const displayedH = Math.min(COMP_W / aspect, COMP_H); // full width → derived height
  return (COMP_H + displayedH) / 2;
};

// ============================================================================
// Timing — derived from the config so a different clip/highlights just works.
// ============================================================================

const mockupFrames = (slug: string, lang: NativeLang): number => {
  const word = findWord(lang, slug) ?? words.find((w) => w.slug === slug);
  return word ? getDictionaryTiming(word).durationInFrames : 150;
};

type Seg =
  | { type: "play"; from: number; duration: number; srcFrom: number; srcTo: number; clipOffset: number }
  | { type: "mockup"; from: number; duration: number; freezeAt: number; mockup: string; slug: string };

export const getSocialTiming = (
  fps: number,
  config: SocialVideoData,
  clipLen: number,
  lang: NativeLang = "ru",
) => {
  const clipStart = 0; // the clip plays in full — no trimming
  const outro = Math.round((config.outroSec ?? DEFAULT_OUTRO_SEC) * fps);

  const highlights = config.highlights
    .map((h) => ({
      ...h,
      mockup: `mockups/${lang}/${h.slug}.mp4`,
      localFrame: Math.round(h.atSec * fps),
      mockupLen: mockupFrames(h.slug, lang),
    }))
    .sort((a, b) => a.localFrame - b.localFrame);

  const segs: Seg[] = [];
  let prevLocal = 0;
  let cursor = 0; // the subtitled pass starts immediately — no plain first pass
  for (const h of highlights) {
    const segDur = h.localFrame - prevLocal;
    if (segDur > 0) {
      segs.push({
        type: "play",
        from: cursor,
        duration: segDur,
        srcFrom: clipStart + prevLocal,
        srcTo: clipStart + h.localFrame,
        clipOffset: prevLocal,
      });
      cursor += segDur;
    }
    segs.push({
      type: "mockup",
      from: cursor,
      duration: h.mockupLen,
      freezeAt: clipStart + h.localFrame,
      mockup: h.mockup,
      slug: h.slug,
    });
    cursor += h.mockupLen;
    prevLocal = h.localFrame;
  }
  const lastDur = clipLen - prevLocal;
  if (lastDur > 0) {
    segs.push({
      type: "play",
      from: cursor,
      duration: lastDur,
      srcFrom: clipStart + prevLocal,
      srcTo: clipStart + clipLen,
      clipOffset: prevLocal,
    });
    cursor += lastDur;
  }

  return {
    clipStart,
    clipLen,
    segs,
    outroFrom: cursor,
    durationInFrames: cursor + outro,
  };
};

// ============================================================================
// Pieces
// ============================================================================

/** The scene clip: FULL WIDTH, centered, letterboxed (black bars) — never cropped. */
const clipVideo: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

/** The phone mockup fills its (already 9:16) frame. */
const fillVideo: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

/** A trimmed slice of the source clip, letterboxed full-width. */
const ClipSlice: React.FC<{ clip: string; from: number; to: number }> = ({ clip, from, to }) => (
  <OffthreadVideo src={staticFile(clip)} trimBefore={from} trimAfter={to} style={clipVideo} />
);

/** A single frozen source frame (used as the still background behind a mockup).
    Muted — while the clip is frozen only the mockup's baked sounds should play.
    The source frame is picked with `trimBefore` and held with `Freeze frame={0}`
    (NOT `Freeze frame={at}`): `<Freeze>` offsets the frozen timeline by the
    enclosing Sequence's `from`, so `frame={at}` on a late mockup would push the
    internal frame past the composition duration and extract the wrong frame.
    Freezing at local 0 keeps it in range; `trimBefore` does the seeking. */
const ClipFreeze: React.FC<{ clip: string; at: number }> = ({ clip, at }) => (
  <Freeze frame={0}>
    <OffthreadVideo src={staticFile(clip)} trimBefore={at} style={clipVideo} muted />
  </Freeze>
);

/** Text band in the black area directly BELOW the letterboxed video, where the
    subtitles sit — clean, in the black bar, never over the footage. */
const LowerBand: React.FC<{ aspect: number; opacity?: number; children: React.ReactNode }> = ({
  aspect,
  opacity = 1,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: videoBottomY(aspect),
      bottom: 0,
      paddingTop: 48,
      paddingLeft: 80,
      paddingRight: 80,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      textAlign: "center",
      opacity,
    }}
  >
    {children}
  </div>
);

/** Subtitles: one cue at a time, centered under the video, with a soft fade. */
const Subtitles: React.FC<{ subtitles: Subtitle[]; clipOffset: number; aspect: number }> = ({
  subtitles,
  clipOffset,
  aspect,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (clipOffset + frame) / fps;
  const cue = subtitles.find((c) => sec >= c.from && sec < c.to);
  if (!cue) return null;

  // Fade in/out over ~5 frames at each cue's edges so lines don't pop.
  const fade = 5 / fps;
  const opacity = interpolate(sec, [cue.from, cue.from + fade, cue.to - fade, cue.to], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <LowerBand aspect={aspect} opacity={opacity}>
      <span
        style={{
          display: "inline-block",
          maxWidth: 920,
          color: "white",
          fontFamily: FONT,
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.25,
          textWrap: "balance",
          textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)",
        }}
      >
        {cue.text}
      </span>
    </LowerBand>
  );
};

/** The Dictionary mockup video framed inside a phone, sliding up over the frozen scene. */
const PhoneMockup: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const appear = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const y = interpolate(appear, [0, 1], [height, 0]);

  const phoneH = 1480;
  const phoneW = phoneH * (9 / 16);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${y}px)` }}>
      <div
        style={{
          width: phoneW,
          height: phoneH,
          backgroundColor: "#000",
          borderRadius: 64,
          padding: 14,
          boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
          border: "2px solid #2a2a2a",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", position: "relative" }}>
          <OffthreadVideo src={staticFile(src)} style={fillVideo} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Outro: the promo image fills the whole screen. */
const Outro: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Img src={staticFile("video/vibeling.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </AbsoluteFill>
);

// ============================================================================
// Composition
// ============================================================================

export const SocialVideo: React.FC<{
  config: SocialVideoData;
  lang?: NativeLang;
  clipDurationInFrames?: number;
  clipAspect?: number;
}> = ({ config, lang = "ru", clipDurationInFrames, clipAspect }) => {
  const { fps, durationInFrames } = useVideoConfig();
  // clipDurationInFrames / clipAspect are injected by calculateMetadata (read
  // from the file); fall back so the component never breaks in isolation.
  const t = getSocialTiming(fps, config, clipDurationInFrames ?? durationInFrames, lang);
  const aspect = clipAspect ?? DEFAULT_ASPECT;
  const { clip, subtitles } = config;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Subtitled clip from the start, pausing on each highlight to show its mockup */}
      {t.segs.map((s, i) =>
        s.type === "play" ? (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipSlice clip={clip} from={s.srcFrom} to={s.srcTo} />
            <Subtitles subtitles={subtitles} clipOffset={s.clipOffset} aspect={aspect} />
          </Sequence>
        ) : (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipFreeze clip={clip} at={s.freezeAt} />
            <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
            <PhoneMockup src={s.mockup} />
          </Sequence>
        ),
      )}

      {/* Outro — vibeling.png for 2s */}
      <Sequence from={t.outroFrom} durationInFrames={t.durationInFrames - t.outroFrom}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
