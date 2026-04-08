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

  // ────────────────────────────────────────────────────────────────────────────
  // validateTwoPlayerMove
  // ────────────────────────────────────────────────────────────────────────────

  describe("validateTwoPlayerMove", () => {
    const board = { size: 8, turn: "R" };
    const selectedCell = { q: 0, r: 0 };

    it("hace POST a /game/play/ con board y selectedCell", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          isValidMove: true,
          hasWon: false,
          message: "OK",
        }),
      });

      const result = await validateTwoPlayerMove({ board, selectedCell });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = global.fetch.mock.calls[0];

      expect(url).toContain("http://localhost:4000/game/play/");
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

    it("convierte isValidMove y hasWon a boolean", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          isValidMove: 1,
          hasWon: 0,
          message: "OK",
        }),
      });

      const result = await validateTwoPlayerMove({ board, selectedCell });

      expect(result).toEqual({
        isValidMove: true,
        hasWon: false,
        message: "OK",
      });
    });

    it("devuelve message undefined si el backend no lo manda", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          isValidMove: true,
          hasWon: false,
        }),
      });

      const result = await validateTwoPlayerMove({ board, selectedCell });

      expect(result).toEqual({
        isValidMove: true,
        hasWon: false,
        message: undefined,
      });
    });

    it("lanza Error si response.ok es false con mensaje del backend", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: "Error backend" }),
      });

      await expect(
        validateTwoPlayerMove({ board, selectedCell })
      ).rejects.toThrow("Error backend");
    });

    it("lanza mensaje genérico si response.ok es false y no hay message", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(
        validateTwoPlayerMove({ board, selectedCell })
      ).rejects.toThrow("No se pudo validar el movimiento en el servidor.");
    });

    it("lanza mensaje genérico si response.json() falla y response.ok es false", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error("invalid json")),
      });

      await expect(
        validateTwoPlayerMove({ board, selectedCell })
      ).rejects.toThrow("No se pudo validar el movimiento en el servidor.");
    });

    it("si response.json() falla pero ok=true, devuelve false/false/undefined", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("invalid json")),
      });

      const result = await validateTwoPlayerMove({ board, selectedCell });

      expect(result).toEqual({
        isValidMove: false,
        hasWon: false,
        message: undefined,
      });
    });

    it("propaga el error si fetch falla", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));

      await expect(
        validateTwoPlayerMove({ board, selectedCell })
      ).rejects.toThrow("Network error");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // requestBotMove
  // ────────────────────────────────────────────────────────────────────────────

  describe("requestBotMove", () => {
    const board = { size: 8, turn: "R", players: ["R", "B"], layout: "mock" };

    it("hace POST al servidor de bots y devuelve coords", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      const result = await requestBotMove({ board, difficulty: "Facil" });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = global.fetch.mock.calls[0];

      expect(url).toContain(":4001/v1/choose/random_bot");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body).toEqual(board);

      expect(result).toEqual({
        botId: "random_bot",
        coords: { x: 1, y: 0, z: -1 },
        apiVersion: "1.0.0",
        hasWon: false,
      });
    });

    it("usa random_bot para dificultad Facil", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      await requestBotMove({ board, difficulty: "Facil" });

      expect(global.fetch.mock.calls[0][0]).toContain("/choose/random_bot");
    });

    it("usa medium_bot para dificultad Media", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "medium_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      await requestBotMove({ board, difficulty: "Media" });

      expect(global.fetch.mock.calls[0][0]).toContain("/choose/medium_bot");
    });

    it("usa hard_bot para dificultad Dificil", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "hard_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      await requestBotMove({ board, difficulty: "Dificil" });

      expect(global.fetch.mock.calls[0][0]).toContain("/choose/hard_bot");
    });

    it("usa random_bot si la dificultad no es reconocida", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      await requestBotMove({ board, difficulty: "Legendaria" });

      expect(global.fetch.mock.calls[0][0]).toContain("/choose/random_bot");
    });

    it("usa random_bot por defecto si no se pasa dificultad", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      await requestBotMove({ board });

      expect(global.fetch.mock.calls[0][0]).toContain("/choose/random_bot");
    });

    it("usa botId calculado si bot_id no viene en la respuesta", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      const result = await requestBotMove({ board, difficulty: "Media" });

      expect(result).toEqual({
        botId: "medium_bot",
        coords: { x: 1, y: 0, z: -1 },
        apiVersion: "1.0.0",
        hasWon: false,
      });
    });

    it("usa apiVersion null si api_version no viene en la respuesta", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          coords: { x: 1, y: 0, z: -1 },
        }),
      });

      const result = await requestBotMove({ board, difficulty: "Facil" });

      expect(result).toEqual({
        botId: "random_bot",
        coords: { x: 1, y: 0, z: -1 },
        apiVersion: null,
        hasWon: false,
      });
    });

    it("convierte hasWon a boolean", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
          coords: { x: 1, y: 0, z: -1 },
          hasWon: 1,
        }),
      });

      const result = await requestBotMove({ board, difficulty: "Facil" });

      expect(result.hasWon).toBe(true);
    });

    it("lanza Error si response.ok es false con mensaje backend", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: "Error backend" }),
      });

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("Error backend");
    });

    it("lanza mensaje genérico si response.ok es false y no hay message", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("No se pudo obtener el movimiento del bot.");
    });

    it("lanza mensaje genérico si response.json() falla y response.ok es false", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error("invalid json")),
      });

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("No se pudo obtener el movimiento del bot.");
    });

    it("lanza Error si ok=true pero no hay coords", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
        }),
      });

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("La respuesta del bot no incluye coordenadas.");
    });

    it("lanza Error si ok=true pero coords es null", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bot_id: "random_bot",
          api_version: "1.0.0",
          coords: null,
        }),
      });

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("La respuesta del bot no incluye coordenadas.");
    });

    it("si response.json() falla con ok=true, lanza error de coordenadas faltantes", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("invalid json")),
      });

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("La respuesta del bot no incluye coordenadas.");
    });

    it("propaga el error si fetch falla", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));

      await expect(
        requestBotMove({ board, difficulty: "Facil" })
      ).rejects.toThrow("Network error");
    });
  });
});
