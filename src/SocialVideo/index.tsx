import React from "react";
import {
  AbsoluteFill,
  Easing,
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
import { COLORS } from "../Dictionary/ui";
import type { SocialVideoData, Subtitle } from "./schema";
import { STRINGS, VARIANTS, phrasesLearned, type NativeLang, type LangVariant } from "../i18n";

// ============================================================================
// This is the reusable RECIPE. Everything describing a particular video comes
// in as `config` (a SocialVideoData) — see ./schema.ts and ./videos/*.json.
// ============================================================================

// The outro is a RECAP built in Remotion (not a static image): "today we learned
// N expressions" + the list + the VibeLing CTA. It needs room to stagger in.
const DEFAULT_OUTRO_SEC = 4;

// How long before a highlight pause the "next phrase in N s" countdown appears.
// The same window is when that phrase lights up inside the subtitle line, so the
// viewer sees WHAT is coming and WHEN — anticipation instead of a surprise cut.
const COUNTDOWN_LEAD_SEC = 5;

// Soft music bed under the OUTRO recap (the clip's audio has stopped by then).
// Gain is PRE-BAKED into this file (Html5Audio ignores `volume` at render —
// regenerate with `node scripts/soften-audio.mjs <src> public/sounds/inspiring-dreams-soft.wav <gain>`).
// It is deliberately NOT used for the mockup pauses: those now last ~2s, too
// short for a music bed to do anything but fade in and get cut off.
const OUTRO_MUSIC = "sounds/inspiring-dreams-soft.wav";

// Played as the phone mockup slides up, and again as it slides back down — a
// swipe accent per move is all a ~2s pause needs (the "added" click is baked
// into the mockup itself).
const MOCKUP_SWIPE = "sounds/swipe-soft.wav";

// After the mockup video ends, hold its last frame this long before the phone
// leaves — a beat to actually read the translation on the card.
const MOCKUP_HOLD_SEC = 0.1;
// Frames the phone takes to slide back down out of frame (the mirror of its
// entrance). The scene un-dims over the same window, so the film is already
// fully visible when playback resumes.
const MOCKUP_EXIT_FRAMES = 8;

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
  | {
      type: "mockup";
      from: number;
      /** Whole pause: the mockup video + the extra hold + the slide-out. */
      duration: number;
      /** Length of the mockup VIDEO itself; after it the last frame is held. */
      mockupLen: number;
      freezeAt: number;
      mockup: string;
      slug: string;
    };

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
    // The pause outlives the mockup video: a short extra hold on its last frame
    // (so the translation can actually be read) and then the slide-out.
    const pauseLen = h.mockupLen + Math.round(MOCKUP_HOLD_SEC * fps) + MOCKUP_EXIT_FRAMES;
    segs.push({
      type: "mockup",
      from: cursor,
      duration: pauseLen,
      mockupLen: h.mockupLen,
      freezeAt: clipStart + h.localFrame,
      mockup: h.mockup,
      slug: h.slug,
    });
    cursor += pauseLen;
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

/** Collapse to comparable letters/digits — the same normalisation `transcribe`
    uses to locate a highlight phrase inside a transcript segment. */
const collapse = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Locate a highlight slug's words inside a subtitle line and split the line into
 * [before, phrase, after] (original casing/punctuation preserved). Matching is
 * done on the collapsed forms, so "tread-lightly" finds "tread lightly." — and an
 * index map carries the hit back to offsets in the original string.
 * Returns null when the phrase isn't in this cue.
 */
const splitOnPhrase = (text: string, slug: string): [string, string, string] | null => {
  const needle = collapse(slug);
  if (!needle) return null;
  const map: number[] = [];
  let norm = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if (c >= "a" && c <= "z") {
      norm += c;
      map.push(i);
    } else if (c >= "0" && c <= "9") {
      norm += c;
      map.push(i);
    }
  }
  const at = norm.indexOf(needle);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + needle.length - 1] + 1;
  return [text.slice(0, start), text.slice(start, end), text.slice(end)];
};

/** The upcoming phrase, marked inside the subtitle line with a pulsing chip so
    the viewer knows what is about to be added to the dictionary. */
