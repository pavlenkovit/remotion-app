import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  Freeze,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { COLORS } from "../Dictionary/ui";
import { getDictionaryTiming } from "../Dictionary";
import { words } from "../Dictionary/schema";
import type { SocialVideoData, Subtitle } from "./schema";

// ============================================================================
// This is the reusable RECIPE. Everything describing a particular video comes
// in as `config` (a SocialVideoData) — see ./schema.ts and ./videos/*.json.
// ============================================================================

const DEFAULT_SWIPE_FRAMES = 18; // pause + wipe between the plain and subtitled passes
const DEFAULT_OUTRO_SEC = 2; // vibeling.png held at the end

// ----------------------------------------------------------------------------
// House rules — identical for EVERY social video (keep in sync with the skill).
// ----------------------------------------------------------------------------
const COMP_W = 1080;
const COMP_H = 1920;
/** Fallback clip aspect (w/h) when the file's real dimensions aren't available. */
const DEFAULT_ASPECT = 16 / 9;
/** First (plain) pass: bold branding ABOVE the video; calmer line BELOW it. */
const INTRO_CAPTION = "Учим английский по фильмам";
const INTRO_SUBCAPTION = "Первый раз смотрим без субтитров";
/** Shared text font stack. */
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The clip is shown FULL WIDTH and centered, never cropped — letterboxed with
 * black bars. These return the Y (px) of the bottom / top edges of the
 * displayed video, so text sits in the black bands just under / over it.
 */
const videoBottomY = (aspect: number): number => {
  const displayedH = Math.min(COMP_W / aspect, COMP_H); // full width → derived height
  return (COMP_H + displayedH) / 2;
};
const videoTopY = (aspect: number): number => {
  const displayedH = Math.min(COMP_W / aspect, COMP_H);
  return (COMP_H - displayedH) / 2;
};

// ============================================================================
// Timing — derived from the config so a different clip/highlights just works.
// ============================================================================

const mockupFrames = (slug: string): number => {
  const word = words.find((w) => w.slug === slug);
  return word ? getDictionaryTiming(word).durationInFrames : 150;
};

type Seg =
  | { type: "play"; from: number; duration: number; srcFrom: number; srcTo: number; clipOffset: number }
  | { type: "mockup"; from: number; duration: number; freezeAt: number; mockup: string; slug: string };

export const getSocialTiming = (fps: number, config: SocialVideoData, clipLen: number) => {
  const clipStart = 0; // the clip plays in full — no trimming
  const swipeFrames = config.swipeFrames ?? DEFAULT_SWIPE_FRAMES;
  const outro = Math.round((config.outroSec ?? DEFAULT_OUTRO_SEC) * fps);

  const highlights = config.highlights
    .map((h) => ({
      ...h,
      mockup: `mockups/${h.slug}.mp4`,
      localFrame: Math.round(h.atSec * fps),
      mockupLen: mockupFrames(h.slug),
    }))
    .sort((a, b) => a.localFrame - b.localFrame);

  const pass2From = clipLen + swipeFrames;

  const segs: Seg[] = [];
  let prevLocal = 0;
  let cursor = pass2From;
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
    swipeFrames,
    swipeFrom: clipLen,
    pass2From,
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

/** A single frozen source frame (used as the still background behind a mockup / swipe). */
const ClipFreeze: React.FC<{ clip: string; at: number }> = ({ clip, at }) => (
  <Freeze frame={at}>
    <OffthreadVideo src={staticFile(clip)} style={clipVideo} />
  </Freeze>
);

/**
 * Text band in the black area directly below the letterboxed video. Used for
 * both the first-pass branding caption and the second-pass subtitles, so they
 * always land in the same, clean place.
 */
/** Text band in the black area directly BELOW the letterboxed video. */
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

/** Text band in the black area directly ABOVE the letterboxed video. */
const UpperBand: React.FC<{ aspect: number; opacity?: number; children: React.ReactNode }> = ({
  aspect,
  opacity = 1,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: videoTopY(aspect),
      paddingBottom: 48,
      paddingLeft: 80,
      paddingRight: 80,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      textAlign: "center",
      opacity,
    }}
  >
    {children}
  </div>
);

/** Second-pass subtitles: one cue at a time, centered under the video, with a soft fade. */
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

/**
 * First-pass captions: the bold branding above the video, and a calmer
 * "watch without subtitles" line below it. Both fade in together.
 */
const IntroCaptions: React.FC<{ aspect: number }> = ({ aspect }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <>
      <UpperBand aspect={aspect} opacity={opacity}>
        <span
          style={{
            display: "inline-block",
            maxWidth: 960,
            color: "white",
            fontFamily: FONT,
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -1,
            textShadow: "0 2px 14px rgba(0,0,0,0.9)",
          }}
        >
          {INTRO_CAPTION}
        </span>
      </UpperBand>
      <LowerBand aspect={aspect} opacity={opacity}>
        <span
          style={{
            display: "inline-block",
            maxWidth: 880,
            color: "rgba(255,255,255,0.82)",
            fontFamily: FONT,
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.3,
            textShadow: "0 2px 10px rgba(0,0,0,0.9)",
          }}
        >
          {INTRO_SUBCAPTION}
        </span>
      </LowerBand>
    </>
  );
};

/** Purple wipe sweeping across the screen. */
const Swipe: React.FC<{ swipeFrames: number }> = ({ swipeFrames }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const x = interpolate(frame, [0, swipeFrames], [-width, width], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}px) skewX(-12deg)` }}>
      <AbsoluteFill style={{ backgroundColor: COLORS.accent }} />
    </AbsoluteFill>
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
  clipDurationInFrames?: number;
  clipAspect?: number;
}> = ({ config, clipDurationInFrames, clipAspect }) => {
  const { fps, durationInFrames } = useVideoConfig();
  // clipDurationInFrames / clipAspect are injected by calculateMetadata (read
  // from the file); fall back so the component never breaks in isolation.
  const t = getSocialTiming(fps, config, clipDurationInFrames ?? durationInFrames);
  const aspect = clipAspect ?? DEFAULT_ASPECT;
  const { clip, subtitles } = config;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Pass 1 — plain clip + branding above and a calmer line below */}
      <Sequence durationInFrames={t.clipLen}>
        <ClipSlice clip={clip} from={t.clipStart} to={t.clipStart + t.clipLen} />
        <IntroCaptions aspect={aspect} />
      </Sequence>

      {/* Pause on the last frame + swipe (with swipe sound) */}
      <Sequence from={t.swipeFrom} durationInFrames={t.swipeFrames}>
        <ClipFreeze clip={clip} at={t.clipStart + t.clipLen - 1} />
        <Swipe swipeFrames={t.swipeFrames} />
        <Html5Audio src={staticFile("sounds/swipe.mp3")} />
      </Sequence>

      {/* Pass 2 — subtitled clip, pausing on each highlight to show its mockup */}
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
