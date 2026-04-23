import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../App";

const mockLogout = vi.fn();

vi.mock("../services/authApi", () => ({
  logout: (...args) => mockLogout(...args),
}));

vi.mock("../store/sessionStore", () => ({
  useSessionStore: vi.fn(),
}));

vi.mock("../store/boardStore", () => ({
  useBoardStore: vi.fn(),
}));

vi.mock("../components/StartGameForm", () => ({
  default: () => <div>Start Game Form</div>,
}));

vi.mock("../components/GameBoard", () => ({
  default: () => <div>Game Board</div>,
}));

vi.mock("../pages/AuthPage", () => ({
  default: () => <div>Auth Page</div>,
}));

vi.mock("../pages/LeaderboardPage", () => ({
  default: () => <div>Leaderboard Page</div>,
}));

vi.mock("../pages/UserProfilePage", () => ({
  default: () => <div>User Profile Page</div>,
}));

import { useSessionStore } from "../store/sessionStore";
import { useBoardStore } from "../store/boardStore";

describe("App global actions", () => {
  const clearSession = vi.fn();
  let sessionState;

  function setupStores() {
    useSessionStore.mockImplementation((selector) => selector(sessionState));
    useBoardStore.mockImplementation((selector) => selector({ isConfigured: false }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sessionState = {
      isAuthenticated: false,
      refreshToken: "refresh-1",
      clearSession,
      user: null,
    };
    mockLogout.mockResolvedValue({ ok: true });
    setupStores();
  });

  it("si no hay sesión muestra solo Clasificación y Ayuda", () => {
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /clasificación/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ayuda/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });

  it("abre y cierra el popup modal de ayuda", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /ayuda/i }));

    expect(screen.getByRole("dialog", { name: /guía rápida de yovi/i })).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: /guía rápida de yovi/i });
    await user.click(within(dialog).getByRole("button", { name: /cerrar ayuda/i }));

    expect(screen.queryByRole("dialog", { name: /guía rápida de yovi/i })).not.toBeInTheDocument();
  });

  it("navega a clasificación desde el botón global", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("link", { name: /clasificación/i }));

    expect(screen.getByText("Leaderboard Page")).toBeInTheDocument();
  });

  it("si hay sesión muestra Salir y ejecuta logout", async () => {
    const user = userEvent.setup();
    sessionState = {
      ...sessionState,
      isAuthenticated: true,
      user: { username: "ana" },
    };
    setupStores();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(mockLogout).toHaveBeenCalledWith({ refreshToken: "refresh-1" });
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Auth Page")).toBeInTheDocument();
  });
});
