import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { Brand, COLORS, SearchBar } from "./ui";
import { Keyboard } from "./Keyboard";
import { words, type WordData } from "./schema";
import { STRINGS } from "../i18n";

// Mockup canvas size. Taller-than-16:9 so the phone frame in the social video
// reads like a real phone (slimmer). Shared with Root.tsx (composition size) and
// SocialVideo's PhoneMockup (frame aspect) so they never drift apart.
export const MOCKUP_WIDTH = 1080;
export const MOCKUP_HEIGHT = 2160;

/** How many usage examples to show on the word card (kept short so the card fits
    the slimmer phone). */
const MAX_EXAMPLES = 2;

// ---------- Timing (derived from the word so any word fits the scenario) ----------
//
// SNAPPY BY DESIGN: this mockup interrupts the film scene, so the whole "search →
// card → added" beat must land in ~2–2.5s and hand the viewer straight back to
// the show. Everything below is tuned for that budget — typing is a fast flourish
// (sub-second even for a long phrase), the keyboard/spinner exit immediately, and
// the card only has to read as "the phrase is in my dictionary now". If you
// lengthen anything here, the pause starts to feel like an ad break.

const TYPE_START = 2;
/** Frames per typed character (<1 = several chars per frame). */
const PER_CHAR = 0.45;
/** Frames between the end of typing and the cut to the word card. */
const SEARCH_TAIL = 8;
const WORD_SCENE_DURATION = 56;
/** Scene-2 local frame where the "Добавить в словарь" button is tapped. */
const PRESS_AT = 20;

export const getDictionaryTiming = (word: WordData) => {
  const typingEnd = Math.ceil(TYPE_START + word.word.length * PER_CHAR);
  const transitionAt = typingEnd + SEARCH_TAIL;
  return {
    typeStart: TYPE_START,
    perChar: PER_CHAR,
    typingEnd,
    transitionAt,
    durationInFrames: transitionAt + WORD_SCENE_DURATION,
  };
};

type Timing = ReturnType<typeof getDictionaryTiming>;

// ---------- Scene 1: search + typing ----------

const Spinner: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = (frame * 12) % 360;
  return (
    <div
      style={{
        position: "absolute",
        top: 520,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <svg
        width="90"
        height="90"
        viewBox="0 0 50 50"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="23.5"
            y="3"
            width="3"
            height="12"
            rx="1.5"
            fill={COLORS.accent}
            opacity={(i + 1) / 12}
            transform={`rotate(${i * 30} 25 25)`}
          />
        ))}
      </svg>
    </div>
  );
};

