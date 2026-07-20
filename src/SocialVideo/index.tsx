import React from "react";
import {
  AbsoluteFill,
  Freeze,
  Html5Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getDictionaryTiming, MOCKUP_WIDTH, MOCKUP_HEIGHT } from "../Dictionary";
import { words, findWord } from "../Dictionary/schema";
import type { SocialVideoData, Subtitle } from "./schema";
import { STRINGS, VARIANTS, type NativeLang, type LangVariant } from "../i18n";

// ============================================================================
// This is the reusable RECIPE. Everything describing a particular video comes
// in as `config` (a SocialVideoData) — see ./schema.ts and ./videos/*.json.
// ============================================================================

const DEFAULT_OUTRO_SEC = 2; // vibeling.png held at the end

// Soft music bed played during each mockup pause. Gain is PRE-BAKED into this
// file (Html5Audio ignores `volume` at render — regenerate with
// `node scripts/soften-audio.mjs <src> public/sounds/inspiring-dreams-soft.wav <gain>`).
const MOCKUP_MUSIC = "sounds/inspiring-dreams-soft.wav";
// Start the music slightly BEFORE the clip freezes so it's already playing (past
// its soft ramp-up) by the time the pause visually begins — feels less "late".
const MUSIC_LEAD_SEC = 0.5;

// Whisper ends each segment ~a syllable early, so the raw `to`/`atSec` time lands
// a hair before the word actually finishes. Using it verbatim as a hard boundary
// clips the last syllable — the mockup pauses the clip mid-word, and the subtitle
// vanishes mid-word. Hold every such boundary this many seconds longer so the
// phrase always finishes speaking first. Applied to BOTH the freeze/pause frame
// (getSocialTiming) and the subtitle disappearance (Subtitles), never past the
// next boundary. ~0.35s ≈ one trailing syllable at conversational pace.
const PHRASE_LEAD_OUT_SEC = 0.35;

// When the clip RESUMES after a mockup pause, rewind it slightly so playback
// picks up a hair BEFORE where it froze (replaying the last ~0.3s) rather than
// jumping straight forward — this re-establishes context after the interruption
// and avoids feeling like a hard cut. Only affects the resume point (the freeze
// still happens exactly at the phrase's end).
const RESUME_REWIND_SEC = 0.3;

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

/** Y (px) of the TOP edge of the displayed video — the top black bar spans
    [0, videoTopY], where the fixed header banner lives. */
