import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestMatchScore } from "../services/usersScoreApi";

describe("usersScoreApi - requestMatchScore", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("envía payload correcto para partidas 1vs1 y parsea score", async () => {
    const matchSummary = {
      mode: "1vs1",
      elapsedSeconds: 120,
      turnNumber: 15,
      boardSize: 8,
      winnerName: "Alice",
      loserName: "Bob",
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ score: 350 }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    expect(url.endsWith("/finished-match")).toBe(true);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      elapsedSeconds: 120,
      turnNumber: 15,
      boardSize: 8,
      mode: "1vs1",
      winnerName: "Alice",
      loserName: "Bob",
    });

    expect(result).toEqual({ score: 350 });
  });

  it("envía payload correcto para partidas 1vsbot y parsea score desde points", async () => {
    const matchSummary = {
      mode: "1vsbot",
      elapsedSeconds: 90,
      turnNumber: 10,
      boardSize: 7,
      playerName: "Pepe",
      difficulty: "Media",
      winner: "player",
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ points: "420" }), // string
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body).toEqual({
      elapsedSeconds: 90,
      turnNumber: 10,
      boardSize: 7,
      mode: "1vsbot",
      playerName: "Pepe",
      difficulty: "Media",
      winner: "player",
    });

    expect(result).toEqual({ score: 420 }); // convertido a número
  });

  it("también acepta puntuacion/puntuacion en la respuesta", async () => {
    const matchSummary = {
      mode: "1vs1",
      elapsedSeconds: 30,
      turnNumber: 5,
      boardSize: 6,
      winnerName: "A",
      loserName: "B",
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ puntuacion: "99" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);
    expect(result).toEqual({ score: 99 });
  });

  it("si response.ok es false o score no es numérico, devuelve score 200 (Simulado)", async () => {
    const matchSummary = {
      mode: "1vs1",
      elapsedSeconds: 10,
      turnNumber: 2,
      boardSize: 8,
      winnerName: "A",
      loserName: "B",
    };

    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({ score: "NaN" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);
    expect(result).toEqual({ score: 200 });
  });

  it("si fetch lanza error, también devuelve score 200", async () => {
    const matchSummary = {
      mode: "1vsbot",
      elapsedSeconds: 50,
      turnNumber: 8,
      boardSize: 9,
      playerName: "Pepe",
      difficulty: "Facil",
      winner: "bot",
    };

    global.fetch.mockRejectedValue(new Error("network error"));

    const result = await requestMatchScore(matchSummary);
    expect(result).toEqual({ score: 200 });
  });
});
