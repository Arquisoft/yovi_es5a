import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import PlayerBadge from "./PlayerBadge";
import { useBoardStore } from "../store/boardStore";

export default function Header({
  currentPlayer,
  turnNumber,
  playerColors = {},
  playerOneName,
  playerTwoName,
}) {
  const { t } = useTranslation();
  const secondsElapsed = useBoardStore((state) => state.elapsedSeconds);
  const incrementElapsedSeconds = useBoardStore((state) => state.incrementElapsedSeconds);

  useEffect(() => {
    const id = setInterval(() => {
      incrementElapsedSeconds();
    }, 1000);
    return () => clearInterval(id);
  }, [incrementElapsedSeconds]);

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "#3a3a3a",
        borderRadius: 8,
        padding: "12px 24px",
        boxSizing: "border-box",
        marginBottom: 16,
        color: "#fff",
        overflow: "visible",
      }}
    >
      {/* Badge izquierdo — misma minWidth que el derecho */}
      <div style={{ minWidth: 80, display: "flex", justifyContent: "flex-start" }}>
        <PlayerBadge
          label={playerOneName}
          color={playerColors.player1}
          active={currentPlayer === "player1"}
        />
      </div>

      {/* Centro: turno y tiempo */}
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>
          {t("header.turn", { turnNumber })}
        </div>
        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(secondsElapsed)}
        </div>
      </div>

      {/* Badge derecho — misma minWidth que el izquierdo */}
      <div style={{ minWidth: 80, display: "flex", justifyContent: "flex-end" }}>
        <PlayerBadge
          label={playerTwoName}
          color={playerColors.player2}
          active={currentPlayer === "player2"}
        />
      </div>
    </div>
  );
}