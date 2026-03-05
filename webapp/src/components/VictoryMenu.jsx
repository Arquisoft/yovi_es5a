import React from "react";
import "./VictoryMenu.css";

export default function VictoryMenu({ playerName }) {
  function handleFinish() {
    window.location.reload();
  }

  return (
    <div className="victoryOverlay" role="dialog" aria-modal="true">
      <div className="victoryCard">
        <h2>¡Victoria!</h2>
        <p>{playerName} ha ganado la partida.</p>
        <p>Enhorabuena por esta partida.</p>
        <button type="button" onClick={handleFinish}>
          Finalizar
        </button>
      </div>
    </div>
  );
}
