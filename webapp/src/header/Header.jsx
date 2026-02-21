import React, { useEffect, useState } from "react";
import PlayerBadge from "./PlayerBadge";

export default function Header({ currentPlayer, turnNumber, playerColors = {} }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function formatTime(sec) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        background: "#4a4646",
        borderBottom: "1px solid #000000",
      }}
    >
      <div style={{ width: 120 }}>
        <PlayerBadge label={"Jugador 1"} color={playerColors.player1} active={currentPlayer === "player1"} />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>Turno {turnNumber}</div>
        <div style={{ fontSize: 18, fontWeight: "bold" }}>{formatTime(secondsElapsed)}</div>
      </div>

      <div style={{ width: 120, display: "flex", justifyContent: "flex-end" }}>
        <PlayerBadge label={"Jugador 2"} color={playerColors.player2} active={currentPlayer === "player2"} />
      </div>
    </div>
  );
}
