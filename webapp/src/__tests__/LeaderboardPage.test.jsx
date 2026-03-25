import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LeaderboardPage from "../pages/LeaderboardPage";

vi.mock("../services/leaderboardApi", () => ({
  fetchLeaderboard: vi.fn(),
  fetchUserSuggestions: vi.fn().mockResolvedValue({ items: [] }),
  resolveUserExact: vi.fn(),
}));

import { fetchLeaderboard } from "../services/leaderboardApi";

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza filas del leaderboard", async () => {
    fetchLeaderboard.mockResolvedValue({
      items: [{ globalPosition: 1, username: "Ana", bestScore: 120, totalGames: 4 }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/cargando puntuaciones/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ana")).toBeInTheDocument());
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("muestra estado vacío", async () => {
    fetchLeaderboard.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/no hay jugadores/i)).toBeInTheDocument());
  });
});
