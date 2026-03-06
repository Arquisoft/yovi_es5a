import React from "react";

export default function PlayerBadge({ label, color = "#ccc", active = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: color,
          boxShadow: active ? "0 0 0 4px rgb(255, 255, 255)" : "none",
          opacity: active ? 1 : 0.8,
        }}
      />
      <div style={{ marginTop: 6, fontSize: 12 }}>{label}</div>
    </div>
  );
}
