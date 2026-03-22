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

  const PLAYER_COLORS = React.useMemo(() => ({
    player1: "#e63946",
    player2: "#1d4ed8",
    selected: "#2ecc71",
    empty: "#ccc",
  }), []);

  // Muestra "Validando..." solo si isSubmittingTurn lleva más de 2 segundos activo
  React.useEffect(() => {
    if (!isSubmittingTurn) {
      setShowValidating(false);
      return;
    }
    const timer = setTimeout(() => setShowValidating(true), 2000);
    return () => clearTimeout(timer);
  }, [isSubmittingTurn]);

  const handleCellClick = React.useCallback(async (id) => {
    if (isSubmittingTurn || gameOver) return;

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
            error instanceof Error
              ? error.message
              : "Error de comunicación con el servidor."
          );
        } finally {
          setIsSubmittingTurn(false);
        }

        return;
      }

      // ── Modo sin configurar ─────────────────────────────────────────────────
      if (gameMode !== "1vsbot") {
        const moved = playTurn(id);
        if (moved) setSelectedId(null);
        return;
      }

      // ── Modo 1vsBot ─────────────────────────────────────────────────────────
      const selectedCell = parseCellId(id);
      if (!selectedCell) {
        setTurnError("Celda seleccionada inválida.");
        return;
      }

      setIsSubmittingTurn(true);

      try {
        const boardBeforeMove = boardToYen({ size, turnNumber, cells });
        const playerResult = await validateTwoPlayerMove({
          board: boardBeforeMove,
          selectedCell,
        });

        if (!playerResult.isValidMove) {
          setTurnError(playerResult.message || "Movimiento inválido.");
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

        if (playerResult.hasWon) {
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
      // 1. Validar movimiento del jugador
      const boardBeforeMove = boardToYen({ size, turnNumber, cells });
      const result = await validateTwoPlayerMove({ board: boardBeforeMove, selectedCell });

        const botResult = await requestBotMove({
          board: boardAfterPlayerMove,
          botId: "random_bot",
        });

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
            playerName: players.player1Name,
            difficulty,
            winner: "player",
            isDraw: false,
          },
        });
        return;
      }

      // 4. Pedir movimiento al bot
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

        nextTurn();
        nextTurn();
      } catch (error) {
        setTurnError(
          error instanceof Error
            ? error.message
            : "Error de comunicación con el servidor."
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
    ]
  );

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

      {/* Zona de mensajes con altura fija — no desplaza el tablero */}
      <div style={{
        position: "relative",
        height: "28px",
        textAlign: "center",
        marginTop: 8,
      }}>
        <div style={{ position: "absolute", width: "100%", left: 0, top: 0 }}>
          {showValidating && !turnError
            ? <p style={{ margin: 0 }}>Validando...</p>
            : null}
          {turnError
            ? <p className="turnError" style={{ margin: 0 }}>{turnError}</p>
            : null}
        </div>
      </div>
    </div>
  );
}
