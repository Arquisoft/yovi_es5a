import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import StartGameForm from "../components/StartGameForm";

vi.mock("../services/authApi", () => ({
  createUrl: (path) => `http://localhost:3000${path}`,
}));

vi.mock("../store/boardStore", () => ({
  useBoardStore: vi.fn(),
}));

vi.mock("../store/sessionStore", () => ({
  useSessionStore: vi.fn(),
}));

import { useBoardStore } from "../store/boardStore";
import { useSessionStore } from "../store/sessionStore";

describe("StartGameForm", () => {
  const setGameConfig = vi.fn();
  const startGameFromConfig = vi.fn();
  const clearSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    useBoardStore.mockImplementation((selector) =>
      selector({
        setGameConfig,
        startGameFromConfig,
      })
    );

    useSessionStore.mockImplementation((selector) =>
      selector({
        user: { username: "Alice" },
        accessToken: "fake-token",
        clearSession,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza 1vs1 por defecto (muestra usuario autenticado e invitado)", () => {
    render(<StartGameForm />);

    expect(
      screen.getByRole("heading", { name: /configurar partida/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/modo/i)).toHaveValue("1vs1");
    expect(screen.getByLabelText(/jugador autenticado/i)).toHaveValue("Alice");
    expect(screen.getByLabelText(/nombre invitado/i)).toBeRequired();
    expect(screen.queryByLabelText(/dificultad/i)).not.toBeInTheDocument();
  });

  it("si cambias a 1vsbot, muestra dificultad y oculta jugador 2", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.selectOptions(screen.getByLabelText(/modo/i), "1vsbot");

    expect(screen.queryByLabelText(/nombre invitado/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/dificultad/i)).toHaveValue("Facil");
  });

  it("hace submit y llama a setGameConfig + startGameFromConfig (modo 1vs1)", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre invitado/i), "Bob");

    const boardSizeInput = screen.getByLabelText(/tamaño tablero/i);
    await user.clear(boardSizeInput);
    await user.type(boardSizeInput, "10");

    await user.click(
      screen.getByRole("button", { name: /empezar partida/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/auth/check",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer fake-token",
          }),
        })
      );
    });

    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vs1",
      player1Name: "Alice",
      player2Name: "Bob",
      difficulty: "Facil",
      boardSize: "10",
    });

    expect(startGameFromConfig).toHaveBeenCalledTimes(1);
  });

  it("hace submit en modo 1vsbot (no requiere jugador2, sí envía dificultad)", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.selectOptions(screen.getByLabelText(/modo/i), "1vsbot");
    await user.selectOptions(screen.getByLabelText(/dificultad/i), "Media");

    await user.click(
      screen.getByRole("button", { name: /empezar partida/i })
    );

    await waitFor(() => {
      expect(setGameConfig).toHaveBeenCalledTimes(1);
    });

    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vsbot",
      player1Name: "Alice",
      player2Name: "Bot",
      difficulty: "Media",
      boardSize: 8,
    });

    expect(startGameFromConfig).toHaveBeenCalledTimes(1);
  });

  it("si no hay usuario pero sí token, usa 'test' como player1Name y continúa", async () => {
    useSessionStore.mockImplementation((selector) =>
      selector({
        user: null,
        accessToken: "fake-token",
        clearSession,
      })
    );

    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre invitado/i), "Bob");
    await user.click(
      screen.getByRole("button", { name: /empezar partida/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/auth/check",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer fake-token",
          }),
        })
      );
    });

    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vs1",
      player1Name: "test",
      player2Name: "Bob",
      difficulty: "Facil",
      boardSize: 8,
    });

    expect(startGameFromConfig).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/no hay sesión activa/i)).not.toBeInTheDocument();
  });

  it("muestra error de sesión expirada cuando no hay token", async () => {
    useSessionStore.mockImplementation((selector) =>
      selector({
        user: { username: "Alice" },
        accessToken: null,
        clearSession,
      })
    );

    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre invitado/i), "Bob");
    await user.click(
      screen.getByRole("button", { name: /empezar partida/i })
    );

    expect(
      await screen.findByText(/tu sesión ha expirado\. inicia sesión de nuevo\./i)
    ).toBeInTheDocument();

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(setGameConfig).not.toHaveBeenCalled();
    expect(startGameFromConfig).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("muestra error de sesión expirada si la API check devuelve ok:false", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre invitado/i), "Bob");
    await user.click(
      screen.getByRole("button", { name: /empezar partida/i })
    );

    expect(
      await screen.findByText(/tu sesión ha expirado\. inicia sesión de nuevo\./i)
    ).toBeInTheDocument();

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(setGameConfig).not.toHaveBeenCalled();
    expect(startGameFromConfig).not.toHaveBeenCalled();
  });
});