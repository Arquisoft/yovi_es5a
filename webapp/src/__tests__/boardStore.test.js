/* import { describe, it, expect, beforeEach } from "vitest";
import { useBoardStore } from "../store/boardStore";

// helper: intenta resetear el store usando su estado actual como base
function resetStore() {
  const state = useBoardStore.getState();
  useBoardStore.setState(state, true);
}

describe("boardStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("tiene estado inicial consistente", () => {
    const state = useBoardStore.getState();

    expect(state.size).toBeGreaterThan(0);
    expect(state.cells.length).toBeGreaterThan(0);
    expect(state.turnNumber).toBeGreaterThan(0);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.gameMode).toBeNull();
    expect(state.players).toEqual({
      player1Name: "",
      player2Name: "",
      isBotSecondPlayer: false,
    });
    expect(state.difficulty).toBeNull();
    expect(state.boardSize).toBe(8);
    expect(state.isConfigured).toBe(false);
  });

  it("initializeBoard usa clampBoardSize y genera el triángulo", () => {
    const { initializeBoard } = useBoardStore.getState();

    initializeBoard(6);
    let state = useBoardStore.getState();
    expect(state.size).toBe(6);
    expect(state.cells).toHaveLength((6 * (6 + 1)) / 2); // triángulo 6

    // menor que 6 -> clamp a 6
    initializeBoard(3);
    state = useBoardStore.getState();
    expect(state.size).toBe(6);

    // mayor que 15 -> clamp a 15
    initializeBoard(20);
    state = useBoardStore.getState();
    expect(state.size).toBe(15);
  });

  it("setCellOwner cambia el propietario de una celda y devuelve true cuando cambia", () => {
    const { cells, setCellOwner } = useBoardStore.getState();
    const targetId = cells[0].id;

    const changed = setCellOwner(targetId, "player1");
    const { cells: updatedCells } = useBoardStore.getState();

    expect(changed).toBe(true);
    expect(updatedCells.find((c) => c.id === targetId).state).toBe("player1");
  });
});
 */