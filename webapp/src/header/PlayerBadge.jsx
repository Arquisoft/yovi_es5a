import React from "react";

export default function PlayerBadge({ label, color = "#ccc", active = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "50%",
          background: color,
          border: active ? "3px solid white" : "3px solid transparent",
          opacity: active ? 1 : 0.9,  
        }}
      />
      <div style={{ marginTop: "0.375rem", fontSize: "0.75rem" }}>{label}</div>
    </div>
  );
}
