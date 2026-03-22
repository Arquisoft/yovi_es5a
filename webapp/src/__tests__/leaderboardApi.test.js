import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchLeaderboard,
  fetchUserSuggestions,
  resolveUserExact,
} from "../services/leaderboardApi";

describe("leaderboardApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("solicita leaderboard paginado", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], page: 1, pageSize: 25, totalPages: 1 }),
    });

    const result = await fetchLeaderboard({ page: 1, pageSize: 25 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain("/leaderboard?page=1&pageSize=25");
    expect(result.pageSize).toBe(25);
  });

  it("no consulta sugerencias con menos de 4 caracteres", async () => {
    const result = await fetchUserSuggestions({ query: "abc" });
    expect(result).toEqual({ items: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hace resolución exacta de usuario", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ username: "Ana" }),
    });

    const result = await resolveUserExact({ username: " ana " });

    expect(global.fetch.mock.calls[0][0]).toContain("/users/resolve?username=ana");
    expect(result.username).toBe("Ana");
  });
});
