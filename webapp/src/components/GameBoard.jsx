import React from "react";
import KonvaRenderer from "../renderers/KonvaRenderer";
import Header from "../header/Header";
import { useBoardStore } from "../store/boardStore";
import VictoryMenu from "./VictoryMenu";
import { boardToYen, parseCellId } from "../parsers/yenParser";
import { validateTwoPlayerMove } from "../services/gamePlayApi";
import "./GameBoard.css";

export default function GameBoard() {
  const cells = useBoardStore((state) => state.cells);
  const size = useBoardStore((state) => state.size);
  const turnNumber = useBoardStore((state) => state.turnNumber);
  const currentPlayer = useBoardStore((state) => (state.turnNumber % 2 === 1 ? "player1" : "player2"));
  const playTurn = useBoardStore((state) => state.playTurn);
  const setCellOwner = useBoardStore((state) => state.setCellOwner);
  const nextTurn = useBoardStore((state) => state.nextTurn);
  const gameMode = useBoardStore((state) => state.gameMode);
  const difficulty = useBoardStore((state) => state.difficulty);
  const players = useBoardStore((state) => state.players);

  const [selectedId, setSelectedId] = React.useState(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = React.useState(false);
  const [turnError, setTurnError] = React.useState("");
  const [winnerName, setWinnerName] = React.useState("");

  const PLAYER_COLORS = {
    player1: "#e63946",
    player2: "#1d4ed8",
    selected: "#2ecc71",
    empty: "#ccc",
  };

  function handleCellClick(id) {
    setSelectedId(id);
  }

  async function handleNextTurn() {
    if (!selectedId) return;

    setTurnError("");

    if (gameMode !== "1vs1") {
      const moved = playTurn(selectedId);
      if (moved) {
        setSelectedId(null);
      }
      return;
    }

    const selectedCell = parseCellId(selectedId);
    if (!selectedCell) {
      setTurnError("Celda seleccionada inválida.");
      return;
    }

    const board = boardToYen({ size, turnNumber, cells });
    setIsSubmittingTurn(true);

    try {
      const result = await validateTwoPlayerMove({ board, selectedCell });

      if (!result.isValidMove) {
        setTurnError(result.message || "Movimiento inválido. El turno no cambia.");
        return;
      }

      const moved = setCellOwner(selectedId, currentPlayer);
      if (!moved) {
        setTurnError("No se pudo confirmar el movimiento.");
        return;
      }

      setSelectedId(null);

      if (result.hasWon) {
        setWinnerName(currentPlayer === "player1" ? players.player1Name : players.player2Name);
        return;
      }

      nextTurn();
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : "Error de comunicación con el servidor.");
    } finally {
      setIsSubmittingTurn(false);
    }
  }

  return (
    <div>
      {winnerName ? <VictoryMenu playerName={winnerName} /> : null}

      {gameMode === "1vsbot" && difficulty ? (
        <p className="dificultad">Dificultad: {difficulty}</p>
      ) : null}

      <Header
        currentPlayer={currentPlayer}
        turnNumber={turnNumber}
        playerColors={PLAYER_COLORS}
        playerOneName={players.player1Name}
        playerTwoName={players.player2Name}
      />

      <KonvaRenderer
        cells={cells}
        onCellClick={handleCellClick}
        selectedId={selectedId}
        playerColors={PLAYER_COLORS}
      />

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button disabled={!selectedId || isSubmittingTurn || Boolean(winnerName)} onClick={handleNextTurn}>
          {isSubmittingTurn ? "Validando..." : "Pasar turno"}
        </button>
        {turnError ? <p className="turnError">{turnError}</p> : null}
      </div>
    </div>
  );
}
