import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateTwoPlayerMove, requestBotMove } from "../services/gamePlayApi";

describe("gamePlayApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ─── validateTwoPlayerMove ──────────────────────────────────────────────────

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

  it("validateTwoPlayerMove lanza un Error si response.ok es false con mensaje del backend", async () => {
    // validateTwoPlayerMove NO tiene try/catch → el error se propaga
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({ message: "Error backend" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    await expect(
      validateTwoPlayerMove({ board: { size: 8 }, selectedCell: { q: 0, r: 0 } })
    ).rejects.toThrow("Error backend");
  });

  it("validateTwoPlayerMove lanza mensaje genérico si el backend no devuelve message", async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    };

    global.fetch.mockResolvedValue(mockResponse);

    await expect(
      validateTwoPlayerMove({ board: { size: 8 }, selectedCell: { q: 0, r: 0 } })
    ).rejects.toThrow("No se pudo validar el movimiento en el servidor.");
  });

  // ─── requestBotMove ─────────────────────────────────────────────────────────

  it("requestBotMove hace POST al servidor de bots y devuelve coords", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        bot_id: "random_bot",
        api_version: "1.0.0",
        coords: { x: 1, y: 0, z: -1 },
      }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const board = { size: 8, turn: "R", players: ["R", "B"], layout: "mock" };

    const result = await requestBotMove({ board, botId: "random_bot" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    expect(url).toContain(":4001/v1/ybot/choose/random_bot");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body).toEqual(board);

    expect(result).toEqual({
      botId: "random_bot",
      coords: { x: 1, y: 0, z: -1 },
      apiVersion: "1.0.0",
    });
  });

  it("requestBotMove lanza Error si response.ok es false", async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({ message: "Error backend" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    await expect(requestBotMove({ board: { size: 8 }, botId: "random_bot" })).rejects.toThrow(
      "Error backend"
    );
  });

  it("requestBotMove lanza Error si fetch falla", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    await expect(requestBotMove({ board: { size: 8 }, botId: "random_bot" })).rejects.toThrow(
      "Network error"
    );
  });
});