const SearchScene: React.FC<{ word: WordData; timing: Timing }> = ({
  word,
  timing,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const text = word.word;
  const { typeStart, perChar, typingEnd } = timing;
  const chars = Math.min(
    text.length,
    Math.max(0, Math.floor((frame - typeStart) / perChar)),
  );
  const typed = text.slice(0, chars);
  const doneTyping = frame > typingEnd;

  // blinking cursor
  const cursorOn = Math.floor(frame / 15) % 2 === 0 || !doneTyping;

  const spinnerOpacity = interpolate(
    frame,
    [typingEnd + 1, typingEnd + 4],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // keyboard slides away once typing is done — fast, it must be gone by the cut
  const kbOffset = doneTyping
    ? interpolate(frame, [typingEnd + 1, typingEnd + SEARCH_TAIL], [0, 900], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic),
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Brand lang={word.lang} />
      <div style={{ height: 40 }} />
      <SearchBar text={typed} cancel={STRINGS[word.lang].cancel} showCursor={cursorOn} />
      <div style={{ opacity: spinnerOpacity }}>
        <Spinner />
      </div>
      <Keyboard offsetY={kbOffset} />
      {/* unused fps ref to keep hook honest */}
      <span style={{ display: "none" }}>{fps}</span>
    </AbsoluteFill>
  );
};

// ---------- Scene 2: word detail ----------

const Example: React.FC<{ original: string; translation: string; delay: number }> = ({
  original,
  translation,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 10,
  });
  const y = interpolate(appear, [0, 1], [40, 0]);
  return (
    <div
      style={{
        opacity: appear,
        transform: `translateY(${y}px)`,
        backgroundColor: COLORS.card,
        borderRadius: 28,
        padding: "24px 34px",
        marginBottom: 18,
        borderLeft: `6px solid ${COLORS.accent}`,
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 42,
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        {original}
      </div>
      <div style={{ color: COLORS.muted, fontSize: 38 }}>{translation}</div>
    </div>
  );
};

const WordScene: React.FC<{ word: WordData; localFrame: number }> = ({
  word,
  localFrame,
}) => {
  const { fps } = useVideoConfig();
  const s = STRINGS[word.lang];

  const headerSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: 8,
  });
  const headerY = interpolate(headerSpring, [0, 1], [50, 0]);

  // Shrink long phrases so titles like "Abandoned my child" stay tidy.
  const titleSize =
    word.word.length > 16 ? 66 : word.word.length > 10 ? 80 : 98;

  // The search input fades out quickly so it doesn't linger over the image.
  const searchHide = interpolate(localFrame, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Button press: a quick, snappy tap early on.
  const pressStart = PRESS_AT;
  const press = interpolate(
    localFrame,
    [pressStart, pressStart + 2, pressStart + 6],
    [1, 0.9, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Confirmation IS the button: right after the tap it flips to green + a check
  // mark + "Добавлено". No modal — a modal covers the card the viewer is reading
  // and costs a second we don't have in a ~2s mockup.
  const doneAt = pressStart + 4;
  const done = interpolate(localFrame, [doneAt, doneAt + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Brand lang={word.lang} />
      {/* Top slot under the brand: the image lives here and appears in place,
          while the input is overlaid on top and fades out to reveal it. */}
      <div style={{ position: "relative" }}>
        {word.image && (
          <div style={{ padding: "40px 60px 0" }}>
            <Img
              src={staticFile(word.image)}
              style={{
                width: "100%",
                height: 620,
                objectFit: "cover",
                borderRadius: 32,
                opacity: headerSpring,
              }}
            />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            opacity: 1 - searchHide,
            transform: `translateY(${interpolate(searchHide, [0, 1], [0, -16])}px)`,
          }}
        >
          <SearchBar text={word.word} cancel={s.cancel} showCursor={false} />
        </div>
      </div>

      <div
        style={{
          padding: "26px 60px 0",
          transform: `translateY(${headerY}px)`,
          opacity: headerSpring,
        }}
      >
        {/* word + phonetics */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            {word.word}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span
              style={{
                color: COLORS.accent,
                fontSize: 46,
                whiteSpace: "nowrap",
              }}
            >
              {word.phonetic}
            </span>
            <svg width="50" height="50" viewBox="0 0 24 24" fill={COLORS.muted}>
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              <path
                d="M16 8a5 5 0 010 8"
                stroke={COLORS.muted}
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
        </div>
        <div
          style={{
            color: "white",
            fontSize: 56,
            fontWeight: 500,
            marginTop: 24,
            marginBottom: 30,
          }}
        >
          {word.translation}
        </div>

        <div
          style={{
            color: COLORS.muted,
            fontSize: 38,
            marginBottom: 16,
            letterSpacing: 1,
          }}
        >
          {s.examples}
        </div>
      </div>

      <div style={{ padding: "0 60px" }}>
        {word.examples.slice(0, MAX_EXAMPLES).map((ex, i) => (
          <Example key={i} original={ex.original} translation={ex.translation} delay={3 + i * 3} />
        ))}
      </div>

      {/* The "add to dictionary" button — and, after the tap, the confirmation:
          it cross-fades to green with a check mark and "Добавлено". Both states
          are stacked so the pill's size never jumps mid-swap. */}
      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: 60,
          right: 60,
          transform: `scale(${press})`,
        }}
      >
        <div style={{ position: "relative", height: 120 }}>
          {[
            {
              key: "add",
              opacity: 1 - done,
              gradient: `linear-gradient(135deg, ${COLORS.accent}, #6d28d9)`,
              glow: "0 10px 40px rgba(139,92,246,0.45)",
              icon: <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round" />,
              label: s.addToDict,
            },
            {
              key: "done",
              opacity: done,
              gradient: "linear-gradient(135deg, #22c55e, #15803d)",
              glow: "0 10px 40px rgba(34,197,94,0.45)",
              icon: (
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
              label: s.added,
            },
          ].map((state) => (
            <div
              key={state.key}
              style={{
                position: "absolute",
                inset: 0,
                opacity: state.opacity,
                height: 120,
                borderRadius: 999,
                background: state.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                boxShadow: state.glow,
              }}
            >
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                {state.icon}
              </svg>
              <span style={{ color: "white", fontSize: 50, fontWeight: 600 }}>{state.label}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Root composition ----------

export const Dictionary: React.FC<{ word: WordData }> = ({ word }) => {
  const frame = useCurrentFrame();
  const timing = getDictionaryTiming(word);
  const { transitionAt } = timing;

  const scene1Opacity = interpolate(
    frame,
    [transitionAt - 4, transitionAt + 1],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const scene2Opacity = interpolate(
    frame,
    [transitionAt - 2, transitionAt + 3],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {frame >= transitionAt - 3 && (
        <AbsoluteFill style={{ opacity: scene2Opacity }}>
          <WordScene word={word} localFrame={frame - transitionAt} />
        </AbsoluteFill>
      )}
      {frame < transitionAt + 2 && (
        <AbsoluteFill style={{ opacity: scene1Opacity }}>
          <SearchScene word={word} timing={timing} />
        </AbsoluteFill>
      )}

      {/* Click sound exactly when the "Добавить в словарь" button is tapped.
          Baked into the mockup render so the social video plays it in sync. */}
      <Sequence from={transitionAt + PRESS_AT}>
        <Html5Audio src={staticFile("sounds/click-soft.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Default word used when the composition is rendered without explicit props.
export const defaultWord: WordData = words[0];
