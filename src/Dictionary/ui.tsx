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

export const Brand: React.FC = () => {
  return (
    <div style={{ padding: "44px 56px 0" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          backgroundColor: COLORS.accent,
          color: "white",
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: 0.5,
          padding: "16px 32px",
          borderRadius: 999,
        }}
      >
        VibeLing
      </div>
    </div>
  );
};

export const SearchBar: React.FC<{
  text: string;
  cancel: string;
  showCursor?: boolean;
  showClear?: boolean;
}> = ({ text, cancel, showCursor = false, showClear = true }) => {
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
      <span style={{ color: COLORS.accent, fontSize: 40, fontWeight: 500 }}>{cancel}</span>
    </div>
  );
};

