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

// ============================================================================
// CONFIG — everything that describes THIS particular video lives up here.
// ============================================================================

/** The original scene, staged under public/. */
const CLIP_SRC = "clips/say-my-name-breaking-bad.mp4";

/** Cut only this window out of the source (Breaking Bad "Say My Name"). */
const CLIP_START_SEC = 4 * 60 + 1; // 4:01
const CLIP_END_SEC = 4 * 60 + 47; // 4:47

const SWIPE_FRAMES = 18; // pause + wipe between the plain and subtitled passes
const OUTRO_SEC = 2; // vibeling.png held at the end

/**
 * Phrases to highlight, with the mockup video rendered from the Dictionary
 * composition (see the social-video skill: words.json → fetch-words → render).
 *
 * `atSec` is the clip-local time (0 = CLIP_START_SEC) at which the phrase
 * finishes being spoken, i.e. where the second pass pauses to show the mockup.
 *
 * TODO(user): scrub the clip in Remotion Studio and set `atSec` to the real
 * moments — these are placeholders.
 */
export const HIGHLIGHTS = [
  { slug: "say-my-name", atSec: 18, mockup: "mockups/say-my-name.mp4" },
  { slug: "cook", atSec: 31, mockup: "mockups/cook.mp4" },
];

/**
 * English subtitles for the second pass, in clip-local seconds (0 = CLIP_START_SEC).
 *
 * TODO(user): replace with the real transcript + timing of 4:01–4:47.
 */
const SUBTITLES: { fromSec: number; toSec: number; text: string }[] = [
  { fromSec: 16, toSec: 19, text: "Say my name." },
  { fromSec: 29, toSec: 33, text: "I'm the cook." },
];

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

export const getSocialTiming = (fps: number) => {
  const clipStart = Math.round(CLIP_START_SEC * fps);
  const clipLen = Math.round((CLIP_END_SEC - CLIP_START_SEC) * fps);
  const outro = Math.round(OUTRO_SEC * fps);

  const highlights = HIGHLIGHTS.map((h) => ({
    ...h,
    localFrame: Math.round(h.atSec * fps),
    mockupLen: mockupFrames(h.slug),
  })).sort((a, b) => a.localFrame - b.localFrame);

  const pass2From = clipLen + SWIPE_FRAMES;

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
const ClipSlice: React.FC<{ from: number; to: number }> = ({ from, to }) => (
  <OffthreadVideo src={staticFile(CLIP_SRC)} trimBefore={from} trimAfter={to} style={fillVideo} />
);

/** A single frozen source frame (used as the still background behind a mockup / swipe). */
const ClipFreeze: React.FC<{ at: number }> = ({ at }) => (
  <Freeze frame={at}>
    <OffthreadVideo src={staticFile(CLIP_SRC)} style={fillVideo} />
  </Freeze>
);

const Subtitles: React.FC<{ clipOffset: number }> = ({ clipOffset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (clipOffset + frame) / fps;
  const cue = SUBTITLES.find((c) => sec >= c.fromSec && sec < c.toSec);
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
const Swipe: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const x = interpolate(frame, [0, SWIPE_FRAMES], [-width, width], {
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

export const SocialVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const t = getSocialTiming(fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Pass 1 — plain clip */}
      <Sequence durationInFrames={t.clipLen}>
        <ClipSlice from={t.clipStart} to={t.clipStart + t.clipLen} />
      </Sequence>

      {/* Pause on the last frame + swipe */}
      <Sequence from={t.swipeFrom} durationInFrames={SWIPE_FRAMES}>
        <ClipFreeze at={t.clipStart + t.clipLen - 1} />
        <Swipe />
      </Sequence>

      {/* Pass 2 — subtitled clip, pausing on each highlight to show its mockup */}
      {t.segs.map((s, i) =>
        s.type === "play" ? (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipSlice from={s.srcFrom} to={s.srcTo} />
            <Subtitles clipOffset={s.clipOffset} />
          </Sequence>
        ) : (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipFreeze at={s.freezeAt} />
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
