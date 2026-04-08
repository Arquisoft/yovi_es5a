import { describe, it, expect, beforeEach } from "vitest";
import { useBoardStore } from "../store/boardStore";

// ── Helper ────────────────────────────────────────────────────────────────────

function resetStore() {
  useBoardStore.setState(useBoardStore.getInitialState(), true);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("boardStore", () => {
  beforeEach(() => {
    resetStore();
  });

  // ── Estado inicial ──────────────────────────────────────────────────────────

  describe("estado inicial", () => {
    it("tiene valores consistentes al arrancar", () => {
      const state = useBoardStore.getState();

      expect(state.size).toBeGreaterThan(0);
      expect(state.cells.length).toBeGreaterThan(0);
      expect(state.turnNumber).toBe(1);
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

    it("el tablero inicial tiene las celdas correctas para size=8", () => {
      const { cells, size } = useBoardStore.getState();
      // Triángulo invertido: suma de 1..size = size*(size+1)/2
      expect(size).toBe(8);
      expect(cells).toHaveLength((8 * (8 + 1)) / 2);
    });

    it("todas las celdas del estado inicial tienen state=null", () => {
      const { cells } = useBoardStore.getState();
      expect(cells.every((c) => c.state === null)).toBe(true);
    });

    it("cada celda tiene id con formato 'q,r'", () => {
      const { cells } = useBoardStore.getState();
      cells.forEach((c) => {
        expect(c.id).toBe(`${c.q},${c.r}`);
      });
    });
  });

  // ── clampBoardSize ──────────────────────────────────────────────────────────
  // Cubierto indirectamente a través de initializeBoard y setGameConfig

  describe("clampBoardSize (vía initializeBoard)", () => {
    it("valor válido: usa el tamaño exacto", () => {
      useBoardStore.getState().initializeBoard(6);
      expect(useBoardStore.getState().size).toBe(6);
    });

    it("valor < 6: hace clamp a 6", () => {
      useBoardStore.getState().initializeBoard(3);
      expect(useBoardStore.getState().size).toBe(6);
    });

    it("valor > 15: hace clamp a 15", () => {
      useBoardStore.getState().initializeBoard(20);
      expect(useBoardStore.getState().size).toBe(15);
    });

    it("NaN: usa el valor por defecto 8", () => {
      // Rama: Number.isNaN(parsed) → return 8
      useBoardStore.getState().initializeBoard(NaN);
      expect(useBoardStore.getState().size).toBe(8);
    });

    it("string no numérico: usa el valor por defecto 8", () => {
      useBoardStore.getState().initializeBoard("abc");
      expect(useBoardStore.getState().size).toBe(8);
    });

    it("string numérico válido: se convierte y clampea correctamente", () => {
      useBoardStore.getState().initializeBoard("10");
      expect(useBoardStore.getState().size).toBe(10);
    });
  });

  // ── initializeBoard ─────────────────────────────────────────────────────────

  describe("initializeBoard", () => {
    it("genera el número correcto de celdas para cada tamaño", () => {
      [6, 8, 10, 15].forEach((n) => {
        useBoardStore.getState().initializeBoard(n);
        const { cells, size } = useBoardStore.getState();
        expect(size).toBe(n);
        expect(cells).toHaveLength((n * (n + 1)) / 2);
      });
    });

    it("resetea turnNumber a 1 al reinicializar", () => {
      useBoardStore.getState().nextTurn();
      useBoardStore.getState().nextTurn();
      expect(useBoardStore.getState().turnNumber).toBe(3);

      useBoardStore.getState().initializeBoard(8);
      expect(useBoardStore.getState().turnNumber).toBe(1);
    });

    it("resetea elapsedSeconds a 0 al reinicializar", () => {
      useBoardStore.getState().setElapsedSeconds(120);
      useBoardStore.getState().initializeBoard(8);
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });

    it("sin argumento usa tamaño 8 por defecto", () => {
      useBoardStore.getState().initializeBoard();
      expect(useBoardStore.getState().size).toBe(8);
    });
  });

  // ── setCellOwner ────────────────────────────────────────────────────────────

  describe("setCellOwner", () => {
    it("ocupa una celda vacía y devuelve true", () => {
      const { cells, setCellOwner } = useBoardStore.getState();
      const id = cells[0].id;

      expect(setCellOwner(id, "player1")).toBe(true);
      expect(useBoardStore.getState().cells.find((c) => c.id === id).state).toBe("player1");
    });

    it("devuelve false si la celda ya está ocupada y no la sobreescribe", () => {
      const { cells, setCellOwner } = useBoardStore.getState();
      const id = cells[0].id;

      setCellOwner(id, "player1");
      expect(setCellOwner(id, "player2")).toBe(false);
      expect(useBoardStore.getState().cells.find((c) => c.id === id).state).toBe("player1");
    });

    it("devuelve false si el id no existe", () => {
      // Rama: !target → return false
      expect(useBoardStore.getState().setCellOwner("99,99", "player1")).toBe(false);
    });

    it("no modifica otras celdas al ocupar una", () => {
      const { cells, setCellOwner } = useBoardStore.getState();
      const id = cells[0].id;
      setCellOwner(id, "player1");

      const others = useBoardStore.getState().cells.filter((c) => c.id !== id);
      expect(others.every((c) => c.state === null)).toBe(true);
    });

    it("puede ocupar cualquier celda del tablero", () => {
      const { cells } = useBoardStore.getState();
      // Probamos la última celda también
      const lastId = cells[cells.length - 1].id;
      expect(useBoardStore.getState().setCellOwner(lastId, "player2")).toBe(true);
    });
  });

  // ── getCellOwner ────────────────────────────────────────────────────────────

  describe("getCellOwner", () => {
    it("devuelve null para una celda vacía", () => {
      const { cells, getCellOwner } = useBoardStore.getState();
      expect(getCellOwner(cells[0].id)).toBeNull();
    });

    it("devuelve el jugador correcto tras ocupar la celda", () => {
      const { cells, setCellOwner, getCellOwner } = useBoardStore.getState();
      const id = cells[0].id;
      setCellOwner(id, "player1");
      expect(getCellOwner(id)).toBe("player1");
    });

    it("devuelve null si el id no existe", () => {
      // Rama: cell?.state ?? null  →  cell undefined → null
      expect(useBoardStore.getState().getCellOwner("99,99")).toBeNull();
    });
  });

  // ── playTurn ────────────────────────────────────────────────────────────────

  describe("playTurn", () => {
    it("ocupa la celda con player1 en turno impar y avanza el turno", () => {
      const { cells, playTurn } = useBoardStore.getState();
      const id = cells[0].id;

      expect(useBoardStore.getState().turnNumber).toBe(1);
      expect(playTurn(id)).toBe(true);

      const state = useBoardStore.getState();
      expect(state.cells.find((c) => c.id === id).state).toBe("player1");
      expect(state.turnNumber).toBe(2);
    });

    it("ocupa la celda con player2 en turno par", () => {
      const { cells } = useBoardStore.getState();
      useBoardStore.getState().playTurn(cells[0].id); // turno 1 → player1
      useBoardStore.getState().playTurn(cells[1].id); // turno 2 → player2

      expect(useBoardStore.getState().cells.find((c) => c.id === cells[1].id).state).toBe("player2");
    });

    it("devuelve false si la celda ya está ocupada y no avanza turno", () => {
      const { cells, playTurn } = useBoardStore.getState();
      const id = cells[0].id;

      playTurn(id); // turno 1
      const turnBefore = useBoardStore.getState().turnNumber;

      expect(playTurn(id)).toBe(false); // celda ocupada
      expect(useBoardStore.getState().turnNumber).toBe(turnBefore);
    });

    it("devuelve false con id inexistente", () => {
      expect(useBoardStore.getState().playTurn("99,99")).toBe(false);
    });
  });

  // ── nextTurn ────────────────────────────────────────────────────────────────

  describe("nextTurn", () => {
    it("incrementa turnNumber en 1", () => {
      useBoardStore.getState().nextTurn();
      expect(useBoardStore.getState().turnNumber).toBe(2);
    });

    it("incrementa acumulativamente", () => {
      useBoardStore.getState().nextTurn();
      useBoardStore.getState().nextTurn();
      useBoardStore.getState().nextTurn();
      expect(useBoardStore.getState().turnNumber).toBe(4);
    });
  });

  // ── setElapsedSeconds ───────────────────────────────────────────────────────

  describe("setElapsedSeconds", () => {
    it("guarda un valor positivo entero", () => {
      useBoardStore.getState().setElapsedSeconds(120);
      expect(useBoardStore.getState().elapsedSeconds).toBe(120);
    });

    it("trunca decimales (Math.floor)", () => {
      // Rama: Math.floor(parsedSeconds)
      useBoardStore.getState().setElapsedSeconds(45.9);
      expect(useBoardStore.getState().elapsedSeconds).toBe(45);
    });

    it("convierte string numérico correctamente", () => {
      useBoardStore.getState().setElapsedSeconds("30");
      expect(useBoardStore.getState().elapsedSeconds).toBe(30);
    });

    it("NaN: guarda 0", () => {
      // Rama: Number.isNaN(parsedSeconds) → 0
      useBoardStore.getState().setElapsedSeconds(NaN);
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });

    it("string no numérico: guarda 0", () => {
      useBoardStore.getState().setElapsedSeconds("abc");
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });

    it("valor negativo: clampea a 0 (Math.max(0, ...))", () => {
      // Rama: Math.max(0, valor_negativo) → 0
      useBoardStore.getState().setElapsedSeconds(-10);
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });

    it("exactamente 0: guarda 0", () => {
      useBoardStore.getState().setElapsedSeconds(100);
      useBoardStore.getState().setElapsedSeconds(0);
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });
  });

  // ── incrementElapsedSeconds / resetElapsedSeconds ───────────────────────────

  describe("incrementElapsedSeconds y resetElapsedSeconds", () => {
    it("incrementa en 1 cada llamada", () => {
      useBoardStore.getState().incrementElapsedSeconds();
      useBoardStore.getState().incrementElapsedSeconds();
      expect(useBoardStore.getState().elapsedSeconds).toBe(2);
    });

    it("resetea a 0", () => {
      useBoardStore.getState().setElapsedSeconds(60);
      useBoardStore.getState().resetElapsedSeconds();
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });
  });

  // ── applyBoardSnapshot ──────────────────────────────────────────────────────

  describe("applyBoardSnapshot", () => {
    it("aplica estados de celda desde statesById", () => {
      const { cells } = useBoardStore.getState();
      const id = cells[0].id;

      useBoardStore.getState().applyBoardSnapshot({
        statesById: { [id]: "player1" },
        turnNumber: 5,
      });

      const state = useBoardStore.getState();
      expect(state.cells.find((c) => c.id === id).state).toBe("player1");
      expect(state.turnNumber).toBe(5);
    });

    it("celdas no presentes en statesById quedan con state=null", () => {
      const { cells } = useBoardStore.getState();
      // Ocupamos todas excepto la última
      const snapshot = {};
      cells.slice(0, -1).forEach((c) => { snapshot[c.id] = "player1"; });

      useBoardStore.getState().applyBoardSnapshot({ statesById: snapshot, turnNumber: 3 });

      const last = useBoardStore.getState().cells[cells.length - 1];
      expect(last.state).toBeNull();
    });

    it("turnNumber no numérico: conserva el turno actual", () => {
      // Rama: typeof turnNumber === "number" → false → state.turnNumber
      useBoardStore.getState().nextTurn(); // turnNumber = 2
      useBoardStore.getState().applyBoardSnapshot({
        statesById: {},
        turnNumber: "bad",
      });
      expect(useBoardStore.getState().turnNumber).toBe(2);
    });

    it("turnNumber undefined: conserva el turno actual", () => {
      useBoardStore.getState().nextTurn();
      useBoardStore.getState().applyBoardSnapshot({ statesById: {} });
      expect(useBoardStore.getState().turnNumber).toBe(2);
    });

    it("statesById vacío: todas las celdas quedan con state=null", () => {
      const { cells } = useBoardStore.getState();
      useBoardStore.getState().setCellOwner(cells[0].id, "player1");

      useBoardStore.getState().applyBoardSnapshot({ statesById: {}, turnNumber: 1 });

      expect(useBoardStore.getState().cells.every((c) => c.state === null)).toBe(true);
    });
  });

  // ── setGameConfig ───────────────────────────────────────────────────────────

  describe("setGameConfig", () => {
    it("modo 1vsbot: configura bot como player2 y aplica dificultad", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vsbot",
        player1Name: "Ana",
        player2Name: "ignorado",
        difficulty: "Difícil",
        boardSize: 10,
      });

      const state = useBoardStore.getState();
      expect(state.gameMode).toBe("1vsbot");
      expect(state.players.player2Name).toBe("Bot");
      expect(state.players.isBotSecondPlayer).toBe(true);
      expect(state.difficulty).toBe("Difícil");
      expect(state.boardSize).toBe(10);
    });

    it("modo 1vs1: guarda player2Name real y difficulty=null", () => {
      // Rama: mode !== "1vsbot" → difficulty null, player2Name del config
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "Ana",
        player2Name: "Bob",
        difficulty: "Media",
        boardSize: 8,
      });

      const state = useBoardStore.getState();
      expect(state.gameMode).toBe("1vs1");
      expect(state.players.player2Name).toBe("Bob");
      expect(state.players.isBotSecondPlayer).toBe(false);
      expect(state.difficulty).toBeNull(); // ignorada en 1vs1
    });

    it("gameMode desconocido: cae en modo 1vs1", () => {
      // Rama: gameMode === "1vsbot" ? "1vsbot" : "1vs1"
      useBoardStore.getState().setGameConfig({
        gameMode: "torneo",
        player1Name: "X",
        player2Name: "Y",
        boardSize: 8,
      });
      expect(useBoardStore.getState().gameMode).toBe("1vs1");
    });

    it("player1Name vacío: usa fallback 'Jugador 1'", () => {
      // Rama: player1Name?.trim() || "Jugador 1"
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "   ",
        player2Name: "Bob",
        boardSize: 8,
      });
      expect(useBoardStore.getState().players.player1Name).toBe("Jugador 1");
    });

    it("player1Name undefined: usa fallback 'Jugador 1'", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player2Name: "Bob",
        boardSize: 8,
      });
      expect(useBoardStore.getState().players.player1Name).toBe("Jugador 1");
    });

    it("player2Name vacío en 1vs1: usa fallback 'Jugador 2'", () => {
      // Rama: player2Name?.trim() || "Jugador 2"
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "Ana",
        player2Name: "   ",
        boardSize: 8,
      });
      expect(useBoardStore.getState().players.player2Name).toBe("Jugador 2");
    });

    it("player2Name undefined en 1vs1: usa fallback 'Jugador 2'", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "Ana",
        boardSize: 8,
      });
      expect(useBoardStore.getState().players.player2Name).toBe("Jugador 2");
    });

    it("1vsbot sin difficulty: usa fallback 'Facil'", () => {
      // Rama: difficulty || "Facil"
      useBoardStore.getState().setGameConfig({
        gameMode: "1vsbot",
        player1Name: "Ana",
        boardSize: 8,
      });
      expect(useBoardStore.getState().difficulty).toBe("Facil");
    });

    it("boardSize inválido en setGameConfig: clampea a 8", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "Ana",
        player2Name: "Bob",
        boardSize: NaN,
      });
      expect(useBoardStore.getState().boardSize).toBe(8);
    });
  });

  // ── startGameFromConfig ─────────────────────────────────────────────────────

  describe("startGameFromConfig", () => {
    it("marca isConfigured=true e inicializa el tablero con boardSize", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "Ana",
        player2Name: "Bob",
        boardSize: 10,
      });
      useBoardStore.getState().startGameFromConfig();

      const state = useBoardStore.getState();
      expect(state.isConfigured).toBe(true);
      expect(state.size).toBe(10);
      expect(state.cells).toHaveLength((10 * 11) / 2);
    });

    it("resetea turnNumber y elapsedSeconds al iniciar", () => {
      useBoardStore.getState().nextTurn();
      useBoardStore.getState().setElapsedSeconds(60);

      useBoardStore.getState().setGameConfig({
        gameMode: "1vs1",
        player1Name: "Ana",
        player2Name: "Bob",
        boardSize: 8,
      });
      useBoardStore.getState().startGameFromConfig();

      expect(useBoardStore.getState().turnNumber).toBe(1);
      expect(useBoardStore.getState().elapsedSeconds).toBe(0);
    });

    it("configura player2Name como 'Bot' en modo 1vsbot", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vsbot",
        player1Name: "Ana",
        difficulty: "Media",
        boardSize: 8,
      });
      useBoardStore.getState().startGameFromConfig();

      expect(useBoardStore.getState().players.player2Name).toBe("Bot");
      expect(useBoardStore.getState().isConfigured).toBe(true);
    });
  });

  // ── resetGameConfig ─────────────────────────────────────────────────────────

  describe("resetGameConfig", () => {
    it("devuelve todos los campos de config a sus valores por defecto", () => {
      useBoardStore.getState().setGameConfig({
        gameMode: "1vsbot",
        player1Name: "Ana",
        difficulty: "Difícil",
        boardSize: 12,
      });
      useBoardStore.getState().startGameFromConfig();
      useBoardStore.getState().resetGameConfig();

      const state = useBoardStore.getState();
      expect(state.gameMode).toBeNull();
      expect(state.players).toEqual({ player1Name: "", player2Name: "", isBotSecondPlayer: false });
      expect(state.difficulty).toBeNull();
      expect(state.boardSize).toBe(8);
      expect(state.isConfigured).toBe(false);
      expect(state.elapsedSeconds).toBe(0);
    });

    it("no modifica las celdas ni el tablero actual al resetear config", () => {
      useBoardStore.getState().initializeBoard(10);
      useBoardStore.getState().resetGameConfig();

      // El tablero en memoria no se toca — size sigue siendo 10
      expect(useBoardStore.getState().size).toBe(10);
    });
  });
});