const PhraseMark: React.FC<{ text: string; style: LangVariant["subtitle"] }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // ~0.75 Hz breathing glow — alive, but not a strobe.
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 * 0.75);
  return (
    <span
      style={{
        color: style.hlColor,
        backgroundColor: `rgba(${style.hlRgb},${(0.32 + 0.28 * pulse).toFixed(3)})`,
        boxShadow: `0 0 ${(18 + 22 * pulse).toFixed(0)}px rgba(${style.hlRgb},${(0.35 + 0.35 * pulse).toFixed(3)})`,
        borderRadius: 12,
        padding: "0 8px",
        margin: "0 -2px",
        // Keep the chip intact when the line wraps mid-phrase.
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {text}
    </span>
  );
};

/** Subtitles: one cue at a time, centered under the video, with a soft fade.
    Shows the English line plus its native translation (from `cue.tr[lang]`).
    `speed` maps composition frames back to clip seconds (the clip may play at a
    per-language rate); `style` is the per-language subtitle look. `pendingSlug`
    is the highlight this play segment is heading towards — when its words occur
    in the current cue they're marked (see PhraseMark). */
const Subtitles: React.FC<{
  subtitles: Subtitle[];
  clipOffset: number;
  aspect: number;
  speed: number;
  lang: NativeLang;
  style: LangVariant["subtitle"];
  pendingSlug?: string;
}> = ({ subtitles, clipOffset, aspect, speed, lang, style, pendingSlug }) => {
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
  const parts = pendingSlug ? splitOnPhrase(cue.text, pendingSlug) : null;

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
          {parts ? (
            <>
              {parts[0]}
              <PhraseMark text={parts[1]} style={style} />
              {parts[2]}
            </>
          ) : (
            cue.text
          )}
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

/** The Dictionary mockup video framed inside a phone: slides UP over the frozen
    scene, and after `exitAt` slides back DOWN out of frame — the same move in
    reverse, so the pause opens and closes instead of just cutting away.
    `mockupLen` is the video's own length; past it the last frame is held (the
    card is static by then anyway) so the phone never shows an empty player. */
const PhoneMockup: React.FC<{ src: string; mockupLen: number; exitAt: number }> = ({
  src,
  mockupLen,
  exitAt,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  // Snappy: the whole mockup only lasts ~2s, so it must be fully on screen after
  // ~1/3s — a leisurely slide would eat the beat it's supposed to deliver.
  const appear = spring({ frame, fps, config: { damping: 20, stiffness: 220 }, durationInFrames: 10 });
  // Exit accelerates away (ease-in) rather than easing out like the entrance —
  // it should feel dismissed, not placed.
  const leave = interpolate(frame, [exitAt, exitAt + MOCKUP_EXIT_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const y = interpolate(appear, [0, 1], [height, 0]) + leave * height;

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
          <Sequence durationInFrames={mockupLen}>
            <OffthreadVideo src={staticFile(src)} style={fillVideo} />
          </Sequence>
          {/* Hold the final frame for the extra beat + the slide-out. Picked with
              `trimBefore` and held at `frame={0}` — see ClipFreeze for why. */}
          <Sequence from={mockupLen}>
            <Freeze frame={0}>
              <OffthreadVideo src={staticFile(src)} trimBefore={mockupLen - 1} style={fillVideo} muted />
            </Freeze>
          </Sequence>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** A whole highlight pause: the frozen film frame, the dimming, the phone, and
    the swipe accents. The dimming lifts as the phone leaves, so the scene is
    fully back before playback resumes. */
const MockupPause: React.FC<{
  clip: string;
  freezeAt: number;
  flip: boolean;
  mockup: string;
  mockupLen: number;
  duration: number;
}> = ({ clip, freezeAt, flip, mockup, mockupLen, duration }) => {
  const frame = useCurrentFrame();
  const exitAt = duration - MOCKUP_EXIT_FRAMES;
  const leave = interpolate(frame, [exitAt, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <ClipFreeze clip={clip} at={freezeAt} flip={flip} />
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${0.55 * (1 - leave)})` }} />
      <PhoneMockup src={mockup} mockupLen={mockupLen} exitAt={exitAt} />
      {/* One swipe in, one swipe out. The frozen clip is muted, so these + the
          mockup's baked click are the only audio during the pause. */}
      <Html5Audio src={staticFile(MOCKUP_SWIPE)} />
      <Sequence from={exitAt}>
        <Html5Audio src={staticFile(MOCKUP_SWIPE)} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** "Новая фраза через 3 с" — a countdown to the next dictionary pause, with a
    depleting bar under it. Sits in the top black bar during the last
    COUNTDOWN_LEAD_SEC of a play segment; before that it's invisible but still
    occupies its slot, so nothing above it jumps when it appears.
    `pauseAtFrame` is the local frame of this play segment where the clip freezes
    (i.e. the segment's length); null = no pause is coming (last segment). */
const NextPhraseCountdown: React.FC<{ lang: NativeLang; pauseAtFrame: number | null }> = ({
  lang,
  pauseAtFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const window = COUNTDOWN_LEAD_SEC * fps;
  const framesLeft = pauseAtFrame === null ? null : pauseAtFrame - frame;
  const visible = framesLeft !== null && framesLeft <= window && framesLeft >= 0;
  const left = framesLeft ?? 0;
  const secs = Math.max(1, Math.ceil(left / fps));
  // Pop on each tick of the second.
  const scale = interpolate(left % fps, [0, 5], [1.12, 1], { extrapolateRight: "clamp" });
  const progress = Math.min(1, Math.max(0, left / window));
  const s = STRINGS[lang];

  return (
    <div style={{ height: 92, display: "flex", alignItems: "center", opacity: visible ? 1 : 0 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 30px",
            borderRadius: 999,
            backgroundColor: "rgba(139,92,246,0.22)",
            border: "2px solid rgba(139,92,246,0.75)",
          }}
        >
          <span style={{ fontSize: 32 }}>⏳</span>
          <span
            style={{
              color: "#ffffff",
              fontFamily: FONT,
              fontSize: 36,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {s.nextPhraseIn} {secs} {s.secShort}
          </span>
        </div>
        <div
          style={{
            width: 300,
            height: 6,
            borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.18)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(1 - progress) * 100}%`,
              height: "100%",
              backgroundColor: COLORS.accent,
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Fixed top banner shown above the letterboxed clip on every video: the video's
    own attention hook, the app logo + "VibeLing", and the countdown to the next
    phrase. Sits centered in the top black bar so it never covers the footage.
    `hook` is this video's scene-specific headline (config.hook[lang]); without
    one it falls back to the generic STRINGS[lang].header. */
const TopHeader: React.FC<{
  aspect: number;
  lang: NativeLang;
  hook?: string;
  /** Local frame of this segment where the clip freezes for the next mockup. */
  pauseAtFrame?: number | null;
}> = ({ aspect, lang, hook, pauseAtFrame = null }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: videoTopY(aspect),
      paddingLeft: 70,
      paddingRight: 70,
      paddingBottom: 18,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 14,
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
      {hook || STRINGS[lang].header}
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
    <NextPhraseCountdown lang={lang} pauseAtFrame={pauseAtFrame} />
  </div>
);

/** One recapped phrase: a check mark, the English phrase, its translation. */
const RecapRow: React.FC<{ en: string; tr: string; delay: number }> = ({ en, tr, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  });
  const x = interpolate(appear, [0, 1], [-60, 0]);
  return (
    <div
      style={{
        opacity: appear,
        transform: `translateX(${x}px)`,
        display: "flex",
        alignItems: "center",
        gap: 28,
        backgroundColor: COLORS.card,
        borderRadius: 32,
        borderLeft: `8px solid ${COLORS.accent}`,
        padding: "28px 36px",
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          width: 74,
          height: 74,
          borderRadius: 37,
          background: `linear-gradient(135deg, ${COLORS.accent}, #6d28d9)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div style={{ color: "#ffffff", fontFamily: FONT, fontSize: 54, fontWeight: 700, lineHeight: 1.15 }}>
          {en}
        </div>
        {tr && (
          <div style={{ color: COLORS.muted, fontFamily: FONT, fontSize: 40, marginTop: 6, lineHeight: 1.2 }}>
            {tr}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Outro: a RECAP of the lesson, built in Remotion (it replaced the static
 * `video/vibeling-<lang>.png` promo, which was identical on every video).
 * "Сегодня выучили / 3 новых выражения" + the list of exactly those phrases with
 * their translations, then the VibeLing CTA + logo. The point is the feeling of
 * PROGRESS — the viewer should end the video seeing what they just gained.
 * Every line is data-derived (config.highlights × words.generated.json), so it
 * writes itself for any new video.
 */
const Outro: React.FC<{ lang: NativeLang; slugs: string[] }> = ({ lang, slugs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = slugs.map((slug) => {
    const w = findWord(lang, slug);
    return {
      en: w?.word ?? slug.split("-").join(" "),
      tr: w?.translation ?? "",
    };
  });

  const titleAppear = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const rowStart = 12;
  const rowStep = 9;
  const ctaAt = rowStart + items.length * rowStep + 8;
  const ctaAppear = spring({ frame: frame - ctaAt, fps, config: { damping: 200 }, durationInFrames: 14 });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, #1a1440 0%, ${COLORS.bg} 60%)`,
        padding: "120px 70px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 90,
        textAlign: "center",
      }}
    >
      {/* Title: what happened today */}
      <div style={{ opacity: titleAppear, transform: `translateY(${interpolate(titleAppear, [0, 1], [-40, 0])}px)` }}>
        <div style={{ color: COLORS.muted, fontFamily: FONT, fontSize: 56, fontWeight: 600 }}>
          {STRINGS[lang].recapTitle}
        </div>
        <div
          style={{
            color: "#ffffff",
            fontFamily: FONT,
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.1,
            marginTop: 14,
            textWrap: "balance",
          }}
        >
          {phrasesLearned(lang, items.length)}
        </div>
      </div>

      {/* The list of exactly what was added */}
      <div style={{ display: "flex", flexDirection: "column", gap: 26, width: "100%" }}>
        {items.map((it, i) => (
          <RecapRow key={i} en={it.en} tr={it.tr} delay={rowStart + i * rowStep} />
        ))}
      </div>

      {/* CTA + logo */}
      <div
        style={{
          opacity: ctaAppear,
          transform: `scale(${interpolate(ctaAppear, [0, 1], [0.86, 1])})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <div style={{ color: "#ffffff", fontFamily: FONT, fontSize: 58, fontWeight: 700 }}>
          {STRINGS[lang].recapCta}
        </div>
        {/* Logo + wordmark only — the CTA line above already says VibeLing, so a
            tagline here would be a third repetition of the same brand. */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Img
            src={staticFile("video/app-icon.png")}
            style={{ width: 108, height: 108, borderRadius: 26, display: "block" }}
          />
          <div style={{ color: "#ffffff", fontFamily: FONT, fontSize: 66, fontWeight: 800, letterSpacing: 0.5 }}>
            VibeLing
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

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
      {t.segs.map((s, i) => {
        // A play segment always runs INTO the next highlight's freeze (except the
        // last one) — so the segment's own length is the countdown target, and
        // that highlight's slug is the phrase to mark inside the subtitles.
        const next = t.segs[i + 1];
        const pending = s.type === "play" && next?.type === "mockup" ? next : null;
        return s.type === "play" ? (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <ClipSlice clip={clip} from={s.srcFrom} to={s.srcTo} speed={t.speed} flip={variant.flip} />
            <Subtitles
              subtitles={subtitles}
              clipOffset={s.clipOffset}
              aspect={aspect}
              speed={t.speed}
              lang={lang}
              style={variant.subtitle}
              pendingSlug={pending?.slug}
            />
            <TopHeader
              aspect={aspect}
              lang={lang}
              hook={config.hook?.[lang]}
              pauseAtFrame={pending ? s.duration : null}
            />
          </Sequence>
        ) : (
          <Sequence key={i} from={s.from} durationInFrames={s.duration}>
            <MockupPause
              clip={clip}
              freezeAt={s.freezeAt}
              flip={variant.flip}
              mockup={s.mockup}
              mockupLen={s.mockupLen}
              duration={s.duration}
            />
          </Sequence>
        );
      })}

      {/* Outro — the recap of what was learned, over a soft music bed so the end
          doesn't fall into silence once the clip's audio stops. Gain pre-baked
          (Html5Audio ignores `volume`); `loop` guards a longer recap. */}
      <Sequence from={t.outroFrom} durationInFrames={t.durationInFrames - t.outroFrom}>
        <Outro lang={lang} slugs={config.highlights.map((h) => h.slug)} />
        <Html5Audio src={staticFile(OUTRO_MUSIC)} loop />
      </Sequence>
    </AbsoluteFill>
  );
};
