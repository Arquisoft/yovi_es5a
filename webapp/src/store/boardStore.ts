import { create } from "zustand";

type Player = "player1" | "player2";

type Cell = {
  q: number;
  r: number;
  id: string;
  state: Player | null;
};

type BoardState = {
  size: number;
  cells: Cell[];
  turnNumber: number;
  initializeBoard: (size?: number) => void;
  setCellOwner: (cellId: string, player: Player) => boolean;
  nextTurn: () => void;
  playTurn: (cellId: string) => boolean;
};

function generateTriangle(size: number): Cell[] {
  const cells: Cell[] = [];
  for (let q = 0; q < size; q += 1) {
    for (let r = 0; r < size - q; r += 1) {
      cells.push({ q, r, id: `${q},${r}`, state: null });
    }
  }
  return cells;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  size: 8,
  cells: generateTriangle(8),
  turnNumber: 1,

  initializeBoard: (size = 8) => {
    set({
      size,
      cells: generateTriangle(size),
      turnNumber: 1,
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

  playTurn: (cellId) => {
    const state = get();
    const currentPlayer: Player = state.turnNumber % 2 === 1 ? "player1" : "player2";
    const changed = state.setCellOwner(cellId, currentPlayer);

    if (!changed) {
      return false;
    }

    state.nextTurn();
    return true;
  },
}));
