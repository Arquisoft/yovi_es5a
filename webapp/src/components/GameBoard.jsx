import React from "react";
import KonvaRenderer from "../renderers/KonvaRenderer";
import Header from "../header/Header";
import { useBoardStore } from "../store/boardStore";
import "./GameBoard.css";

export default function GameBoard({ user, difficulty }) {
  const cells = useBoardStore((state) => state.cells);
  const turnNumber = useBoardStore((state) => state.turnNumber);
  const currentPlayer = useBoardStore((state) => (state.turnNumber % 2 === 1 ? "player1" : "player2"));
  const initializeBoard = useBoardStore((state) => state.initializeBoard);
  const playTurn = useBoardStore((state) => state.playTurn);

  const [selectedId, setSelectedId] = React.useState(null);

  React.useEffect(() => {
    initializeBoard(8);
  }, [initializeBoard]);

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
    const moved = playTurn(selectedId);
    if (moved) {
      setSelectedId(null);
    }
  }

  return (
    <div>
        <p className="dificultad">Dificultad: {difficulty}</p>

      <Header
        currentPlayer={currentPlayer}
        turnNumber={turnNumber}
        playerColors={PLAYER_COLORS}
        UserName={user.username}
      />

      <KonvaRenderer
        cells={cells}
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
