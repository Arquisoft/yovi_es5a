/* import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VictoryMenu from "../components/VictoryMenu";

vi.mock("../services/usersScoreApi", () => ({
  requestMatchScore: vi.fn(),
}));

import { requestMatchScore } from "../services/usersScoreApi";

describe("VictoryMenu", () => {
  const matchSummary = {
    mode: "1vs1",
    elapsedSeconds: 10,
    turnNumber: 3,
    boardSize: 8,
    winnerName: "Alice",
    loserName: "Bob",
  };

  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();

    // JSDOM a veces no deja redefinir reload directamente
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("renderiza el diálogo con título por defecto y mensaje por defecto usando playerName", async () => {
    requestMatchScore.mockResolvedValue({ score: 42 });

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("¡Victoria!")).toBeInTheDocument();
    expect(screen.getByText("Pepe ha ganado la partida.")).toBeInTheDocument();

    // Mientras carga (antes de resolver) muestra loading
    expect(screen.getByText(/cargando puntuación/i)).toBeInTheDocument();

    // Cuando resuelve, aparece la puntuación
    expect(await screen.findByText(/puntuación:\s*42/i)).toBeInTheDocument();
  });

  it("si se pasa message, lo usa en vez del mensaje por defecto", async () => {
    requestMatchScore.mockResolvedValue({ score: 5 });

    render(
      <VictoryMenu
        playerName="Pepe"
        message="Mensaje custom"
        matchSummary={matchSummary}
      />
    );

    expect(screen.getByText("Mensaje custom")).toBeInTheDocument();
    expect(await screen.findByText(/puntuación:\s*5/i)).toBeInTheDocument();
  });

  it("si requestMatchScore falla, muestra el error", async () => {
    requestMatchScore.mockRejectedValue(new Error("API caída"));

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    expect(screen.getByText(/cargando puntuación/i)).toBeInTheDocument();

    // Espera a que pinte el error
    expect(await screen.findByText(/no se ha podido cargar la puntuacion/i)).toBeInTheDocument();
    expect(screen.getByText(/api caída/i)).toBeInTheDocument();
  });

  it("llama requestMatchScore con matchSummary", async () => {
    requestMatchScore.mockResolvedValue({ score: 7 });

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    await waitFor(() => expect(requestMatchScore).toHaveBeenCalledTimes(1));
    expect(requestMatchScore).toHaveBeenCalledWith(matchSummary);
  });

  it("al pulsar Finalizar llama window.location.reload()", async () => {
    requestMatchScore.mockResolvedValue({ score: 1 });
    const user = userEvent.setup();

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    await user.click(screen.getByRole("button", { name: /finalizar/i }));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
 */