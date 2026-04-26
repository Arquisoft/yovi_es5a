import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VictoryMenu from "../components/VictoryMenu";

const mockedNavigate = vi.fn();
const resetGameConfig = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock("../store/boardStore", () => ({
  useBoardStore: (selector) => selector({ resetGameConfig }),
}));

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el diálogo con título por defecto y mensaje por defecto usando playerName", async () => {
    requestMatchScore.mockResolvedValue({ score: 42 });

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
    expect(screen.getByText("Resultado de la partida para Pepe")).toBeInTheDocument();

    // Mientras carga (antes de resolver) muestra loading
    expect(screen.getByText(/obteniendo puntuación/i)).toBeInTheDocument();

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

    expect(screen.getByText(/obteniendo puntuación/i)).toBeInTheDocument();

    // Espera a que pinte el error
    expect(await screen.findByText(/error al cargar la puntuación/i)).toBeInTheDocument();
    expect(screen.getByText(/api caída/i)).toBeInTheDocument();
  });

  it("llama requestMatchScore con matchSummary", async () => {
    requestMatchScore.mockResolvedValue({ score: 7 });

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    await waitFor(() => expect(requestMatchScore).toHaveBeenCalledTimes(1));
    expect(requestMatchScore).toHaveBeenCalledWith(matchSummary);
  });

  it("al pulsar Finalizar reinicia configuración y navega al inicio", async () => {
    requestMatchScore.mockResolvedValue({ score: 1 });
    const user = userEvent.setup();

    render(<VictoryMenu playerName="Pepe" matchSummary={matchSummary} />);

    await user.click(screen.getByRole("button", { name: /finalizar/i }));
    expect(resetGameConfig).toHaveBeenCalledTimes(1);
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });
});