const videoTopY = (aspect: number): number => {
  const displayedH = Math.min(COMP_W / aspect, COMP_H);
  return (COMP_H - displayedH) / 2;
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
  // Per-language variant: `speed` compresses the clip's on-screen duration
  // (playback rate is applied to the video; a play segment covering `n` clip
  // frames therefore occupies `n / speed` composition frames). Mockups play at
  // 1× regardless, so their length is unaffected.
  const { speed } = VARIANTS[lang];

  // Pause a beat AFTER the phrase's transcribed end so the last syllable finishes
  // before the clip freezes for the mockup (whisper ends segments early — see
  // PHRASE_LEAD_OUT_SEC). Never past the clip's last frame.
  const leadOut = Math.round(PHRASE_LEAD_OUT_SEC * fps);
  const rewind = Math.round(RESUME_REWIND_SEC * fps);
  const highlights = config.highlights
    .map((h) => ({
      ...h,
      mockup: `mockups/${lang}/${h.slug}.mp4`,
      localFrame: Math.min(Math.round(h.atSec * fps) + leadOut, clipLen),
      mockupLen: mockupFrames(h.slug, lang),
    }))
    .sort((a, b) => a.localFrame - b.localFrame);

  const segs: Seg[] = [];
  let prevLocal = 0;
  let cursor = 0; // the subtitled pass starts immediately — no plain first pass
  for (const h of highlights) {
    const clipFrames = h.localFrame - prevLocal;
    if (clipFrames > 0) {
      segs.push({
        type: "play",
        from: cursor,
        duration: Math.round(clipFrames / speed),
        srcFrom: clipStart + prevLocal,
        srcTo: clipStart + h.localFrame,
        clipOffset: prevLocal,
      });
      cursor += Math.round(clipFrames / speed);
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
    // Resume the clip a touch BEFORE the freeze point (replay ~RESUME_REWIND_SEC).
    prevLocal = Math.max(h.localFrame - rewind, 0);
  }
  const lastClipFrames = clipLen - prevLocal;
  if (lastClipFrames > 0) {
    segs.push({
      type: "play",
      from: cursor,
      duration: Math.round(lastClipFrames / speed),
      srcFrom: clipStart + prevLocal,
      srcTo: clipStart + clipLen,
      clipOffset: prevLocal,
    });
    cursor += Math.round(lastClipFrames / speed);
  }

  return {
    clipStart,
    clipLen,
    speed,
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

/** Mirror transform for the footage (per-language variant differentiation). */
const flipStyle = (flip: boolean): React.CSSProperties =>
  flip ? { ...clipVideo, transform: "scaleX(-1)" } : clipVideo;

/** A trimmed slice of the source clip, letterboxed full-width. `speed` is the
    per-language playback rate; `flip` mirrors the footage horizontally. */
const ClipSlice: React.FC<{ clip: string; from: number; to: number; speed: number; flip: boolean }> = ({
  clip,
  from,
  to,
  speed,
  flip,
}) => (
  <OffthreadVideo
    src={staticFile(clip)}
    trimBefore={from}
    trimAfter={to}
    playbackRate={speed}
    style={flipStyle(flip)}
  />
);

/** A single frozen source frame (used as the still background behind a mockup).
    Muted — while the clip is frozen only the mockup's baked sounds should play.
    The source frame is picked with `trimBefore` and held with `Freeze frame={0}`
    (NOT `Freeze frame={at}`): `<Freeze>` offsets the frozen timeline by the
    enclosing Sequence's `from`, so `frame={at}` on a late mockup would push the
    internal frame past the composition duration and extract the wrong frame.
    Freezing at local 0 keeps it in range; `trimBefore` does the seeking. */
const ClipFreeze: React.FC<{ clip: string; at: number; flip: boolean }> = ({ clip, at, flip }) => (
  <Freeze frame={0}>
    <OffthreadVideo src={staticFile(clip)} trimBefore={at} style={flipStyle(flip)} muted />
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

/** Subtitles: one cue at a time, centered under the video, with a soft fade.
    Shows the English line plus its native translation (from `cue.tr[lang]`).
    `speed` maps composition frames back to clip seconds (the clip may play at a
    per-language rate); `style` is the per-language subtitle look. */
const Subtitles: React.FC<{
  subtitles: Subtitle[];
  clipOffset: number;
  aspect: number;
  speed: number;
  lang: NativeLang;
  style: LangVariant["subtitle"];
}> = ({ subtitles, clipOffset, aspect, speed, lang, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (clipOffset + frame * speed) / fps;
  // Hold each cue a beat past its transcribed end so the trailing syllable stays
  // subtitled (whisper ends segments early — see PHRASE_LEAD_OUT_SEC), but never
  // into the next cue's start.
  const cue = subtitles.find((c, i) => {
    const next = subtitles[i + 1];
    const end = Math.min(c.to + PHRASE_LEAD_OUT_SEC, next ? next.from : Infinity);
    return sec >= c.from && sec < end;
  });
  if (!cue) return null;

  const translation = cue.tr?.[lang];
  const shadow = "0 2px 12px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)";

  // No fade — cues switch instantly (hard cut), one straight after another.
  return (
    <LowerBand aspect={aspect} opacity={1}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 940 }}>
        <span
          style={{
            display: "inline-block",
            color: style.color,
            fontFamily: FONT,
            fontSize: style.fontSize,
            fontWeight: 700,
            lineHeight: 1.22,
            textWrap: "balance",
            textShadow: shadow,
          }}
        >
          {cue.text}
        </span>
        {translation && (
          <span
            style={{
              display: "inline-block",
              color: style.trColor,
              fontFamily: FONT,
              fontSize: style.trFontSize,
              fontWeight: 500,
              lineHeight: 1.25,
              textWrap: "balance",
              textShadow: shadow,
            }}
          >
            {translation}
          </span>
        )}
      </div>
    </LowerBand>
  );
};

/** The Dictionary mockup video framed inside a phone, sliding up over the frozen scene. */
const PhoneMockup: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const appear = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const y = interpolate(appear, [0, 1], [height, 0]);

  // Phone frame matches the mockup's real aspect (slim, real-phone-like) so the
  // content is shown without cropping. A slimmer frame → taller phone.
  const phoneH = 1560;
  const phoneW = phoneH * (MOCKUP_WIDTH / MOCKUP_HEIGHT);

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

/** Fixed top banner shown above the letterboxed clip on every video: a localized
    headline, and under it the app logo + "VibeLing" on one line. Sits centered in
    the top black bar so it never covers the footage. */
const TopHeader: React.FC<{ aspect: number; lang: NativeLang }> = ({ aspect, lang }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: videoTopY(aspect),
      paddingLeft: 70,
      paddingRight: 70,
      paddingBottom: 24,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 16,
      textAlign: "center",
    }}
  >
    <span
      style={{
        color: "#ffffff",
        fontFamily: FONT,
        fontSize: 46,
        fontWeight: 800,
        lineHeight: 1.16,
        textWrap: "balance",
        maxWidth: 940,
        textShadow: "0 2px 10px rgba(0,0,0,0.6)",
      }}
    >
      {STRINGS[lang].header}
    </span>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Img
        src={staticFile("video/app-icon.png")}
        style={{ width: 64, height: 64, borderRadius: 15, display: "block" }}
      />
      <span
        style={{
          color: "#ffffff",
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: 0.5,
        }}
      >
        VibeLing
      </span>
    </div>
  </div>
);

/** Outro: the promo image fills the whole screen. Localized per audience
    language (`video/vibeling-<lang>.png`) so each variant ends differently. */
const Outro: React.FC<{ lang: NativeLang }> = ({ lang }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Img
      src={staticFile(`video/vibeling-${lang}.png`)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
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
  const variant = VARIANTS[lang];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Subtitled clip from the start, pausing on each highlight to show its mockup */}
      {t.segs.map((s, i) =>
        s.type === "play" ? (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipSlice clip={clip} from={s.srcFrom} to={s.srcTo} speed={t.speed} flip={variant.flip} />
            <Subtitles
              subtitles={subtitles}
              clipOffset={s.clipOffset}
              aspect={aspect}
              speed={t.speed}
              lang={lang}
              style={variant.subtitle}
            />
            <TopHeader aspect={aspect} lang={lang} />
          </Sequence>
        ) : (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipFreeze clip={clip} at={s.freezeAt} flip={variant.flip} />
            <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
            <PhoneMockup src={s.mockup} />
          </Sequence>
        ),
      )}

      {/* Soft music bed for each mockup pause. Rendered as its own Sequence that
          starts MUSIC_LEAD_SEC BEFORE the freeze (overlapping the tail of the
          preceding play segment) so the music is already going when the pause
          hits, and ends with the mockup. The frozen clip under the mockup is
          muted, so during the pause this bed (+ the mockup's baked click) is the
          only audio. Gain pre-baked (Html5Audio ignores `volume`); `loop` guards
          a mockup longer than the track. */}
      {t.segs
        .filter((s) => s.type === "mockup")
        .map((s, i) => {
          const lead = Math.min(s.from, Math.round(MUSIC_LEAD_SEC * fps));
          return (
            <Sequence key={`music-${i}`} from={s.from - lead} durationInFrames={s.duration + lead}>
              <Html5Audio src={staticFile(MOCKUP_MUSIC)} loop />
            </Sequence>
          );
        })}

      {/* Outro — vibeling.png for 2s */}
      <Sequence from={t.outroFrom} durationInFrames={t.durationInFrames - t.outroFrom}>
        <Outro lang={lang} />
      </Sequence>
    </AbsoluteFill>
  );
};
