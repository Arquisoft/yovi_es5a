import React from "react";
import KonvaRenderer from "../renderers/KonvaRenderer";
import Header from "../header/Header";
import { useBoardStore } from "../store/boardStore";
import VictoryMenu from "./VictoryMenu";
import { boardToYen, parseCellId, yenToBoardState, barycentricToCell } from "../parsers/yenParser";
import { requestBotMove, validateTwoPlayerMove } from "../services/gamePlayApi";
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

  // Referencia estable — no se recrea en cada render
  const PLAYER_COLORS = React.useMemo(() => ({
    player1: "#e63946",
    player2: "#1d4ed8",
    selected: "#2ecc71",
    empty: "#ccc",
  }), []);

  const handleCellClick = React.useCallback(async (id) => {
    if (isSubmittingTurn || gameOver) return;

    setSelectedId(id);
    setTurnError("");

    // ── Modo 1vs1 ────────────────────────────────────────────────────────────
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

    // ── Modo sin configurar ───────────────────────────────────────────────────
    if (gameMode !== "1vsbot") {
      const moved = playTurn(id);
      if (moved) setSelectedId(null);
      return;
    }

    // ── Modo 1vsBot ───────────────────────────────────────────────────────────
    const selectedCell = parseCellId(id);
    if (!selectedCell) {
      setTurnError("Celda seleccionada inválida.");
      return;
    }

    setIsSubmittingTurn(true);

    try {
      // 1. Validar movimiento del jugador con el mismo endpoint que 1vs1
      const boardBeforeMove = boardToYen({ size, turnNumber, cells });
      const result = await validateTwoPlayerMove({ board: boardBeforeMove, selectedCell });

      if (!result.isValidMove) {
        setTurnError(result.message || "Movimiento inválido.");
        setSelectedId(null);
        return;
      }

      // 2. Aplicar movimiento del jugador en el tablero local
      const playerMoved = setCellOwner(id, "player1");
      if (!playerMoved) {
        setTurnError("No se pudo confirmar el movimiento del jugador.");
        setSelectedId(null);
        return;
      }

      setSelectedId(null);

      // 3. Comprobar victoria del jugador ANTES de llamar al bot
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
            winnerName: players.player1Name,
            loserName: players.player2Name,
          },
        });
        return;
      }

      // 4. Pedir movimiento al bot solo si el jugador no ha ganado
      const boardAfterPlayerMove = boardToYen({
        size,
        turnNumber: 2,
        cells: useBoardStore.getState().cells,
      });

      const botResult = await requestBotMove({
        board: boardAfterPlayerMove,
        botId: "random_bot",
      });

      const botCoords = botResult.coords;
      if (
        !botCoords ||
        typeof botCoords.x !== "number" ||
        typeof botCoords.y !== "number"
      ) {
        setTurnError("El servidor no devolvió una jugada válida del bot.");
        return;
      }

      // 5. Convertir {x,y,z} → "q,r" y aplicar en tablero
      const botCell = barycentricToCell(botCoords, size);
      const botCellId = `${botCell.q},${botCell.r}`;

      const botMoved = setCellOwner(botCellId, "player2");
      if (!botMoved) {
        setTurnError("No se pudo aplicar el movimiento del bot en el tablero.");
        return;
      }

      nextTurn();
      nextTurn();
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : "Error de comunicación con el servidor.");
    } finally {
      setIsSubmittingTurn(false);
    }
  }, [isSubmittingTurn, gameOver, gameMode, size, turnNumber, cells, players, elapsedSeconds, setCellOwner, nextTurn, playTurn, currentPlayer]);

  if (!cells?.length) return <div>Cargando tablero...</div>;

  if (gameOver) {
    return (
      <VictoryMenu
        title={gameOver.title}
        message={gameOver.message}
        subtitle={gameOver.subtitle}
        matchSummary={gameOver.matchSummary}
      />
    );
  }

  return (
    <div>
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
        {isSubmittingTurn ? <p>Validando...</p> : null}
        {turnError ? <p className="turnError">{turnError}</p> : null}
      </div>
    </div>
  );
}
