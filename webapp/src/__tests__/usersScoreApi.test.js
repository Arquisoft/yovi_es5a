import { requestMatchScore } from "../services/usersScoreApi";

vi.mock("../services/authApi", () => ({
  refreshToken: vi.fn(),
}));

vi.mock("../store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

import { refreshToken } from "../services/authApi";
import { useSessionStore } from "../store/sessionStore";

describe("usersScoreApi - requestMatchScore", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    useSessionStore.getState.mockReturnValue({
      accessToken: "old_access",
      refreshToken: "old_refresh",
      updateTokenPair: vi.fn(),
    });
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
      playerName: "Alice",
      guestName: "Bob",
      winner: "player",
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ score: 350, saved: true, gameId: 11 }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    expect(url.endsWith("/finished-match")).toBe(true);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers.Authorization).toBe("Bearer old_access");

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      elapsedSeconds: 120,
      turnNumber: 15,
      boardSize: 8,
      isDraw: false,
      mode: "1vs1",
      playerName: "Alice",
      guestName: "Bob",
      winner: "player",
    });

    expect(result).toEqual({ score: 350, saved: true, gameId: 11 });
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
      json: vi.fn().mockResolvedValue({ points: "420", saved: true, gameId: 12 }), // string
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body).toEqual({
      elapsedSeconds: 90,
      turnNumber: 10,
      boardSize: 7,
      isDraw: false,
      mode: "1vsbot",
      playerName: "Pepe",
      difficulty: "Media",
      winner: "player",
    });

    expect(result).toEqual({ score: 420, saved: true, gameId: 12 }); // convertido a número
  });

  it("también acepta puntuacion/puntuacion en la respuesta", async () => {
    const matchSummary = {
      mode: "1vs1",
      elapsedSeconds: 30,
      turnNumber: 5,
      boardSize: 6,
      playerName: "A",
      guestName: "B",
      winner: "player",
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ puntuacion: "99", saved: true, gameId: 13 }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const result = await requestMatchScore(matchSummary);
    expect(result).toEqual({ score: 99, saved: true, gameId: 13 });
  });

  it("si response.ok es false, lanza error", async () => {
    const matchSummary = {
      mode: "1vs1",
      elapsedSeconds: 10,
      turnNumber: 2,
      boardSize: 8,
      playerName: "A",
      guestName: "B",
      winner: "player",
    };

    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({ score: "NaN" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    await expect(requestMatchScore(matchSummary)).rejects.toThrow(/no se pudo calcular la puntuación/i);
  });

  it("si fetch lanza error, propaga excepción", async () => {
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

    await expect(requestMatchScore(matchSummary)).rejects.toThrow(/network error/i);
  });

  it("si /finished-match devuelve 401, intenta refresh y reintenta una vez", async () => {
    const matchSummary = {
      mode: "1vsbot",
      elapsedSeconds: 40,
      turnNumber: 7,
      boardSize: 7,
      playerName: "Pepe",
      difficulty: "Facil",
      winner: "player",
    };

    const updateTokenPair = vi.fn();
    useSessionStore.getState.mockReturnValue({
      accessToken: "expired_access",
      refreshToken: "refresh_1",
      updateTokenPair,
    });

    global.fetch
      .mockResolvedValueOnce({ status: 401, ok: false, json: vi.fn().mockResolvedValue({ message: "unauthorized" }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: vi.fn().mockResolvedValue({ score: 321, saved: true, gameId: 90 }) });

    refreshToken.mockResolvedValue({
      accessToken: "new_access",
      refreshToken: "new_refresh",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 259200,
    });

    const result = await requestMatchScore(matchSummary);

    expect(refreshToken).toHaveBeenCalledWith({ refreshToken: "refresh_1" });
    expect(updateTokenPair).toHaveBeenCalledWith({
      accessToken: "new_access",
      refreshToken: "new_refresh",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 259200,
    });
    expect(result.score).toBe(321);
  });
});
