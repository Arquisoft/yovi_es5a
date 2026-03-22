import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserProfilePage from "../pages/UserProfilePage";

vi.mock("../services/leaderboardApi", () => ({
  fetchUserProfile: vi.fn(),
  fetchUserHistory: vi.fn(),
  fetchCenteredLeaderboard: vi.fn(),
}));

import {
  fetchUserProfile,
  fetchUserHistory,
  fetchCenteredLeaderboard,
} from "../services/leaderboardApi";

describe("UserProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fetchUserProfile.mockResolvedValue({
      username: "Ana",
      globalPosition: 8,
      bestScore: 123,
      totalGames: 5,
    });

    fetchUserHistory.mockResolvedValue({
      items: [{ id: 1, score: 100, boardSize: 8, totalTurns: 20, difficulty: "medio", winner: "player" }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });

    fetchCenteredLeaderboard.mockResolvedValue({
      highlightedUsername: "Ana",
      userGlobalPosition: 8,
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
      items: [{ globalPosition: 8, username: "Ana", bestScore: 123, totalGames: 5 }],
    });
  });

  it("muestra perfil, ranking centrado e historial", async () => {
    render(
      <MemoryRouter initialEntries={["/user/Ana"]}>
        <Routes>
          <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/usuario: Ana/i)).toBeInTheDocument());
    expect(screen.getByText(/posición global:/i)).toBeInTheDocument();
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByText(/historial de partidas/i)).toBeInTheDocument();
  });
});
