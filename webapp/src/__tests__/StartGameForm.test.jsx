import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartGameForm from "../components/StartGameForm";
import React from "react";

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
      selector({ setGameConfig, startGameFromConfig })
    );

    useSessionStore.mockImplementation((selector) =>
      selector({
        user: { username: "Alice" },
        accessToken: "fake-token",
        clearSession,
      })
    );
  });

  it("renderiza 1vs1 por defecto (muestra usuario autenticado e invitado)", () => {
    render(<StartGameForm />);

    expect(screen.getByRole("heading", { name: /configurar partida/i }))
      .toBeInTheDocument();

    expect(screen.getByLabelText(/modo/i)).toHaveValue("1vs1");

    expect(screen.getByLabelText(/jugador autenticado/i)).toHaveValue("Alice");
    expect(screen.getByLabelText(/nombre invitado/i)).toBeRequired();

    expect(screen.queryByLabelText(/dificultad/i)).toBeNull();
  });

  it("si cambias a 1vsbot, muestra dificultad y oculta jugador 2", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.selectOptions(screen.getByLabelText(/modo/i), "1vsbot");

    expect(screen.queryByLabelText(/nombre invitado/i)).toBeNull();
    expect(screen.getByLabelText(/dificultad/i)).toHaveValue("Facil");
  });

  it("hace submit y llama a setGameConfig + startGameFromConfig (modo 1vs1)", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre invitado/i), "Bob");

    await user.clear(screen.getByLabelText(/tamaño tablero/i));
    await user.type(screen.getByLabelText(/tamaño tablero/i), "10");

    await user.click(screen.getByRole("button", { name: /empezar partida/i }));

    expect(setGameConfig).toHaveBeenCalledTimes(1);
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

    await user.click(screen.getByRole("button", { name: /empezar partida/i }));

    expect(setGameConfig).toHaveBeenCalledTimes(1);
    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vsbot",
      player1Name: "Alice",
      player2Name: "Bot",
      difficulty: "Media",
      boardSize: 8,
    });

    expect(startGameFromConfig).toHaveBeenCalledTimes(1);
  });

  it("muestra error si no hay sesión activa", async () => {
    useSessionStore.mockImplementation((selector) =>
      selector({
        user: null,
        accessToken: null,
        clearSession,
      })
    );

    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre invitado/i), "Bob");
    await user.click(screen.getByRole("button", { name: /empezar partida/i }));

    expect(await screen.findByText(/no hay sesión activa/i)).toBeInTheDocument();
    expect(setGameConfig).not.toHaveBeenCalled();
    expect(startGameFromConfig).not.toHaveBeenCalled();
  });
});