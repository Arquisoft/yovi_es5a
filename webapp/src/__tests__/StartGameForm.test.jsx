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

    expect(setGameConfig).toHaveBeenCalledTimes(1);
    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vs1",
      player1Name: "Alice",
      player2Name: "Bob",
      difficulty: "Facil",
      boardSize: "10", // Nota: con tu código actual queda string si el usuario lo cambia
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

    expect(setGameConfig).toHaveBeenCalledTimes(1);
    expect(setGameConfig).toHaveBeenCalledWith({
      gameMode: "1vsbot",
      player1Name: "Juan",
      player2Name: "",
      difficulty: "Media",
      boardSize: 8, // aquí sigue siendo number porque no tocaste el input
    });

    expect(startGameFromConfig).toHaveBeenCalledTimes(1);
  });
});
