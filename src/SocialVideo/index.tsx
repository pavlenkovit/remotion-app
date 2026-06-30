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

export const getSocialTiming = (fps: number, config: SocialVideoData) => {
  const [startSec, endSec] = config.cut;
  const clipStart = Math.round(startSec * fps);
  const clipLen = Math.round((endSec - startSec) * fps);
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

const fillVideo: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

/** A trimmed slice of the source clip, filling the frame. */
const ClipSlice: React.FC<{ clip: string; from: number; to: number }> = ({ clip, from, to }) => (
  <OffthreadVideo src={staticFile(clip)} trimBefore={from} trimAfter={to} style={fillVideo} />
);

/** A single frozen source frame (used as the still background behind a mockup / swipe). */
const ClipFreeze: React.FC<{ clip: string; at: number }> = ({ clip, at }) => (
  <Freeze frame={at}>
    <OffthreadVideo src={staticFile(clip)} style={fillVideo} />
  </Freeze>
);

const Subtitles: React.FC<{ subtitles: Subtitle[]; clipOffset: number }> = ({ subtitles, clipOffset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (clipOffset + frame) / fps;
  const cue = subtitles.find((c) => sec >= c.from && sec < c.to);
  if (!cue) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: "180px 80px 0" }}>
      <span
        style={{
          color: "white",
          fontSize: 64,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.25,
          textShadow: "0 4px 24px rgba(0,0,0,0.9)",
          backgroundColor: "rgba(0,0,0,0.45)",
          borderRadius: 20,
          padding: "16px 32px",
        }}
      >
        {cue.text}
      </span>
    </AbsoluteFill>
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

const Outro: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
    <Img src={staticFile("video/vibeling.png")} style={{ width: "70%", objectFit: "contain" }} />
  </AbsoluteFill>
);

// ============================================================================
// Composition
// ============================================================================

export const SocialVideo: React.FC<{ config: SocialVideoData }> = ({ config }) => {
  const { fps } = useVideoConfig();
  const t = getSocialTiming(fps, config);
  const { clip, subtitles } = config;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Pass 1 — plain clip */}
      <Sequence durationInFrames={t.clipLen}>
        <ClipSlice clip={clip} from={t.clipStart} to={t.clipStart + t.clipLen} />
      </Sequence>

      {/* Pause on the last frame + swipe */}
      <Sequence from={t.swipeFrom} durationInFrames={t.swipeFrames}>
        <ClipFreeze clip={clip} at={t.clipStart + t.clipLen - 1} />
        <Swipe swipeFrames={t.swipeFrames} />
      </Sequence>

      {/* Pass 2 — subtitled clip, pausing on each highlight to show its mockup */}
      {t.segs.map((s, i) =>
        s.type === "play" ? (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipSlice clip={clip} from={s.srcFrom} to={s.srcTo} />
            <Subtitles subtitles={subtitles} clipOffset={s.clipOffset} />
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
