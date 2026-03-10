import { create } from "zustand";

function generateTriangle(size) {
  const cells = [];

  for (let q = 0; q < size; q += 1) {
    // en lugar de r = 0 .. size - q - 1
    // empezamos más abajo y vamos hasta size - 1
    for (let r = size - 1 - q; r < size; r += 1) {
      cells.push({
        q,
        r,
        id: `${q},${r}`,
        state: null,
      });
    }
  }

  return cells;
}

function clampBoardSize(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 8;
  }
  return Math.min(15, Math.max(6, parsed));
}

export const useBoardStore = create((set, get) => ({
  size: 8,
  cells: generateTriangle(8),
  turnNumber: 1,
  elapsedSeconds: 0,

  gameMode: null,
  players: {
    player1Name: "",
    player2Name: "",
    isBotSecondPlayer: false,
  },
  difficulty: null,
  boardSize: 8,
  isConfigured: false,

  initializeBoard: (size = 8) => {
    const safeSize = clampBoardSize(size);
    set({
      size: safeSize,
      cells: generateTriangle(safeSize),
      turnNumber: 1,
      elapsedSeconds: 0,
    });
  },

  setCellOwner: (cellId, player) => {
    let changed = false;

    set((state) => ({
      cells: state.cells.map((cell) => {
        if (cell.id !== cellId) {
          return cell;
        }
        changed = true;
        return { ...cell, state: player };
      }),
    }));

    return changed;
  },

  nextTurn: () => {
    set((state) => ({ turnNumber: state.turnNumber + 1 }));
  },

  setElapsedSeconds: (seconds) => {
    const parsedSeconds = Number(seconds);
    set({
      elapsedSeconds: Number.isNaN(parsedSeconds) ? 0 : Math.max(0, Math.floor(parsedSeconds)),
    });
  },

  incrementElapsedSeconds: () => {
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  resetElapsedSeconds: () => {
    set({ elapsedSeconds: 0 });
  },

  applyBoardSnapshot: ({ statesById, turnNumber }) => {
    set((state) => ({
      cells: state.cells.map((cell) => ({
        ...cell,
        state: Object.prototype.hasOwnProperty.call(statesById, cell.id) ? statesById[cell.id] : null,
      })),
      turnNumber: typeof turnNumber === "number" ? turnNumber : state.turnNumber,
    }));
  },

  playTurn: (cellId) => {
    const state = get();
    const currentPlayer = state.turnNumber % 2 === 1 ? "player1" : "player2";
    const changed = state.setCellOwner(cellId, currentPlayer);

    if (!changed) {
      return false;
    }

    state.nextTurn();
    return true;
  },

  setGameConfig: ({ gameMode, player1Name, player2Name, difficulty, boardSize }) => {
    const mode = gameMode === "1vsbot" ? "1vsbot" : "1vs1";
    const safeBoardSize = clampBoardSize(boardSize);

    set({
      gameMode: mode,
      players: {
        player1Name: player1Name?.trim() || "Jugador 1",
        player2Name: mode === "1vsbot" ? "Bot" : player2Name?.trim() || "Jugador 2",
        isBotSecondPlayer: mode === "1vsbot",
      },
      difficulty: mode === "1vsbot" ? difficulty || "Facil" : null,
      boardSize: safeBoardSize,
    });
  },

  startGameFromConfig: () => {
    const { boardSize, initializeBoard } = get();
    initializeBoard(boardSize);
    set({ isConfigured: true });
  },

  resetGameConfig: () => {
    set({
      gameMode: null,
      players: {
        player1Name: "",
        player2Name: "",
        isBotSecondPlayer: false,
      },
      difficulty: null,
      boardSize: 8,
      isConfigured: false,
      elapsedSeconds: 0,
    });
  },
}));
