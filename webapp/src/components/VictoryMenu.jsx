import React from "react";
import "./VictoryMenu.css";

export default function VictoryMenu({ playerName, title = "¡Victoria!", message, subtitle = "Enhorabuena por esta partida." }) {
  function handleFinish() {
    window.location.reload();
  }

  const resolvedMessage = message || `${playerName} ha ganado la partida.`;

  return (
    <div className="victoryOverlay" role="dialog" aria-modal="true">
      <div className="victoryCard">
        <h2>{title}</h2>
        <p>{resolvedMessage}</p>
        <p>{subtitle}</p>
        <button type="button" onClick={handleFinish}>
          Finalizar
        </button>
      </div>
    </div>
  );
}
