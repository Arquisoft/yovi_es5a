// src/components/GameBoard.jsx

import React, { useMemo, useState } from "react";
import BoardModel from "../game/BoardModel";
import KonvaRenderer from "../renderers/KonvaRenderer";

export default function GameBoard() {
  const board = useMemo(() => new BoardModel(8), []);

  // estado efímero en React: celda seleccionada y versión para forzar re-render
  const [selectedId, setSelectedId] = useState(null);
  const [, setVersion] = useState(0);

  const PLAYER_COLORS = {
    player1: "#e63946",
    player2: "#1d4ed8",
    selected: "#2ecc71",
    empty: "#ccc",
  };

  function handleCellClick(id) {
    setSelectedId(id);
  }

  function handleNextTurn() {
    if (!selectedId) return;
    const current = board.getCurrentTurn();
    board.setCellOwner(selectedId, current);
    board.nextTurn();
    setSelectedId(null);
    setVersion((v) => v + 1);
  }

  return (
    <div>
      <KonvaRenderer
        cells={board.getCells()}
        onCellClick={handleCellClick}
        selectedId={selectedId}
        playerColors={PLAYER_COLORS}
      />

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button disabled={!selectedId} onClick={handleNextTurn}>
          Pasar turno
        </button>
      </div>
    </div>
  );
}