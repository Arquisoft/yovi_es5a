import React from "react";
import KonvaRenderer from "../renderers/KonvaRenderer";
import Header from "../header/Header";
import { useBoardStore } from "../store/boardStore";
import VictoryMenu from "./VictoryMenu";
import { boardToYen, parseCellId, barycentricToCell } from "../parsers/yenParser";
import { requestBotMove, validateTwoPlayerMove } from "../services/gamePlayApi";
import "./GameBoard.css";

export default function GameBoard() {
  const cells = useBoardStore((state) => state.cells);
  const size = useBoardStore((state) => state.size);
  const turnNumber = useBoardStore((state) => state.turnNumber);
  const currentPlayer = useBoardStore((state) =>
    state.turnNumber % 2 === 1 ? "player1" : "player2"
  );
  const playTurn = useBoardStore((state) => state.playTurn);
  const setCellOwner = useBoardStore((state) => state.setCellOwner);
  const nextTurn = useBoardStore((state) => state.nextTurn);
  const gameMode = useBoardStore((state) => state.gameMode);
  const difficulty = useBoardStore((state) => state.difficulty);
  const players = useBoardStore((state) => state.players);
  const elapsedSeconds = useBoardStore((state) => state.elapsedSeconds);

  const [selectedId, setSelectedId] = React.useState(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = React.useState(false);
  const [showValidating, setShowValidating] = React.useState(false);
  const [turnError, setTurnError] = React.useState("");
  const [gameOver, setGameOver] = React.useState(null);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(null);

  const PLAYER_COLORS = React.useMemo(
    () => ({
      player1: "#e63946",
      player2: "#1d4ed8",
      selected: "#2ecc71",
      empty: "#ccc",
    }),
    []
  );

  React.useEffect(() => {
    if (!isSubmittingTurn) {
      setShowValidating(false);
      return;
    }
    const timer = setTimeout(() => setShowValidating(true), 2000);
    return () => clearTimeout(timer);
  }, [isSubmittingTurn]);

  React.useEffect(() => {
    setSuggestion(null);
  }, [turnNumber]);

  const handleSuggestion = React.useCallback(async () => {
    if (isFetchingSuggestion || isSubmittingTurn || gameOver) return;
    setSuggestion(null);
    setIsFetchingSuggestion(true);
    try {
      const board = boardToYen({ size, turnNumber, cells });
      const botResult = await requestBotMove({ board, difficulty });
      const botCoords = botResult?.coords;
      if (
        !botCoords ||
        typeof botCoords.x !== "number" ||
        typeof botCoords.y !== "number" ||
        typeof botCoords.z !== "number"
      ) {
        setSuggestion("No se pudo obtener sugerencia.");
        return;
      }
      const cell = barycentricToCell(botCoords, size);
      setSuggestion(`Sugerencia: (${cell.q}, ${cell.r})`);
    } catch {
      setSuggestion("Error al pedir sugerencia.");
    } finally {
      setIsFetchingSuggestion(false);
    }
  }, [isFetchingSuggestion, isSubmittingTurn, gameOver, size, turnNumber, cells, difficulty]);

  const handleCellClick = React.useCallback(
    async (id) => {
      if (isSubmittingTurn || gameOver) return;
      setSelectedId(id);
      setTurnError("");

      // ── Modo 1vs1 ────────────────────────────────────────────────────────
      if (gameMode === "1vs1") {
        const selectedCell = parseCellId(id);
        if (!selectedCell) {
          setTurnError("Celda seleccionada inválida.");
          return;
        }
        setIsSubmittingTurn(true);
        try {
          const board = boardToYen({ size, turnNumber, cells });
          const result = await validateTwoPlayerMove({ board, selectedCell });
          if (!result.isValidMove) {
            setTurnError(result.message || "Movimiento inválido. El turno no cambia.");
            setSelectedId(null);
            return;
          }
          const moved = setCellOwner(id, currentPlayer);
          if (!moved) {
            setTurnError("No se pudo confirmar el movimiento.");
            return;
          }
          setSelectedId(null);
          if (result.hasWon) {
            const winnerName =
              currentPlayer === "player1" ? players.player1Name : players.player2Name;
            const loserName =
              currentPlayer === "player1" ? players.player2Name : players.player1Name;
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
          setTurnError(
            error instanceof Error ? error.message : "Error de comunicación con el servidor."
          );
        } finally {
          setIsSubmittingTurn(false);
        }
        return;
      }

      // ── Modo sin configurar ───────────────────────────────────────────────
      if (gameMode !== "1vsbot") {
        const moved = playTurn(id);
        if (moved) setSelectedId(null);
        return;
      }

      // ── Modo 1vsBot ──────────────────────────────────────────────────────
      const selectedCell = parseCellId(id);
      if (!selectedCell) {
        setTurnError("Celda seleccionada inválida.");
        return;
      }
      setIsSubmittingTurn(true);
      try {
        const boardBeforeMove = boardToYen({ size, turnNumber, cells });
        const result = await validateTwoPlayerMove({ board: boardBeforeMove, selectedCell });
        if (!result.isValidMove) {
          setTurnError(result.message || "Movimiento inválido.");
          setSelectedId(null);
          return;
        }
        const playerMoved = setCellOwner(id, "player1");
        if (!playerMoved) {
          setTurnError("No se pudo confirmar el movimiento del jugador.");
          setSelectedId(null);
          return;
        }
        setSelectedId(null);
        if (result.hasWon) {
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
              difficulty,
              winner: "player",
              isDraw: false,
            },
          });
          return;
        }

        // Avanzar al turno del bot → anillo se mueve a player2
        nextTurn();

        const boardAfterPlayerMove = boardToYen({
          size,
          turnNumber: useBoardStore.getState().turnNumber,
          cells: useBoardStore.getState().cells,
        });

        const botResult = await requestBotMove({ board: boardAfterPlayerMove, difficulty });

        const botCoords = botResult?.coords;
        if (
          !botCoords ||
          typeof botCoords.x !== "number" ||
          typeof botCoords.y !== "number" ||
          typeof botCoords.z !== "number"
        ) {
          setTurnError("El servidor no devolvió una jugada válida del bot.");
          return;
        }

        const botCell = barycentricToCell(botCoords, size);
        const botCellId = `${botCell.q},${botCell.r}`;
        const botMoved = setCellOwner(botCellId, "player2");
        if (!botMoved) {
          setTurnError("No se pudo aplicar el movimiento del bot en el tablero.");
          return;
        }

        if (botResult.hasWon) {
          setGameOver({
            title: "Derrota",
            message: `${players.player2Name} ha ganado la partida.`,
            subtitle: "El bot ha encontrado una jugada ganadora.",
            matchSummary: {
              mode: "1vsbot",
              elapsedSeconds,
              turnNumber: turnNumber + 1,
              boardSize: size,
              winnerName: players.player2Name,
              loserName: players.player1Name,
            },
          });
          return;
        }

        // Volver al turno del jugador → anillo vuelve a player1
        nextTurn();
      } catch (error) {
        setTurnError(
          error instanceof Error ? error.message : "Error de comunicación con el servidor."
        );
      } finally {
        setIsSubmittingTurn(false);
      }
    },
    [
      isSubmittingTurn,
      gameOver,
      gameMode,
      size,
      turnNumber,
      cells,
      players,
      elapsedSeconds,
      setCellOwner,
      nextTurn,
      playTurn,
      currentPlayer,
      difficulty,
    ]
  );

  if (!cells?.length) return <p>Cargando tablero...</p>;

  return (
    <div className="gameboard-container">
      {gameOver ? (
        <VictoryMenu
          title={gameOver.title}
          message={gameOver.message}
          subtitle={gameOver.subtitle}
          matchSummary={gameOver.matchSummary}
        />
      ) : (
        <>
          <Header
            currentPlayer={currentPlayer}
            turnNumber={turnNumber}
            playerColors={PLAYER_COLORS}
            playerOneName={players.player1Name}
            playerTwoName={players.player2Name}
          />
          {gameMode === "1vsbot" ? <p>Dificultad: {difficulty}</p> : null}
          <KonvaRenderer
            cells={cells}
            size={size}
            selectedId={selectedId}
            onCellClick={handleCellClick}
            playerColors={PLAYER_COLORS}
          />
          {suggestion ? <p>{suggestion}</p> : null}
          {gameMode === "1vsbot" ? (
            <button onClick={handleSuggestion} disabled={isFetchingSuggestion || isSubmittingTurn}>
              {isFetchingSuggestion ? "Buscando..." : "Sugerencia"}
            </button>
          ) : null}
          {showValidating ? <p>Validando...</p> : null}
          <p>{turnError || ""}</p>
        </>
      )}
    </div>
  );
}