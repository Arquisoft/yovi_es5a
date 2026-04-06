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
  // Ahora guarda el cellId "q,r" en lugar de texto display
  const [suggestionId, setSuggestionId] = React.useState(null);

  const PLAYER_COLORS = React.useMemo(
    () => ({
      player1: "#e63946",
      player2: "#1d4ed8",
      selected: "#2ecc71",
      suggestion: "#f5c518",
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

  // Limpia la sugerencia al cambiar de turno
  React.useEffect(() => {
    setSuggestionId(null);
  }, [turnNumber]);

  const handleSuggestion = React.useCallback(async () => {
    if (isFetchingSuggestion || isSubmittingTurn || gameOver) return;
    setSuggestionId(null);
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
        // Sin sugerencia válida — no pintamos ninguna celda
        return;
      }
      const cell = barycentricToCell(botCoords, size);
      // Guardamos el id de la celda para que KonvaRenderer la pinte de amarillo
      setSuggestionId(`${cell.q},${cell.r}`);
    } catch {
      // Error silencioso — no pintamos nada
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
            const winner = currentPlayer === "player1" ? "player" : "guest";
            setGameOver({
              title: "¡Victoria!",
              message: `${winnerName} ha ganado la partida.`,
              subtitle: "Enhorabuena por esta partida.",
              matchSummary: {
                mode: "1vs1",
                elapsedSeconds,
                turnNumber,
                boardSize: size,
                playerName: players.player1Name,
                guestName: players.player2Name,
                winner,
                isDraw: false,
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
              playerName: players.player1Name,
              difficulty,
              isDraw: false,
              winner: players.player2Name,
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

  const showSuggestionPanel = gameMode === "1vsbot" || gameMode === "1vs1";

  return (
    <div className="gameBoard">

      {/* Dificultad — solo en modo bot */}
      {gameMode === "1vsbot" && difficulty ? (
        <p className="dificultad">Dificultad: {difficulty}</p>
      ) : null}

      {/* Header con badges de jugadores */}
      <Header
        currentPlayer={currentPlayer}
        turnNumber={turnNumber}
        playerColors={PLAYER_COLORS}
        playerOneName={players.player1Name}
        playerTwoName={players.player2Name}
      />

      {/* Tablero + botón de sugerencia lateral */}
      <div className="boardWithSidebar">
        <div className="boardWithSidebar__board">
          <KonvaRenderer
            cells={cells}
            size={size}
            selectedId={selectedId}
            suggestionId={suggestionId}
            onCellClick={handleCellClick}
            playerColors={PLAYER_COLORS}
          />
        </div>

        {showSuggestionPanel ? (
          <div className="suggestionPanel">
            <button
              className="suggestionBtn"
              onClick={handleSuggestion}
              disabled={isFetchingSuggestion || isSubmittingTurn || !!gameOver}
            >
              {isFetchingSuggestion ? (
                <span className="suggestionBtn__spinner" />
              ) : (
                <span className="suggestionBtn__icon">💡</span>
              )}
              <span className="suggestionBtn__label">
                {isFetchingSuggestion ? "Buscando..." : "Sugerencia"}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Estado / error — espacio fijo para evitar layout shift */}
      <div className="boardStatusArea">
        <p
          className={`boardStatusText ${
            showValidating || turnError ? "isVisible" : ""
          } ${turnError && !showValidating ? "isError" : ""}`}
        >
          {showValidating ? "Validando..." : turnError || "\u00A0"}
        </p>
      </div>

      {gameOver ? <VictoryMenu {...gameOver} /> : null}
    </div>
    
  ); 
}