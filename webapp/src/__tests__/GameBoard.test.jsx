/* import React from "react";
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
}));

vi.mock("../services/gamePlayApi", () => ({
  validateTwoPlayerMove: vi.fn(),
  validateBotMove: vi.fn(),
}));

import { useBoardStore } from "../store/boardStore";
import { parseCellId, boardToYen, yenToBoardState } from "../parsers/yenParser";
import { validateTwoPlayerMove, validateBotMove } from "../services/gamePlayApi";

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

  it("1vsbot: aplica snapshot cuando la API responde OK", async () => {
    const user = userEvent.setup();

    setMockStore({
      gameMode: "1vsbot",
      difficulty: "Media",
      players: { player1Name: "Pepe", player2Name: "Bot", isBotSecondPlayer: true },
    });

    validateBotMove.mockResolvedValue({
      isValidMove: true,
      hasPlayerWon: false,
      hasBotWon: false,
      board: "NEW_BOARD",
    });

    yenToBoardState.mockReturnValue({
      statesById: { "0,0": "player1" },
      turnNumber: 2,
    });

    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select valid cell/i }));

    await waitFor(() => expect(validateBotMove).toHaveBeenCalledTimes(1));

    expect(actions.applyBoardSnapshot).toHaveBeenCalledTimes(1);
    expect(actions.applyBoardSnapshot).toHaveBeenCalledWith({
      statesById: { "0,0": "player1" },
      turnNumber: 2,
    });
  });

  it("1vsbot: si hasPlayerWon=true muestra VictoryMenu", async () => {
    const user = userEvent.setup();

    setMockStore({
      gameMode: "1vsbot",
      difficulty: "Media",
      players: { player1Name: "Pepe", player2Name: "Bot", isBotSecondPlayer: true },
    });

    validateBotMove.mockResolvedValue({
      isValidMove: true,
      hasPlayerWon: true,
      hasBotWon: false,
      board: "NEW_BOARD",
    });

    yenToBoardState.mockReturnValue({
      statesById: {},
      turnNumber: 2,
    });

    render(<GameBoard />);

    await user.click(screen.getByRole("button", { name: /select valid cell/i }));

    expect(await screen.findByRole("heading", { name: /¡victoria!/i })).toBeInTheDocument();
    expect(screen.getByText(/pepe ha ganado la partida/i)).toBeInTheDocument();
  });
}); */