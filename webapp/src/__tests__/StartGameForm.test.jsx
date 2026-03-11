import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartGameForm from "../components/StartGameForm";
import React from "react";

vi.mock("../store/boardStore", () => ({
  useBoardStore: vi.fn(),
}));

import { useBoardStore } from "../store/boardStore";

describe("StartGameForm", () => {
  const setGameConfig = vi.fn();
  const startGameFromConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    useBoardStore.mockImplementation((selector) =>
      selector({ setGameConfig, startGameFromConfig })
    );

    
    // Mock global fetch → simula que el backend acepta cualquier usuario
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    });
  });

  it("renderiza 1vs1 por defecto (pide 2 nombres, no muestra dificultad)", () => {
    render(<StartGameForm />);

    expect(screen.getByRole("heading", { name: /configurar partida/i }))
      .toBeInTheDocument();

    expect(screen.getByLabelText(/modo/i)).toHaveValue("1vs1");

    expect(screen.getByLabelText(/nombre jugador 1/i)).toBeRequired();
    expect(screen.getByLabelText(/nombre jugador 2/i)).toBeRequired();

    expect(screen.queryByLabelText(/dificultad/i)).toBeNull();
  });

  it("si cambias a 1vsbot, muestra dificultad y oculta jugador 2", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.selectOptions(screen.getByLabelText(/modo/i), "1vsbot");

    expect(screen.queryByLabelText(/nombre jugador 2/i)).toBeNull();
    expect(screen.getByLabelText(/dificultad/i)).toHaveValue("Facil");

    expect(screen.getByLabelText(/nombre jugador 1/i)).toHaveAttribute(
      "placeholder",
      "Tu nombre"
    );
  });

  it("hace submit y llama a setGameConfig + startGameFromConfig (modo 1vs1)", async () => {
    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre jugador 1/i), "Alice");
    await user.type(screen.getByLabelText(/nombre jugador 2/i), "Bob");

    await user.clear(screen.getByLabelText(/tamaño tablero/i));
    await user.type(screen.getByLabelText(/tamaño tablero/i), "10");

    await user.click(screen.getByRole("button", { name: /empezar partida/i }));

    // Verifica que se llamó a fetch 2 veces (una por jugador)
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/createuser"),
      expect.objectContaining({ method: "POST" })
    );

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

    await user.type(screen.getByLabelText(/nombre jugador 1/i), "Juan");
    await user.selectOptions(screen.getByLabelText(/dificultad/i), "Media");

    await user.click(screen.getByRole("button", { name: /empezar partida/i }));

    // En modo bot solo se crea 1 usuario
    expect(global.fetch).toHaveBeenCalledTimes(1);

    expect(setGameConfig).toHaveBeenCalledTimes(1);
    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vsbot",
      player1Name: "Juan",
      player2Name: "",
      difficulty: "Media",
      boardSize: 8,
    });

    expect(startGameFromConfig).toHaveBeenCalledTimes(1);
  });

  it("muestra error si el backend falla al crear usuario", async () => {
    // Sobrescribe el mock para simular error del servidor
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Username already exists" }),
    });

    const user = userEvent.setup();
    render(<StartGameForm />);

    await user.type(screen.getByLabelText(/nombre jugador 1/i), "Alice");
    await user.type(screen.getByLabelText(/nombre jugador 2/i), "Bob");
    await user.click(screen.getByRole("button", { name: /empezar partida/i }));

    expect(await screen.findByText(/username already exists/i)).toBeInTheDocument();
    expect(setGameConfig).not.toHaveBeenCalled();
    expect(startGameFromConfig).not.toHaveBeenCalled();
  });
});
