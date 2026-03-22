import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameBoard from "../components/GameBoard";

vi.mock("../store/boardStore", () => ({ useBoardStore: vi.fn() }));

vi.mock("../renderers/KonvaRenderer", () => ({
  default: ({ onCellClick }) => (
    <div>
      <button onClick={() => onCellClick("0,0")}>Select valid cell</button>
      <button onClick={() => onCellClick("bad-id")}>Select invalid cell</button>
    </div>
  ),
}));

vi.mock("../header/Header", () => ({ default: () => <div>Header</div> }));
vi.mock("../components/VictoryMenu", () => ({
  default: ({ title, message }) => (
    <div>
      <h1>{title}</h1>
      <p>{message}</p>
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

import { useBoardStore } from "../store/boardStore";
import { parseCellId, boardToYen, barycentricToCell } from "../parsers/yenParser";
import { validateTwoPlayerMove, requestBotMove } from "../services/gamePlayApi";

describe("GameBoard", () => {
  const actions = {
    playTurn: vi.fn(),
    setCellOwner: vi.fn(),
    nextTurn: vi.fn(),
    applyBoardSnapshot: vi.fn(),
  };

  function setMockStore(overrides = {}) {
    const state = {
      cells: [{ id: "0,0", q: 0, r: 0, state: null }],
      size: 8,
      turnNumber: 1,
      playTurn: actions.playTurn,
      setCellOwner: actions.setCellOwner,
      nextTurn: actions.nextTurn,
      applyBoardSnapshot: actions.applyBoardSnapshot,
      gameMode: "1vs1",
      difficulty: "Facil",
      players: { player1Name: "A", player2Name: "B", isBotSecondPlayer: false },
      elapsedSeconds: 0,
      ...overrides,
    };

    useBoardStore.mockImplementation((selector) => selector(state));
    useBoardStore.getState = () => state;
    return state;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setMockStore();

    boardToYen.mockReturnValue("YEN_BOARD");

    parseCellId.mockImplementation((id) => {
      if (id === "0,0") return { q: 0, r: 0 };
      return null;
    });
  });


  //    Verifica que el tablero se muestra correctamente al inicio.
  it("renderiza el tablero cuando hay celdas disponibles", () => {
    render(<GameBoard />);
    expect(screen.getByText("Header")).toBeInTheDocument();
  });

 
  it("si la celda seleccionada es inválida (1vs1), muestra error y no llama API", async () => {
    const user = userEvent.setup();
    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select invalid cell/i }));

    expect(await screen.findByText(/celda seleccionada inválida/i)).toBeInTheDocument();
    expect(validateTwoPlayerMove).not.toHaveBeenCalled();
  });


  it("1vs1: movimiento válido llama validateTwoPlayerMove, setCellOwner y nextTurn", async () => {
    const user = userEvent.setup();
    actions.setCellOwner.mockReturnValue(true);

    validateTwoPlayerMove.mockResolvedValue({
      isValidMove: true,
      hasWon: false,
      message: "",
    });

    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select valid cell/i }));

    await waitFor(() => expect(validateTwoPlayerMove).toHaveBeenCalledTimes(1));
    expect(actions.setCellOwner).toHaveBeenCalledWith("0,0", "player1");
    expect(actions.nextTurn).toHaveBeenCalledTimes(1);
  });

  it("1vs1: si backend dice inválido, muestra error y no cambia turno", async () => {
    const user = userEvent.setup();

    validateTwoPlayerMove.mockResolvedValue({
      isValidMove: false,
      hasWon: false,
      message: "Movimiento inválido",
    });

    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select valid cell/i }));

    expect(await screen.findByText(/movimiento inválido/i)).toBeInTheDocument();
    expect(actions.nextTurn).not.toHaveBeenCalled();
  });

  it("1vsbot: aplica movimiento del bot cuando la API responde OK", async () => {
    const user = userEvent.setup();

    setMockStore({
      gameMode: "1vsbot",
      difficulty: "Media",
      players: { player1Name: "Pepe", player2Name: "Bot", isBotSecondPlayer: true },
    });

    validateTwoPlayerMove.mockResolvedValue({
      isValidMove: true,
      hasWon: false,
      message: "",
    });

    requestBotMove.mockResolvedValue({
      coords: { x: 1, y: 0, z: 0 },
    });

    barycentricToCell.mockReturnValue({ q: 0, r: 0 });
    actions.setCellOwner
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);

    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select valid cell/i }));

    await waitFor(() => expect(requestBotMove).toHaveBeenCalledTimes(1));

    expect(actions.setCellOwner).toHaveBeenNthCalledWith(1, "0,0", "player1");
    expect(actions.setCellOwner).toHaveBeenNthCalledWith(2, "0,0", "player2");
    expect(actions.nextTurn).toHaveBeenCalledTimes(2);
  });

  it("1vsbot: si el jugador gana, muestra VictoryMenu", async () => {
    const user = userEvent.setup();

    setMockStore({
      gameMode: "1vsbot",
      difficulty: "Media",
      players: { player1Name: "Pepe", player2Name: "Bot", isBotSecondPlayer: true },
    });

    validateTwoPlayerMove.mockResolvedValue({
      isValidMove: true,
      hasWon: true,
      message: "",
    });

    actions.setCellOwner.mockReturnValue(true);

    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select valid cell/i }));

    expect(await screen.findByRole("heading", { name: /¡victoria!/i })).toBeInTheDocument();
    expect(screen.getByText(/pepe ha ganado la partida/i)).toBeInTheDocument();
  });
});