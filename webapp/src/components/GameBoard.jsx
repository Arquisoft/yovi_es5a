import React from "react";
import KonvaRenderer from "../renderers/KonvaRenderer";
import Header from "../header/Header";
import { useBoardStore } from "../store/boardStore";
import VictoryMenu from "./VictoryMenu";
import { boardToYen, parseCellId, yenToBoardState } from "../parsers/yenParser";
import { validateBotMove, validateTwoPlayerMove } from "../services/gamePlayApi";
import "./GameBoard.css";

export default function GameBoard() {
  const cells = useBoardStore((state) => state.cells);
  const size = useBoardStore((state) => state.size);
  const turnNumber = useBoardStore((state) => state.turnNumber);
  const currentPlayer = useBoardStore((state) => (state.turnNumber % 2 === 1 ? "player1" : "player2"));
  const playTurn = useBoardStore((state) => state.playTurn);
  const setCellOwner = useBoardStore((state) => state.setCellOwner);
  const nextTurn = useBoardStore((state) => state.nextTurn);
  const applyBoardSnapshot = useBoardStore((state) => state.applyBoardSnapshot);
  const gameMode = useBoardStore((state) => state.gameMode);
  const difficulty = useBoardStore((state) => state.difficulty);
  const players = useBoardStore((state) => state.players);
  const elapsedSeconds = useBoardStore((state) => state.elapsedSeconds);

  const [selectedId, setSelectedId] = React.useState(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = React.useState(false);
  const [turnError, setTurnError] = React.useState("");
  const [gameOver, setGameOver] = React.useState(null);

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

    if (gameMode === "1vs1") {
      //Modo 2 jugadores
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
          const winnerName = currentPlayer === "player1" ? players.player1Name : players.player2Name;
          const loserName = currentPlayer === "player1" ? players.player2Name : players.player1Name;

          setGameOver({
            title: "¡Victoria!",
            message: `${winnerName} ha ganado la partida.`,
            subtitle: "Enhorabuena por esta partida.",
            matchSummary: {
              mode: "1vs1",
              elapsedSeconds,
              turnNumber,
              boardSize: size,
              winnerName,
              loserName,
            },
          });
          return;
        }

        nextTurn();
      } catch (error) {
        setTurnError(error instanceof Error ? error.message : "Error de comunicación con el servidor.");
      } finally {
        setIsSubmittingTurn(false);
      }

      return;
    }

    //Por si queremos añadir otro modo para probar simplemente el front como estaba
    if (gameMode !== "1vsbot") {
      const moved = playTurn(selectedId);
      if (moved) {
        setSelectedId(null);
      }
      return;
    }

    // Modo 1vsBot
    const selectedCell = parseCellId(selectedId);
    if (!selectedCell) {
      setTurnError("Celda seleccionada inválida.");
      return;
    }

    const board = boardToYen({ size, turnNumber, cells });
    setIsSubmittingTurn(true);

    try {
      const result = await validateBotMove({ board, selectedCell, difficulty });

      if (!result.isValidMove) {
        setTurnError(result.message || "Movimiento inválido. El turno no cambia.");
        return;
      }

      const parsedBoard = yenToBoardState(result.board);
      if (!parsedBoard) {
        setTurnError("No se pudo interpretar el tablero devuelto por el servidor.");
        return;
      }

      applyBoardSnapshot(parsedBoard);
      setSelectedId(null);

      if (result.hasPlayerWon) {
        setGameOver({
          title: "¡Victoria!",
          message: `${players.player1Name} ha ganado la partida.`,
          subtitle: "Enhorabuena por esta partida.",
          matchSummary: {
            mode: "1vsbot",
            elapsedSeconds,
            turnNumber,
            boardSize: size,
            playerName: players.player1Name,
            difficulty: difficulty || "Facil",
            winner: "player",
          },
        });
        return;
      }

      if (result.hasBotWon) {
        setGameOver({
          title: "¡Derrota!",
          message: `${players.player1Name} ha perdido la partida.`,
          subtitle: "El bot se ha llevado esta ronda.",
          matchSummary: {
            mode: "1vsbot",
            elapsedSeconds,
            turnNumber,
            boardSize: size,
            playerName: players.player1Name,
            difficulty: difficulty || "Facil",
            winner: "bot",
          },
        });
      }
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : "Error de comunicación con el servidor.");
    } finally {
      setIsSubmittingTurn(false);
    }
  }

if (!cells?.length) return <div>Cargando tablero...</div>;

  return (
    <div>
      {gameOver ? (
        <VictoryMenu
          title={gameOver.title}
          message={gameOver.message}
          subtitle={gameOver.subtitle}
          matchSummary={gameOver.matchSummary}
        />
      ) : null}

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
        <button disabled={!selectedId || isSubmittingTurn || Boolean(gameOver)} onClick={handleNextTurn}>
          {isSubmittingTurn ? "Validando..." : "Pasar turno"}
        </button>
        {turnError ? <p className="turnError">{turnError}</p> : null}
      </div>
    </div>
  );
}
