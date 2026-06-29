import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { Brand, COLORS, SearchBar } from "./ui";
import { Keyboard } from "./Keyboard";
import { words, type WordData } from "./schema";

// ---------- Timing (derived from the word so any word fits the scenario) ----------

const TYPE_START = 8;
const PER_CHAR = 3;
const WORD_SCENE_DURATION = 245;

export const getDictionaryTiming = (word: WordData) => {
  const typingEnd = TYPE_START + word.word.length * PER_CHAR;
  const transitionAt = typingEnd + 24;
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
      <svg width="90" height="90" viewBox="0 0 50 50" style={{ transform: `rotate(${rotation}deg)` }}>
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

const SearchScene: React.FC<{ word: WordData; timing: Timing }> = ({ word, timing }) => {
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

  const spinnerOpacity = interpolate(frame, [typingEnd + 7, typingEnd + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // keyboard slides away once typing is done
  const kbOffset = doneTyping
    ? interpolate(frame, [typingEnd + 12, typingEnd + 32], [0, 900], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic),
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Brand />
      <div style={{ height: 40 }} />
      <SearchBar text={typed} showCursor={cursorOn} />
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

const Example: React.FC<{ en: string; ru: string; delay: number }> = ({ en, ru, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = spring({ frame: frame - delay, fps, config: { damping: 200 } });
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
      <div style={{ color: "white", fontSize: 40, fontWeight: 500, marginBottom: 12 }}>{en}</div>
      <div style={{ color: COLORS.muted, fontSize: 36 }}>{ru}</div>
    </div>
  );
};

const WordScene: React.FC<{ word: WordData; localFrame: number }> = ({ word, localFrame }) => {
  const { fps } = useVideoConfig();

  const headerSpring = spring({ frame: localFrame - 4, fps, config: { damping: 200 } });
  const headerY = interpolate(headerSpring, [0, 1], [50, 0]);

  // Shrink long phrases so titles like "Abandoned my child" stay tidy.
  const titleSize = word.word.length > 16 ? 64 : word.word.length > 10 ? 78 : 96;

  // Button press: highlight around localFrame 150
  const pressStart = 150;
  const press = interpolate(localFrame, [pressStart, pressStart + 6, pressStart + 16], [1, 0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Toast appears after the press
  const toastStart = pressStart + 14;
  const toastSpring = spring({
    frame: localFrame - toastStart,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const toastVisible = localFrame > toastStart - 2;
  const toastScale = interpolate(toastSpring, [0, 1], [0.6, 1]);
  const overlayOpacity = interpolate(localFrame, [toastStart, toastStart + 10], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Brand />
      <div style={{ height: 40 }} />
      <SearchBar text={word.word} showCursor={false} />

      {word.image && (
        <div style={{ padding: "28px 60px 0" }}>
          <Img
            src={staticFile(word.image)}
            style={{
              width: "100%",
              height: 300,
              objectFit: "cover",
              borderRadius: 32,
              opacity: headerSpring,
              transform: `translateY(${headerY}px)`,
            }}
          />
        </div>
      )}

      <div
        style={{
          padding: "26px 60px 0",
          transform: `translateY(${headerY}px)`,
          opacity: headerSpring,
        }}
      >
        {/* word + phonetics */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <span style={{ color: "white", fontSize: titleSize, fontWeight: 700, lineHeight: 1.05 }}>
            {word.word}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ color: COLORS.accent, fontSize: 44, whiteSpace: "nowrap" }}>
              {word.phonetic}
            </span>
            <svg width="50" height="50" viewBox="0 0 24 24" fill={COLORS.muted}>
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              <path d="M16 8a5 5 0 010 8" stroke={COLORS.muted} strokeWidth="2" fill="none" />
            </svg>
          </div>
        </div>
        <div style={{ color: COLORS.muted, fontSize: 38, marginTop: 8 }}>{word.partOfSpeech}</div>

        <div
          style={{
            color: "white",
            fontSize: 54,
            fontWeight: 500,
            marginTop: 24,
            marginBottom: 30,
          }}
        >
          {word.translation}
        </div>

        <div style={{ color: COLORS.muted, fontSize: 36, marginBottom: 16, letterSpacing: 1 }}>
          ПРИМЕРЫ
        </div>
      </div>

      <div style={{ padding: "0 60px" }}>
        {word.examples.map((ex, i) => (
          <Example key={i} en={ex.en} ru={ex.ru} delay={20 + i * 12} />
        ))}
      </div>

      {/* Add to dictionary button */}
      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: 60,
          right: 60,
          transform: `scale(${press})`,
        }}
      >
        <div
          style={{
            height: 120,
            borderRadius: 30,
            background: `linear-gradient(135deg, ${COLORS.accent}, #6d28d9)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            boxShadow: `0 10px 40px rgba(139,92,246,0.45)`,
          }}
        >
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span style={{ color: "white", fontSize: 48, fontWeight: 600 }}>Добавить в словарь</span>
        </div>
      </div>

      {/* Toast overlay */}
      {toastVisible && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(0,0,0,${overlayOpacity})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              transform: `scale(${toastScale})`,
              opacity: toastSpring,
              backgroundColor: COLORS.card,
              borderRadius: 40,
              padding: "60px 70px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 32,
              boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
              maxWidth: 760,
            }}
          >
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 75,
                background: `linear-gradient(135deg, ${COLORS.accent}, #6d28d9)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="86" height="86" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              style={{
                color: "white",
                fontSize: 56,
                fontWeight: 600,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              Слово добавлено
              <br />
              для изучения
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ---------- Root composition ----------

export const Dictionary: React.FC<{ word: WordData }> = ({ word }) => {
  const frame = useCurrentFrame();
  const timing = getDictionaryTiming(word);
  const { transitionAt } = timing;

  const scene1Opacity = interpolate(frame, [transitionAt - 8, transitionAt + 8], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scene2Opacity = interpolate(frame, [transitionAt - 4, transitionAt + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {frame >= transitionAt - 12 && (
        <AbsoluteFill style={{ opacity: scene2Opacity }}>
          <WordScene word={word} localFrame={frame - transitionAt} />
        </AbsoluteFill>
      )}
      {frame < transitionAt + 10 && (
        <AbsoluteFill style={{ opacity: scene1Opacity }}>
          <SearchScene word={word} timing={timing} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// Default word used when the composition is rendered without explicit props.
export const defaultWord: WordData = words[0];
