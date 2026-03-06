import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateTwoPlayerMove, validateBotMove } from "../services/gamePlayApi";

describe("gamePlayApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("validateTwoPlayerMove hace POST a /game/play/ con board y selectedCell (1vs1)", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        isValidMove: true,
        hasWon: false,
        message: "OK",
      }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const board = { size: 8, turn: "R" };
    const selectedCell = { q: 0, r: 0 };

    const result = await validateTwoPlayerMove({ board, selectedCell });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    expect(url.endsWith("/game/play/")).toBe(true);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body).toEqual({ board, selectedCell, mode: "1vs1" });

    expect(result).toEqual({
      isValidMove: true,
      hasWon: false,
      message: "OK",
    });
  });

  it("validateTwoPlayerMove lanza error si response.ok es false y lo transforma en resultado Simulado", async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({
        message: "Error backend",
      }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await validateTwoPlayerMove({
      board: { size: 8 },
      selectedCell: { q: 0, r: 0 },
    });

    // Por tu try/catch, en caso de error devuelve Simulado
    expect(result).toEqual({
      isValidMove: true,
      hasWon: true,
      message: "Simulado",
    });
  });

  it("validateBotMove hace POST a /game/play/ con board, selectedCell y difficulty (1vsbot)", async () => {
    const backendBoard = {
      size: 8,
      turn: "B",
      players: ["B", "R"],
      layout: "./../...",
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        isValidMove: true,
        board: backendBoard,
        hasPlayerWon: false,
        hasBotWon: true,
        message: "Bot ganó",
      }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const board = { size: 8, turn: "R" };
    const selectedCell = { q: 1, r: 1 };
    const difficulty = "Media";

    const result = await validateBotMove({ board, selectedCell, difficulty });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    expect(url.endsWith("/game/play/")).toBe(true);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      board,
      selectedCell,
      difficulty,
      mode: "1vsbot",
    });

    expect(result).toEqual({
      isValidMove: true,
      board: backendBoard,
      hasPlayerWon: false,
      hasBotWon: true,
      message: "Bot ganó",
    });
  });

  it("validateBotMove si fetch falla devuelve el tablero Simulado y hasBotWon=true", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    const result = await validateBotMove({
      board: { size: 8 },
      selectedCell: { q: 0, r: 0 },
      difficulty: "Facil",
    });

    expect(result.isValidMove).toBe(true);
    expect(result.hasBotWon).toBe(true);
    expect(result.hasPlayerWon).toBe(false);
    expect(result.message).toBe("Simulado");

    expect(result.board).toEqual({
      size: 8,
      turn: "R",
      players: ["B", "R"],
      layout: "R/B./.../..../...../....../......./........",
    });
  });
});
