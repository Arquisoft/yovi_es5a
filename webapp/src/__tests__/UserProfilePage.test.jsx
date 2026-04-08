import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserProfilePage from "../pages/UserProfilePage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../components/LeaderboardTable", () => ({
  default: ({ rows, highlightedUsername }) => (
    <table aria-label="leaderboard">
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.username}
            data-highlighted={r.username === highlightedUsername || undefined}
          >
            <td>{r.globalPosition}</td>
            <td>{r.username}</td>
            <td>{r.bestScore}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock("../components/PaginationControls", () => ({
  default: ({
    page,
    totalPages,
    pageSize,
    onPageChange,
    onPageSizeChange,
  }) => (
    <nav aria-label="controles de paginación">
      <span data-testid="page">{page}</span>
      <span data-testid="total-pages">{totalPages}</span>
      <span data-testid="page-size">{pageSize}</span>
      <button onClick={() => onPageChange(page + 1)}>Siguiente</button>
      <button onClick={() => onPageSizeChange(10)}>Cambiar tamaño</button>
    </nav>
  ),
}));

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROFILE = {
  username: "Ana",
  globalPosition: 8,
  bestScore: 123,
  totalGames: 5,
};

const HISTORY = {
  botItems: [
    {
      id: 1,
      score: 100,
      boardSize: 8,
      totalTurns: 20,
      difficulty: "medio",
      winner: "player",
      winnerName: "Ana",
    },
  ],
  pvpItems: [
    {
      id: 2,
      score: 80,
      boardSize: 8,
      totalTurns: 18,
      player1Name: "Ana",
      player2Name: "Luis",
      winnerName: "Luis",
    },
  ],
  botPage: 1,
  botPageSize: 25,
  botTotalPages: 2,
  pvpPage: 1,
  pvpPageSize: 25,
  pvpTotalPages: 2,
};

const CENTERED = {
  highlightedUsername: "Ana",
  userGlobalPosition: 8,
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 3,
  items: [{ globalPosition: 8, username: "Ana", bestScore: 123, totalGames: 5 }],
};

// ── Helper de render ──────────────────────────────────────────────────────────

function renderPage(username = "Ana") {
  return render(
    <MemoryRouter initialEntries={[`/user/${username}`]}>
      <Routes>
        <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("UserProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchUserProfile.mockResolvedValue(PROFILE);
    fetchUserHistory.mockResolvedValue(HISTORY);
    fetchCenteredLeaderboard.mockResolvedValue(CENTERED);
  });

  // ── Renderizado inicial ────────────────────────────────────────────────────

  describe("renderizado inicial", () => {
    it("muestra el nombre de usuario en el header", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /usuario: ana/i })).toBeInTheDocument()
      );
    });

    it("muestra el enlace de volver al juego y a puntuaciones", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("link", { name: /volver al juego/i })).toBeInTheDocument()
      );
      expect(screen.getByRole("link", { name: /volver a puntuaciones/i })).toBeInTheDocument();
    });

    it("muestra el spinner de perfil mientras carga", () => {
      fetchUserProfile.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByText(/cargando perfil/i)).toBeInTheDocument();
    });

    it("oculta el spinner de perfil cuando la carga termina", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/cargando perfil/i)).toBeNull()
      );
    });

    it("muestra el spinner de clasificación mientras carga", () => {
      fetchCenteredLeaderboard.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByText(/cargando clasificación/i)).toBeInTheDocument();
    });

    it("muestra el spinner de historial mientras carga", () => {
      fetchUserHistory.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByText(/cargando historial/i)).toBeInTheDocument();
    });

    it("llama a las tres APIs al montar", async () => {
      renderPage();
      await waitFor(() => expect(fetchUserProfile).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(fetchCenteredLeaderboard).toHaveBeenCalled());
    });

    it("llama a fetchUserProfile con el username extraído de la URL", async () => {
      renderPage("Ana");
      await waitFor(() =>
        expect(fetchUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({ username: "Ana" })
        )
      );
    });

    it("llama a fetchCenteredLeaderboard sin forzar page en la carga inicial (page undefined)", async () => {
      renderPage();
      await waitFor(() => expect(fetchCenteredLeaderboard).toHaveBeenCalled());
      const args = fetchCenteredLeaderboard.mock.calls[0][0];
      expect(args.page).toBeUndefined();
    });
  });

  // ── Perfil del usuario ─────────────────────────────────────────────────────

  describe("tarjeta de perfil", () => {
    it("muestra todos los campos del perfil", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText(/posición global:/i)).toBeInTheDocument());
      const card = screen.getByRole("article");
      expect(within(card).getByText(/posición global:/i)).toBeInTheDocument();
      expect(within(card).getByText(/puntuación máxima:/i)).toBeInTheDocument();
      expect(within(card).getByText(/partidas totales:/i)).toBeInTheDocument();
      expect(within(card).getByText("123")).toBeInTheDocument();
      expect(within(card).getByText("5")).toBeInTheDocument();
    });

    it("no muestra la tarjeta de perfil mientras carga", () => {
      fetchUserProfile.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.queryByText(/posición global:/i)).toBeNull();
    });

    it("muestra error si fetchUserProfile falla con message", async () => {
      fetchUserProfile.mockRejectedValue(new Error("Usuario no encontrado"));
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/usuario no encontrado/i)).toBeInTheDocument()
      );
    });

    it("muestra mensaje genérico si el error no tiene message", async () => {
      fetchUserProfile.mockRejectedValue({});
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/no se pudo cargar el perfil/i)).toBeInTheDocument()
      );
    });

    it("no muestra la tarjeta de perfil cuando hay error", async () => {
      fetchUserProfile.mockRejectedValue(new Error("fallo"));
      renderPage();
      await waitFor(() => expect(screen.getByText(/fallo/i)).toBeInTheDocument());
      expect(screen.queryByText(/posición global:/i)).toBeNull();
    });

    it("el párrafo de error tiene clase errorText", async () => {
      fetchUserProfile.mockRejectedValue(new Error("Error con clase"));
      renderPage();
      await waitFor(() => {
        const el = screen.getByText(/error con clase/i);
        expect(el).toBeInTheDocument();
        expect(el.className).toMatch(/errorText/);
      });
    });

    it("profile null no renderiza el article", () => {
      fetchUserProfile.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.queryByRole("article")).toBeNull();
    });
  });

  // ── Clasificación centrada ─────────────────────────────────────────────────

  describe("leaderboard centrado", () => {
    it("muestra la tabla con el usuario destacado", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );
    });

    it("oculta la tabla mientras carga y muestra el placeholder", () => {
      fetchCenteredLeaderboard.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.queryByRole("table", { name: /leaderboard/i })).toBeNull();
    });

    it("vacía items si fetchCenteredLeaderboard falla", async () => {
      fetchCenteredLeaderboard.mockRejectedValue(new Error("fallo"));
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );
    });

    it("rama items || []: respuesta sin items no rompe el render", async () => {
      fetchCenteredLeaderboard.mockResolvedValue({ totalPages: 2, page: 1, items: [] });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );
    });

    it("pasa totalPages a PaginationControls del leaderboard", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/cargando clasificación/i)).toBeNull()
      );
      const paginators = screen.getAllByRole("navigation");
      expect(within(paginators[0]).getByTestId("total-pages")).toHaveTextContent("3");
    });

    it("centered .then con highlightedUsername, page y totalPages falsy usa fallbacks", async () => {
      fetchCenteredLeaderboard.mockResolvedValue({
        items: [{ globalPosition: 3, username: "Ana", bestScore: 50 }],
        highlightedUsername: "",
        page: 0,
        totalPages: 0,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );
      const navs = screen.getAllByRole("navigation");
      expect(within(navs[0]).getByTestId("total-pages")).toHaveTextContent("1");
      expect(within(navs[0]).getByTestId("page")).toHaveTextContent("1");
    });

    it("catch de centered mantiene la tabla visible con items vacíos", async () => {
      fetchCenteredLeaderboard
        .mockResolvedValueOnce(CENTERED)
        .mockRejectedValueOnce(new Error("fallo en página 2"));

      const user = userEvent.setup();
      renderPage();

      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[0]).getByRole("button", { name: /siguiente/i }));

      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );
    });

    it("totalPages || 1: usa 1 si response.totalPages es 0", async () => {
      fetchCenteredLeaderboard.mockResolvedValue({
        items: [],
        page: 1,
        totalPages: 0,
        highlightedUsername: "Ana",
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );
      const navs = screen.getAllByRole("navigation");
      expect(within(navs[0]).getByTestId("total-pages")).toHaveTextContent("1");
    });
  });

  // ── Historial de partidas ──────────────────────────────────────────────────

  describe("historial de partidas", () => {
    it("muestra las tablas de bot y pvp", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/partidas contra bot/i)).toBeInTheDocument()
      );
      expect(screen.getByText(/partidas jugador contra jugador/i)).toBeInTheDocument();
    });

    it("renderiza filas de la tabla bot", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText("100")).toBeInTheDocument());
      expect(screen.getByText("medio")).toBeInTheDocument();
    });

    it("renderiza filas de la tabla pvp", async () => {
      renderPage();
      await waitFor(() => expect(screen.getAllByText("Luis").length).toBeGreaterThanOrEqual(1));
      expect(screen.getByText("80")).toBeInTheDocument();
    });

    // ── FIX 1: usar within() para evitar colisión con el "8" del perfil ──────
    it("renderiza todos los campos de botItems y pvpItems", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [
          {
            id: 7,
            score: 200,
            boardSize: 10,
            totalTurns: 30,
            difficulty: "difícil",
            winner: "bot",
            winnerName: "BotGanador",
          },
        ],
        pvpItems: [
          {
            id: 8,
            score: 150,
            boardSize: 6,
            totalTurns: 25,
            player1Name: "Jugador1",
            player2Name: "Jugador2",
            winnerName: "Jugador1",
          },
        ],
        botPage: 1,
        botPageSize: 25,
        botTotalPages: 1,
        pvpPage: 1,
        pvpPageSize: 25,
        pvpTotalPages: 1,
      });
      renderPage();

      await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());

      // tables[0] = leaderboard centrado (mock), tables[1] = bot, tables[2] = pvp
      const tables = screen.getAllByRole("table");
      const botTable = tables[1];
      const pvpTable = tables[2];

      expect(within(botTable).getByText("7")).toBeInTheDocument();
      expect(within(botTable).getByText("200")).toBeInTheDocument();
      expect(within(botTable).getByText("10")).toBeInTheDocument();
      expect(within(botTable).getByText("30")).toBeInTheDocument();
      expect(within(botTable).getByText("difícil")).toBeInTheDocument();
      expect(within(botTable).getByText("BotGanador")).toBeInTheDocument();

      expect(within(pvpTable).getByText("8")).toBeInTheDocument();
      expect(within(pvpTable).getByText("150")).toBeInTheDocument();
      expect(within(pvpTable).getByText("6")).toBeInTheDocument();
      expect(within(pvpTable).getByText("25")).toBeInTheDocument();
      expect(within(pvpTable).getAllByText("Jugador1").length).toBeGreaterThanOrEqual(1);
      expect(within(pvpTable).getByText("Jugador2")).toBeInTheDocument();
    });

    it("muestra estado vacío si no hay partidas", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [],
        pvpItems: [],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/este usuario no tiene partidas/i)).toBeInTheDocument()
      );
    });

    it("no muestra las tablas cuando no hay partidas", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [], pvpItems: [],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/partidas contra bot/i)).toBeNull()
      );
    });

    it("vacía items si fetchUserHistory falla", async () => {
      fetchUserHistory.mockRejectedValue(new Error("fallo historial"));
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/cargando historial/i)).toBeNull()
      );
      await waitFor(() =>
        expect(screen.getByText(/este usuario no tiene partidas/i)).toBeInTheDocument()
      );
    });

    it("rama fallback response.items: usa items si botItems no está en la respuesta", async () => {
      fetchUserHistory.mockResolvedValue({
        items: [{ id: 3, score: 50, boardSize: 6, totalTurns: 10, winner: "player", winnerName: "Ana" }],
        pvpItems: [],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText("50")).toBeInTheDocument());
    });

    it("botItems y pvpItems usan [] si la respuesta no los incluye", async () => {
      fetchUserHistory.mockResolvedValue({
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/este usuario no tiene partidas/i)).toBeInTheDocument()
      );
    });

    it("rama fallback totalPages: usa totalPages si botTotalPages no está", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [{ id: 1, score: 90, boardSize: 8, totalTurns: 15, winner: "player", winnerName: "Ana" }],
        pvpItems: [],
        totalPages: 5,
        botPage: 1, botPageSize: 25,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText("90")).toBeInTheDocument());
      const navs = screen.getAllByRole("navigation");
      expect(within(navs[1]).getByTestId("total-pages")).toHaveTextContent("5");
    });

    it("winnerName tiene preferencia sobre winner en bot items", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [{ id: 1, score: 100, boardSize: 8, totalTurns: 20, winner: "player", winnerName: "NombreExplicito" }],
        pvpItems: [],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("NombreExplicito")).toBeInTheDocument()
      );
    });

    it("botPage, pvpPage, botPageSize, pvpPageSize, botTotalPages, pvpTotalPages con 0 usan fallbacks", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [{ id: 1, score: 10, boardSize: 8, totalTurns: 5, winner: "p", winnerName: "Ana" }],
        pvpItems: [{ id: 2, score: 20, boardSize: 8, totalTurns: 5, player1Name: "A", player2Name: "B", winnerName: "A" }],
        botPage: 0,
        botPageSize: 0,
        botTotalPages: 0,
        pvpPage: 0,
        pvpPageSize: 0,
        pvpTotalPages: 0,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument());
      const navs = screen.getAllByRole("navigation");
      expect(within(navs[1]).getByTestId("page")).toHaveTextContent("1");
      expect(within(navs[1]).getByTestId("page-size")).toHaveTextContent("25");
      expect(within(navs[1]).getByTestId("total-pages")).toHaveTextContent("1");
      expect(within(navs[2]).getByTestId("page")).toHaveTextContent("1");
      expect(within(navs[2]).getByTestId("page-size")).toHaveTextContent("25");
      expect(within(navs[2]).getByTestId("total-pages")).toHaveTextContent("1");
    });

    it("bot: usa winner si winnerName es cadena vacía", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [{ id: 1, score: 99, boardSize: 8, totalTurns: 10, winner: "FallbackBot", winnerName: "" }],
        pvpItems: [],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("FallbackBot")).toBeInTheDocument()
      );
    });

    it("pvp: usa winner si winnerName es undefined (línea 273)", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [],
        pvpItems: [
          {
            id: 99,
            score: 1,
            boardSize: 4,
            totalTurns: 3,
            player1Name: "P1",
            player2Name: "P2",
            winner: "WinnerFallback273",
          },
        ],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("WinnerFallback273")).toBeInTheDocument()
      );
    });

    it("pvp: usa winner si winnerName es cadena vacía", async () => {
      fetchUserHistory.mockResolvedValue({
        botItems: [],
        pvpItems: [
          { id: 5, score: 60, boardSize: 8, totalTurns: 12, player1Name: "A", player2Name: "B", winner: "FallbackPvp", winnerName: "" },
        ],
        botPage: 1, botPageSize: 25, botTotalPages: 1,
        pvpPage: 1, pvpPageSize: 25, pvpTotalPages: 1,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("FallbackPvp")).toBeInTheDocument()
      );
    });

    it("no muestra empty state mientras el historial todavía carga", () => {
      fetchUserHistory.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.queryByText(/este usuario no tiene partidas/i)).toBeNull();
      expect(screen.getByText(/cargando historial/i)).toBeInTheDocument();
    });
  });

  // ── Paginación del historial ───────────────────────────────────────────────

  describe("paginación del historial", () => {
    it("avanzar página bot llama a fetchUserHistory con botPage=2 y pvpPage=1", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[1]).getByRole("button", { name: /siguiente/i }));

      await waitFor(() => {
        const called = fetchUserHistory.mock.calls.some(([args]) =>
          args.botPage === 2 && args.pvpPage === 1
        );
        expect(called).toBe(true);
      });
    });

    it("avanzar página pvp llama a fetchUserHistory con pvpPage=2", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[2]).getByRole("button", { name: /siguiente/i }));

      await waitFor(() => {
        const called = fetchUserHistory.mock.calls.some(([args]) =>
          args.pvpPage === 2
        );
        expect(called).toBe(true);
      });
    });

    it("cambiar pageSize de bot resetea botPage a 1", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[1]).getByRole("button", { name: /siguiente/i }));
      await waitFor(() =>
        expect(fetchUserHistory).toHaveBeenCalledWith(
          expect.objectContaining({ botPage: 2 })
        )
      );

      await user.click(within(navs[1]).getByRole("button", { name: /cambiar tamaño/i }));
      await waitFor(() =>
        expect(fetchUserHistory).toHaveBeenCalledWith(
          expect.objectContaining({ botPage: 1, botPageSize: 10 })
        )
      );
    });

    it("cambiar pageSize de pvp resetea pvpPage a 1", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[2]).getByRole("button", { name: /siguiente/i }));
      await waitFor(() =>
        expect(fetchUserHistory).toHaveBeenCalledWith(
          expect.objectContaining({ pvpPage: 2 })
        )
      );

      await user.click(within(navs[2]).getByRole("button", { name: /cambiar tamaño/i }));
      await waitFor(() =>
        expect(fetchUserHistory).toHaveBeenCalledWith(
          expect.objectContaining({ pvpPage: 1, pvpPageSize: 10 })
        )
      );
    });

    it("las paginaciones de bot y pvp son independientes", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[1]).getByRole("button", { name: /siguiente/i }));

      await waitFor(() => {
        const called = fetchUserHistory.mock.calls.some(([args]) =>
          args.botPage === 2 && args.pvpPage === 1
        );
        expect(called).toBe(true);
      });
    });

    it("historial: botPageSize se actualiza y se pasa a fetchUserHistory", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());
      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[1]).getByRole("button", { name: /cambiar tamaño/i }));
      await waitFor(() =>
        expect(fetchUserHistory).toHaveBeenCalledWith(
          expect.objectContaining({ botPageSize: 10 })
        )
      );
    });

    it("historial: pvpPageSize se actualiza y se pasa a fetchUserHistory", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());
      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[2]).getByRole("button", { name: /cambiar tamaño/i }));
      await waitFor(() =>
        expect(fetchUserHistory).toHaveBeenCalledWith(
          expect.objectContaining({ pvpPageSize: 10 })
        )
      );
    });
  });

  // ── Paginación del leaderboard centrado ───────────────────────────────────

  describe("paginación del leaderboard centrado", () => {
    it("avanzar página llama a fetchCenteredLeaderboard con page actualizado", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[0]).getByRole("button", { name: /siguiente/i }));

      await waitFor(() =>
        expect(fetchCenteredLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        )
      );
    });

    it("cambiar pageSize resetea page a null/undefined", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("table", { name: /leaderboard/i })).toBeInTheDocument()
      );

      const navs = screen.getAllByRole("navigation");
      await user.click(within(navs[0]).getByRole("button", { name: /cambiar tamaño/i }));

      await waitFor(() => {
        const called = fetchCenteredLeaderboard.mock.calls.some(([args]) =>
          args.pageSize === 10 && (args.page === null || args.page === undefined)
        );
        expect(called).toBe(true);
      });
    });
  });

  // ── Cleanup: active flag ──────────────────────────────────────────────────

  describe("cleanup al desmontar (active flag)", () => {
    it("no actualiza estado si el componente se desmonta antes de que fetchUserProfile resuelva", async () => {
      let resolve;
      fetchUserProfile.mockReturnValue(new Promise((r) => { resolve = r; }));
      const { unmount } = renderPage();
      unmount();
      resolve(PROFILE);
      await new Promise((r) => setTimeout(r, 50));
    });

    it("no actualiza estado si el componente se desmonta antes de que fetchUserHistory resuelva", async () => {
      let resolve;
      fetchUserHistory.mockReturnValue(new Promise((r) => { resolve = r; }));
      const { unmount } = renderPage();
      unmount();
      resolve(HISTORY);
      await new Promise((r) => setTimeout(r, 50));
    });

    it("no actualiza estado si el componente se desmonta antes de que fetchCenteredLeaderboard resuelva", async () => {
      let resolve;
      fetchCenteredLeaderboard.mockReturnValue(new Promise((r) => { resolve = r; }));
      const { unmount } = renderPage();
      unmount();
      resolve(CENTERED);
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  // ── Username codificado en la URL ─────────────────────────────────────────

  describe("decodeURIComponent del username", () => {
    it("decodifica correctamente un username con espacios codificados", async () => {
      renderPage("Ana%20García");
      await waitFor(() =>
        expect(fetchUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({ username: "Ana García" })
        )
      );
    });

    it("muestra el username decodificado en el header", async () => {
      renderPage("Ana%20García");
      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /usuario: ana garcía/i })).toBeInTheDocument()
      );
    });
  });

  // ── Cobertura de líneas específicas del reporte ───────────────────────────

  describe("cobertura de líneas del reporte", () => {
    it("renderiza sin crash si la URL no tiene nombreUsuario", async () => {
      render(
        <MemoryRouter initialEntries={["/user/"]}>
          <Routes>
            <Route path="/user/" element={<UserProfilePage />} />
            <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
          </Routes>
        </MemoryRouter>
      );
      await waitFor(() =>
        expect(fetchUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({ username: "" })
        )
      );
    });

    // ── FIX 2: desmontar y remontar en lugar de rerender ──────────────────
    it("el effect de reset limpia centered al navegar a otro usuario", async () => {
      const { unmount } = render(
        <MemoryRouter initialEntries={["/user/Ana"]}>
          <Routes>
            <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(fetchCenteredLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({ username: "Ana" })
        )
      );

      unmount();
      fetchCenteredLeaderboard.mockClear();

      render(
        <MemoryRouter initialEntries={["/user/Carlos"]}>
          <Routes>
            <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(fetchCenteredLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({ username: "Carlos" })
        )
      );
    });

    it("centered.page || 1: muestra 1 en PaginationControls cuando page es null", async () => {
      fetchCenteredLeaderboard.mockReturnValue(new Promise(() => {}));
      renderPage();
      const navs = screen.getAllByRole("navigation");
      expect(within(navs[0]).getByTestId("page")).toHaveTextContent("1");
    });

    it("el leaderboard centrado recibe pageSize correctamente", async () => {
      renderPage();
      await waitFor(() => expect(fetchCenteredLeaderboard).toHaveBeenCalled());
      expect(fetchCenteredLeaderboard).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 25 })
      );
    });

    it("el historial recibe username, botPage y pvpPage en la llamada inicial", async () => {
      renderPage();
      await waitFor(() => expect(fetchUserHistory).toHaveBeenCalled());
      expect(fetchUserHistory).toHaveBeenCalledWith(
        expect.objectContaining({ username: "Ana", botPage: 1, pvpPage: 1 })
      );
    });

    it("muestra el heading del leaderboard centrado", async () => {
      renderPage();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { name: /leaderboard \(centrado en usuario\)/i })
        ).toBeInTheDocument()
      );
    });

    it("muestra la sección de historial con heading correcto", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /historial de partidas/i })).toBeInTheDocument()
      );
    });

    it("el efecto de reset de centered se dispara al cambiar username", async () => {
      renderPage("Carlos");
      await waitFor(() =>
        expect(fetchCenteredLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({ username: "Carlos" })
        )
      );
    });
  });
});
