import React from "react";

// Simplified iOS-style dark keyboard to match the reference screenshot.

const ROW1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW3 = ["z", "x", "c", "v", "b", "n", "m"];

const Key: React.FC<{ children: React.ReactNode; flex?: number; dark?: boolean }> = ({
  children,
  flex = 1,
  dark = false,
}) => {
  return (
    <div
      style={{
        flex,
        height: 92,
        margin: "0 5px",
        borderRadius: 12,
        backgroundColor: dark ? "#1c1f26" : "#3a3d44",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 40,
        fontWeight: 400,
        boxShadow: "0 1px 0 rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );
};

export const Keyboard: React.FC<{ offsetY?: number }> = ({ offsetY = 0 }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        transform: `translateY(${offsetY}px)`,
        backgroundColor: "#101319",
        paddingTop: 18,
        paddingBottom: 70,
        paddingLeft: 8,
        paddingRight: 8,
      }}
    >
      <div style={{ display: "flex", marginBottom: 14 }}>
        {ROW1.map((k) => (
          <Key key={k}>{k}</Key>
        ))}
      </div>
      <div style={{ display: "flex", marginBottom: 14, padding: "0 38px" }}>
        {ROW2.map((k) => (
          <Key key={k}>{k}</Key>
        ))}
      </div>
      <div style={{ display: "flex", marginBottom: 14 }}>
        <Key flex={1.5} dark>
          ⇧
        </Key>
        {ROW3.map((k) => (
          <Key key={k}>{k}</Key>
        ))}
        <Key flex={1.5} dark>
          ⌫
        </Key>
      </div>
      <div style={{ display: "flex" }}>
        <Key flex={1.4} dark>
          123
        </Key>
        <Key flex={1.2} dark>
          😊
        </Key>
        <Key flex={5} dark>
          <span style={{ fontSize: 30, color: "#9aa0aa" }}>space</span>
        </Key>
        <div
          style={{
            flex: 2,
            height: 92,
            margin: "0 5px",
            borderRadius: 12,
            backgroundColor: "#2563eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
            <path d="M21 21l-4-4" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};
