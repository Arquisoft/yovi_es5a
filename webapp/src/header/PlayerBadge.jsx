import React from "react";

export default function PlayerBadge({ label, color = "#ccc", active = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "1.25rem",
          background: color,
          boxShadow: active ? "0 6px 14px rgba(100,112,255,0.22)" : "none",
          opacity: active ? 1 : 0.9,
        }}
      />
      <div style={{ marginTop: "0.375rem", fontSize: "0.75rem" }}>{label}</div>
    </div>
  );
}
