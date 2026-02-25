import React, { useEffect, useState } from "react";
import BoardModel from "../game/BoardModel";
import KonvaRenderer from "../renderers/KonvaRenderer";
import Header from "../header/Header";
import "./GameBoard.css";

export default function GameBoard({ user, difficulty }) {
  const [boardSize, setBoardSize] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/v1/game/state')
      .then(res => res.json())
      .then(data => {
        console.log('Datos recibidos del backend:', data);
        setBoardSize(data.board_size);
      });
  }, []);

  // Solo crea el board si boardSize está definido
  const board = React.useMemo(
    () => (boardSize ? new BoardModel(boardSize) : null),
    [boardSize]
  );

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
    if (!selectedId || !board) return;
    const current = board.getCurrentPlayer(); // "player1" / "player2"
    board.setCellOwner(selectedId, current);
    board.nextTurn();
    setSelectedId(null);
    setVersion((v) => v + 1);
  }

  if (!board) return <div>Cargando tablero...</div>;

  return (
    <div>
      <p className="dificultad">Dificultad: {difficulty}</p>
      <Header
        currentPlayer={board.getCurrentPlayer()}
        turnNumber={board.getTurnNumber()}
        playerColors={PLAYER_COLORS}
        UserName={user.username}
      />
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
