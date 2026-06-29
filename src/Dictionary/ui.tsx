import React from "react";

export const COLORS = {
  bg: "#0a0e1a",
  searchBg: "#16203a",
  card: "#141b2e",
  accent: "#8b5cf6",
  blue: "#2563eb",
  text: "#ffffff",
  muted: "#8a93a6",
};

export const StatusBar: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "44px 56px 0",
        color: "white",
        fontSize: 38,
        fontWeight: 600,
      }}
    >
      <span>03:21</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* signal */}
        <svg width="40" height="28" viewBox="0 0 40 28" fill="white">
          <rect x="0" y="18" width="6" height="10" rx="1" />
          <rect x="9" y="13" width="6" height="15" rx="1" />
          <rect x="18" y="8" width="6" height="20" rx="1" />
          <rect x="27" y="3" width="6" height="25" rx="1" />
        </svg>
        {/* wifi */}
        <svg width="38" height="28" viewBox="0 0 24 18" fill="white">
          <path d="M12 3C7 3 3 5.5 1 8l2 2c1.7-2 5-4 9-4s7.3 2 9 4l2-2c-2-2.5-6-5-11-5z" />
          <path d="M12 9c-2.5 0-4.7 1-6 2.5l2 2c.9-1 2.4-1.7 4-1.7s3.1.7 4 1.7l2-2C16.7 10 14.5 9 12 9z" />
          <circle cx="12" cy="16" r="2" />
        </svg>
        {/* battery */}
        <div
          style={{
            width: 52,
            height: 26,
            border: "2px solid white",
            borderRadius: 6,
            padding: 3,
            position: "relative",
          }}
        >
          <div style={{ width: "35%", height: "100%", background: "white", borderRadius: 2 }} />
          <div
            style={{
              position: "absolute",
              right: -6,
              top: 8,
              width: 4,
              height: 10,
              background: "white",
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const SearchBar: React.FC<{
  text: string;
  showCursor?: boolean;
  showClear?: boolean;
}> = ({ text, showCursor = false, showClear = true }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 40px", gap: 24 }}>
      <div
        style={{
          flex: 1,
          height: 100,
          backgroundColor: COLORS.searchBg,
          borderRadius: 50,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          gap: 20,
        }}
      >
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={COLORS.muted} strokeWidth="2.2" />
          <path d="M21 21l-4-4" stroke={COLORS.muted} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <span style={{ color: "white", fontSize: 44, fontWeight: 500 }}>{text}</span>
          {showCursor && (
            <span
              style={{
                width: 3,
                height: 48,
                backgroundColor: COLORS.accent,
                marginLeft: 2,
                borderRadius: 2,
              }}
            />
          )}
        </div>
        {showClear && text.length > 0 && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#2a3550",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.muted,
              fontSize: 32,
            }}
          >
            ✕
          </div>
        )}
      </div>
      <span style={{ color: COLORS.accent, fontSize: 40, fontWeight: 500 }}>Отмена</span>
    </div>
  );
};

export const LanguageRow: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "44px 60px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <span style={{ fontSize: 56 }}>🇬🇧</span>
        <span style={{ color: "white", fontSize: 44, fontWeight: 500 }}>Английский</span>
      </div>
      <svg width="60" height="44" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 7h11l-3-3M17 17H6l3 3"
          stroke={COLORS.accent}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <span style={{ fontSize: 56 }}>🇷🇺</span>
        <span style={{ color: "white", fontSize: 44, fontWeight: 500 }}>Русский</span>
      </div>
    </div>
  );
};
