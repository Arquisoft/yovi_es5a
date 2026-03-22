import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      botItems: [{ id: 1, score: 100, boardSize: 8, totalTurns: 20, difficulty: "medio", winner: "player", winnerName: "Ana" }],
      pvpItems: [{ id: 2, score: 80, boardSize: 8, totalTurns: 18, player1Name: "Ana", player2Name: "Luis", winnerName: "Luis" }],
      botPage: 1,
      botPageSize: 25,
      botTotalPages: 2,
      pvpPage: 1,
      pvpPageSize: 25,
      pvpTotalPages: 2,
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
    expect(screen.getByText(/partidas contra bot/i)).toBeInTheDocument();
    expect(screen.getByText(/partidas jugador contra jugador/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ganador/i).length).toBeGreaterThanOrEqual(2);
  });

  it("consulta leaderboard centrado sin forzar page en carga inicial", async () => {
    render(
      <MemoryRouter initialEntries={["/user/Ana"]}>
        <Routes>
          <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchCenteredLeaderboard).toHaveBeenCalled());
    const args = fetchCenteredLeaderboard.mock.calls[0][0];
    expect(args.page).toBeUndefined();
  });

  it("permite paginación independiente en ambas subsecciones", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/user/Ana"]}>
        <Routes>
          <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());

    const pagers = screen.getAllByLabelText(/controles de paginación/i);
    const botNextButton = within(pagers[1]).getByRole("button", { name: /siguiente/i });
    const pvpNextButton = within(pagers[2]).getByRole("button", { name: /siguiente/i });

    await user.click(botNextButton);

    await waitFor(() => {
      const hasBotPage2Request = fetchUserHistory.mock.calls.some(([args]) => (
        args.botPage === 2 && args.pvpPage === 1
      ));
      expect(hasBotPage2Request).toBe(true);
    });

    await user.click(pvpNextButton);

    await waitFor(() => {
      const hasPvpPage2Request = fetchUserHistory.mock.calls.some(([args]) => (
        args.pvpPage === 2
      ));
      expect(hasPvpPage2Request).toBe(true);
    });
  });
});
