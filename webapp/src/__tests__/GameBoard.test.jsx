import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import GameBoard from "../components/GameBoard";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../store/boardStore", () => ({ useBoardStore: vi.fn() }));

vi.mock("../renderers/KonvaRenderer", () => ({
  default: ({ onCellClick }) => (
    <div data-testid="konva-renderer">
      <button onClick={() => onCellClick("0,0")}>Select valid cell</button>
      <button onClick={() => onCellClick("bad-id")}>Select invalid cell</button>
    </div>
  ),
}));

vi.mock("../header/Header", () => ({
  default: ({ currentPlayer, turnNumber, playerOneName, playerTwoName }) => (
    <div data-testid="header">
      <span data-testid="current-player">{currentPlayer}</span>
      <span data-testid="turn-number">{turnNumber}</span>
      <span data-testid="player1-name">{playerOneName}</span>
      <span data-testid="player2-name">{playerTwoName}</span>
    </div>
  ),
}));

// VictoryMenu mock con role="dialog" para coincidir con el componente real
vi.mock("../components/VictoryMenu", () => ({
  default: ({ title, message, subtitle }) => (
    <div role="dialog" aria-modal="true">
      <h2>{title}</h2>
      <p>{message}</p>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock("../parsers/yenParser", () => ({
  parseCellId: vi.fn(),
  boardToYen: vi.fn(),
  yenToBoardState: vi.fn(),
  barycentricToCell: vi.fn(),
}));

vi.mock("../services/gamePlayApi", () => ({
  validateTwoPlayerMove: vi.fn(),
  requestBotMove: vi.fn(),
}));

// ── Imports post-mock ──────────────────────────────────────────────────────────

import { useBoardStore } from "../store/boardStore";
import { parseCellId, boardToYen, barycentricToCell } from "../parsers/yenParser";
import { validateTwoPlayerMove, requestBotMove } from "../services/gamePlayApi";

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderGameBoard() {
  return render(
    <MemoryRouter>
      <GameBoard />
    </MemoryRouter>
  );
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("GameBoard", () => {
  const actions = {
    playTurn: vi.fn(),
    setCellOwner: vi.fn(),
    nextTurn: vi.fn(),
    applyBoardSnapshot: vi.fn(),
    resetGameConfig: vi.fn(),
  };

  const BASE_STATE = {
    cells: [{ id: "0,0", q: 0, r: 0, state: null }],
    size: 8,
    turnNumber: 1,
    gameMode: "1vs1",
    difficulty: "Facil",
    players: { player1Name: "A", player2Name: "B", isBotSecondPlayer: false },
    elapsedSeconds: 0,
    ...actions,
  };

  function setMockStore(overrides = {}) {
    const state = { ...BASE_STATE, ...overrides };
    useBoardStore.mockImplementation((selector) => selector(state));
    // getState necesario para la rama 1vsbot (boardAfterPlayerMove)
    useBoardStore.getState = () => state;
    return state;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setMockStore();
    boardToYen.mockReturnValue("YEN_BOARD");
    parseCellId.mockImplementation((id) =>
      id === "0,0" ? { q: 0, r: 0 } : null
    );
  });

  // ── Renderizado básico ──────────────────────────────────────────────────────

  describe("renderizado", () => {
    it("renderiza el Header cuando hay celdas disponibles", () => {
      renderGameBoard();
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    it("pasa los nombres de los jugadores al Header", () => {
      setMockStore({
        players: { player1Name: "Jugador1", player2Name: "Jugador2" },
      });
      renderGameBoard();
      expect(screen.getByTestId("player1-name")).toHaveTextContent("Jugador1");
      expect(screen.getByTestId("player2-name")).toHaveTextContent("Jugador2");
    });

    it("pasa el turnNumber correcto al Header", () => {
      setMockStore({ turnNumber: 5 });
      renderGameBoard();
      expect(screen.getByTestId("turn-number")).toHaveTextContent("5");
    });

    it("pasa currentPlayer='player1' cuando turnNumber es impar", () => {
      setMockStore({ turnNumber: 1 });
      renderGameBoard();
      expect(screen.getByTestId("current-player")).toHaveTextContent("player1");
    });

    it("pasa currentPlayer='player2' cuando turnNumber es par", () => {
      setMockStore({ turnNumber: 2 });
      renderGameBoard();
      expect(screen.getByTestId("current-player")).toHaveTextContent("player2");
    });

    it("muestra el mensaje de carga si cells está vacío", () => {
      setMockStore({ cells: [] });
      renderGameBoard();
      expect(screen.getByText(/cargando tablero/i)).toBeInTheDocument();
    });

    it("muestra el mensaje de carga si cells es null/undefined", () => {
      setMockStore({ cells: null });
      renderGameBoard();
      expect(screen.getByText(/cargando tablero/i)).toBeInTheDocument();
    });

    it("muestra la dificultad solo en modo 1vsbot", () => {
      setMockStore({ gameMode: "1vsbot", difficulty: "Difícil" });
      renderGameBoard();
      expect(screen.getByText(/dificultad: difícil/i)).toBeInTheDocument();
    });

    it("no muestra la dificultad en modo 1vs1", () => {
      setMockStore({ gameMode: "1vs1", difficulty: "Media" });
      renderGameBoard();
      expect(screen.queryByText(/dificultad/i)).toBeNull();
    });

    it("no muestra la dificultad si difficulty es null en modo 1vsbot", () => {
      setMockStore({ gameMode: "1vsbot", difficulty: null });
      renderGameBoard();
      expect(screen.queryByText(/dificultad/i)).toBeNull();
    });

    it("muestra el botón de sugerencia en modo 1vsbot", () => {
      setMockStore({ gameMode: "1vsbot" });
      renderGameBoard();
      expect(screen.getByRole("button", { name: /sugerir movimiento/i })).toBeInTheDocument();
    });

    it("muestra el botón de sugerencia en modo 1vs1", () => {
      setMockStore({ gameMode: "1vs1" });
      renderGameBoard();
      expect(screen.getByRole("button", { name: /sugerir movimiento/i })).toBeInTheDocument();
    });

    it("no muestra el botón de sugerencia si gameMode es null", () => {
      setMockStore({ gameMode: null });
      renderGameBoard();
      expect(screen.queryByRole("button", { name: /sugerir movimiento/i })).not.toBeInTheDocument();
    });

    it("no muestra VictoryMenu en el estado inicial", () => {
      renderGameBoard();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ── Celda inválida ────────────────────────────────────────────────────────

  describe("clic en celda inválida", () => {
    it("1vs1: muestra error y no llama a la API", async () => {
      const user = userEvent.setup();
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select invalid cell/i }));

      expect(await screen.findByText(/celda no válida/i)).toBeInTheDocument();
      expect(validateTwoPlayerMove).not.toHaveBeenCalled();
    });

    it("1vsbot: muestra error y no llama a la API", async () => {
      const user = userEvent.setup();
      setMockStore({ gameMode: "1vsbot" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select invalid cell/i }));

      expect(await screen.findByText(/celda no válida/i)).toBeInTheDocument();
      expect(validateTwoPlayerMove).not.toHaveBeenCalled();
    });

    it("el error de celda inválida desaparece tras un clic válido exitoso", async () => {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: false, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select invalid cell/i }));
      expect(await screen.findByText(/celda no válida/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));
      await waitFor(() =>
        expect(screen.queryByText(/celda no válida/i)).toBeNull()
      );
    });
  });

  // ── Modo sin configurar ───────────────────────────────────────────────────

  describe("gameMode no configurado", () => {
    it("usa playTurn al hacer clic en una celda válida", async () => {
      const user = userEvent.setup();
      actions.playTurn.mockReturnValue(true);
      setMockStore({ gameMode: null });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(actions.playTurn).toHaveBeenCalledWith("0,0");
      expect(validateTwoPlayerMove).not.toHaveBeenCalled();
    });

    it("no llama a nextTurn ni limpia selección si playTurn devuelve false", async () => {
      const user = userEvent.setup();
      actions.playTurn.mockReturnValue(false);
      setMockStore({ gameMode: null });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(actions.nextTurn).not.toHaveBeenCalled();
    });

    it("tampoco llama a parseCellId en modo no configurado", async () => {
      const user = userEvent.setup();
      actions.playTurn.mockReturnValue(true);
      setMockStore({ gameMode: null });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(parseCellId).not.toHaveBeenCalled();
    });
  });

  // ── Modo 1vs1 ─────────────────────────────────────────────────────────────

  describe("modo 1vs1", () => {
    it("movimiento válido llama setCellOwner con la celda y player correcto", async () => {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: false, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await waitFor(() => expect(validateTwoPlayerMove).toHaveBeenCalledTimes(1));
      expect(actions.setCellOwner).toHaveBeenCalledWith("0,0", "player1");
    });

    it("movimiento válido llama nextTurn exactamente una vez", async () => {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: false, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await waitFor(() => expect(actions.nextTurn).toHaveBeenCalledTimes(1));
    });

    it("pasa el board serializado y la celda correcta a validateTwoPlayerMove", async () => {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: false, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await waitFor(() =>
        expect(validateTwoPlayerMove).toHaveBeenCalledWith({
          board: "YEN_BOARD",
          selectedCell: { q: 0, r: 0 },
        })
      );
    });

    it("backend rechaza el movimiento: muestra mensaje del backend", async () => {
      const user = userEvent.setup();
      validateTwoPlayerMove.mockResolvedValue({
        isValidMove: false,
        hasWon: false,
        message: "Movimiento inválido",
      });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(await screen.findByText(/movimiento inválido/i)).toBeInTheDocument();
      expect(actions.nextTurn).not.toHaveBeenCalled();
    });

    it("backend rechaza sin message: muestra texto de fallback", async () => {
      const user = userEvent.setup();
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: false, hasWon: false, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await screen.findByText(/movimiento inválido: el turno no cambia/i);
    });

    it("setCellOwner devuelve false: muestra error y no llama a nextTurn", async () => {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(false);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: false, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(
        await screen.findByText(/no se pudo confirmar el movimiento/i)
      ).toBeInTheDocument();
      expect(actions.nextTurn).not.toHaveBeenCalled();
    });

    it("error de red con instancia Error: muestra su message", async () => {
      const user = userEvent.setup();
      validateTwoPlayerMove.mockRejectedValue(new Error("Timeout de red"));
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(await screen.findByText(/timeout de red/i)).toBeInTheDocument();
    });

    it("error de red no-Error: muestra mensaje genérico", async () => {
      const user = userEvent.setup();
      validateTwoPlayerMove.mockRejectedValue("fallo inesperado");
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(
        await screen.findByText(/error de comunicación con el servidor/i)
      ).toBeInTheDocument();
    });

    it("player1 gana (turnNumber impar): muestra VictoryMenu con su nombre", async () => {
      const user = userEvent.setup();
      setMockStore({
        turnNumber: 1,
        players: { player1Name: "Ana", player2Name: "Bob" },
      });
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: true, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/ganador:/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/ana/i)).toBeInTheDocument();
    });

    it("player2 gana (turnNumber par): muestra su nombre en VictoryMenu", async () => {
      const user = userEvent.setup();
      setMockStore({
        turnNumber: 2,
        players: { player1Name: "Ana", player2Name: "Invitado" },
      });
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: true, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/ganador:/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/invitado/i)).toBeInTheDocument();  
    });

    it("no se puede hacer clic mientras hay una petición en vuelo", async () => {
      const user = userEvent.setup();
      // Promesa que nunca resuelve → isSubmittingTurn queda en true
      validateTwoPlayerMove.mockReturnValue(new Promise(() => {}));
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));
      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(validateTwoPlayerMove).toHaveBeenCalledTimes(1);
    });

    it("victoria: no llama a nextTurn después de ganar", async () => {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: true, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await screen.findByRole("dialog");
      expect(actions.nextTurn).not.toHaveBeenCalled();
    });
  });

  // ── Modo 1vsbot ───────────────────────────────────────────────────────────

  describe("modo 1vsbot", () => {
    beforeEach(() => {
      setMockStore({
        gameMode: "1vsbot",
        difficulty: "Media",
        players: { player1Name: "Pepe", player2Name: "Bot", isBotSecondPlayer: true },
      });
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: false, message: "" });
      requestBotMove.mockResolvedValue({ coords: { x: 1, y: 0, z: 0 } });
      barycentricToCell.mockReturnValue({ q: 0, r: 0 });
      actions.setCellOwner
        .mockReturnValueOnce(true)  // jugador
        .mockReturnValueOnce(true); // bot
    });

    it("aplica movimiento del jugador (player1) y luego del bot (player2)", async () => {
      const user = userEvent.setup();
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await waitFor(() => expect(requestBotMove).toHaveBeenCalledTimes(1));
      expect(actions.setCellOwner).toHaveBeenNthCalledWith(1, "0,0", "player1");
      expect(actions.setCellOwner).toHaveBeenNthCalledWith(2, "0,0", "player2");
    });

    it("llama a nextTurn dos veces (tras jugador y tras bot)", async () => {
      const user = userEvent.setup();
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await waitFor(() => expect(actions.nextTurn).toHaveBeenCalledTimes(2));
    });

    it("pasa la dificultad correcta a requestBotMove", async () => {
      const user = userEvent.setup();
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      await waitFor(() =>
        expect(requestBotMove).toHaveBeenCalledWith(
          expect.objectContaining({ difficulty: "Media" })
        )
      );
    });

    it("el jugador gana: muestra VictoryMenu y no llama a requestBotMove", async () => {
      const user = userEvent.setup();
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: true, message: "" });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/ganador:/i)).toBeInTheDocument();

      expect(within(dialog).getByText(/pepe/i)).toBeInTheDocument();
      expect(requestBotMove).not.toHaveBeenCalled();
    });

    it("el bot gana: muestra VictoryMenu con título Derrota", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({
        coords: { x: 1, y: 0, z: 0 },
        hasWon: true,
      });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/derrota/i)).toBeInTheDocument();
    });

    it("bot devuelve coords null: muestra error descriptivo", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: null });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(
        await screen.findByText(/no hay jugada válida para el bot/i)
      ).toBeInTheDocument();
    });

    it("bot devuelve coords con campos no numéricos: muestra error", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: { x: "no", y: 0, z: 0 } });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(
        await screen.findByText(/no hay jugada válida para el bot/i)
      ).toBeInTheDocument();
    });

    it("bot devuelve coords con campos undefined: muestra error", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: { x: undefined, y: 0, z: 0 } });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(
        await screen.findByText(/no hay jugada válida para el bot/i)
      ).toBeInTheDocument();
    });

    it("setCellOwner del bot devuelve false: muestra error", async () => {
      const user = userEvent.setup();
      actions.setCellOwner
        .mockReset()
        .mockReturnValueOnce(true)   // jugador OK
        .mockReturnValueOnce(false); // bot falla
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

     expect(
      await screen.findByText(/no se pudo aplicar la jugada del bot/i)
    ).toBeInTheDocument();
    });

    it("validateTwoPlayerMove rechaza en 1vsbot: muestra error y no llama bot", async () => {
      const user = userEvent.setup();
      validateTwoPlayerMove.mockResolvedValue({
        isValidMove: false,
        hasWon: false,
        message: "Celda ocupada",
      });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(await screen.findByText(/celda ocupada/i)).toBeInTheDocument();
      expect(requestBotMove).not.toHaveBeenCalled();
    });

    it("error en requestBotMove con Error: muestra su message", async () => {
      const user = userEvent.setup();
      requestBotMove.mockRejectedValue(new Error("Bot offline"));
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(await screen.findByText(/bot offline/i)).toBeInTheDocument();
    });

    it("error en requestBotMove no-Error: muestra mensaje genérico", async () => {
      const user = userEvent.setup();
      requestBotMove.mockRejectedValue("fallo");
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(
        await screen.findByText(/error de comunicación con el servidor/i)
      ).toBeInTheDocument();
    });
  });

  // ── Botón de sugerencia ───────────────────────────────────────────────────

  describe("botón de sugerencia", () => {
    beforeEach(() => {
      setMockStore({ gameMode: "1vs1" });
      barycentricToCell.mockReturnValue({ q: 1, r: 1 });
    });

    it("llama a requestBotMove al hacer clic", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: { x: 1, y: 0, z: 0 } });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /sugerir movimiento/i }));

      await waitFor(() => expect(requestBotMove).toHaveBeenCalledTimes(1));
    });

    it("no muestra error cuando la API tiene éxito", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: { x: 1, y: 0, z: 0 } });
      renderGameBoard();

      await user.click(screen.getByRole("button", { name: /sugerir movimiento/i }));

      await waitFor(() => expect(requestBotMove).toHaveBeenCalled());
      expect(screen.queryByText(/error/i)).toBeNull();
    });

    it("no muestra error cuando la API falla (catch silencioso)", async () => {
      const user = userEvent.setup();
      requestBotMove.mockRejectedValue(new Error("boom"));
      renderGameBoard();

      const btn = screen.getByRole("button", { name: /sugerir movimiento/i });
      await user.click(btn);

      await waitFor(() => expect(btn).not.toBeDisabled());
      expect(screen.queryByText(/error/i)).toBeNull();
    });

    it("botón queda deshabilitado durante la petición de sugerencia", async () => {
      const user = userEvent.setup();
      requestBotMove.mockReturnValue(new Promise(() => {})); // nunca resuelve
      renderGameBoard();

      const btn = screen.getByRole("button", { name: /sugerir movimiento/i });
      await user.click(btn);

      expect(btn).toBeDisabled();
    });

    it("sugerencia con coords nulas no produce error visible", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: null });
      renderGameBoard();

      const btn = screen.getByRole("button", { name: /sugerir movimiento/i });
      await user.click(btn);

      await waitFor(() => expect(btn).not.toBeDisabled());
      expect(screen.queryByText(/error/i)).toBeNull();
    });

    it("sugerencia con coords de campos no numéricos no produce error visible", async () => {
      const user = userEvent.setup();
      requestBotMove.mockResolvedValue({ coords: { x: "a", y: 0, z: 0 } });
      renderGameBoard();

      const btn = screen.getByRole("button", { name: /sugerir movimiento/i });
      await user.click(btn);

      await waitFor(() => expect(btn).not.toBeDisabled());
      expect(screen.queryByText(/error/i)).toBeNull();
    });

    it("no lanza segunda petición si ya hay una en vuelo", async () => {
      const user = userEvent.setup();
      requestBotMove.mockReturnValue(new Promise(() => {}));
      renderGameBoard();

      const btn = screen.getByRole("button", { name: /sugerir movimiento/i });
      await user.click(btn);
      await user.click(btn); // segundo clic mientras está deshabilitado

      expect(requestBotMove).toHaveBeenCalledTimes(1);
    });
  });

  // ── Estado de victoria persistente ───────────────────────────────────────

  describe("bloqueo tras gameOver", () => {
    async function triggerGameOver() {
      const user = userEvent.setup();
      actions.setCellOwner.mockReturnValue(true);
      validateTwoPlayerMove.mockResolvedValue({ isValidMove: true, hasWon: true, message: "" });
      renderGameBoard();
      await user.click(screen.getByRole("button", { name: /select valid cell/i }));
      await screen.findByRole("dialog");
      vi.clearAllMocks(); // limpia contadores para tests posteriores
      return user;
    }

    it("tras gameOver no se pueden hacer más movimientos", async () => {
      const user = await triggerGameOver();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(validateTwoPlayerMove).not.toHaveBeenCalled();
    });

    it("tras gameOver el botón de sugerencia está deshabilitado", async () => {
      await triggerGameOver();
      expect(screen.getByRole("button", { name: /sugerir movimiento/i })).toBeDisabled();
    });

    it("VictoryMenu permanece visible tras intentar otro movimiento", async () => {
      const user = await triggerGameOver();

      await user.click(screen.getByRole("button", { name: /select valid cell/i }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
