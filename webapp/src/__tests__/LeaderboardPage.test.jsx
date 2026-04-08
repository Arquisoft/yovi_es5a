import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LeaderboardPage from "../pages/LeaderboardPage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../components/UserSearchBar", () => ({
  default: () => <div data-testid="user-search-bar" />,
}));

vi.mock("../components/LeaderboardTable", () => ({
  default: ({ rows }) => (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.username}>
            <td>{r.globalPosition}</td>
            <td>{r.username}</td>
            <td>{r.bestScore}</td>
            <td>{r.totalGames}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock("../components/PaginationControls", () => ({
  default: ({ page, totalPages, pageSize, onPageChange, onPageSizeChange }) => (
    <div data-testid="pagination">
      <span data-testid="current-page">{page}</span>
      <span data-testid="total-pages">{totalPages}</span>
      <span data-testid="page-size">{pageSize}</span>
      <button onClick={() => onPageChange(page + 1)}>Siguiente</button>
      <button onClick={() => onPageSizeChange(10)}>Cambiar tamaño</button>
    </div>
  ),
}));

vi.mock("../services/leaderboardApi", () => ({
  fetchLeaderboard: vi.fn(),
  fetchUserSuggestions: vi.fn().mockResolvedValue({ items: [] }),
  resolveUserExact: vi.fn(),
}));

import { fetchLeaderboard } from "../services/leaderboardApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SINGLE_ITEM_RESPONSE = {
  items: [{ globalPosition: 1, username: "Ana", bestScore: 120, totalGames: 4 }],
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 3,
};

const EMPTY_RESPONSE = {
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LeaderboardPage />
    </MemoryRouter>
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLeaderboard.mockResolvedValue(SINGLE_ITEM_RESPONSE);
  });

  // ── Renderizado inicial / loading ───────────────────────────────────────────

  describe("estado de carga", () => {
    it("muestra el spinner de carga antes de que la API responda", () => {
      fetchLeaderboard.mockReturnValue(new Promise(() => {})); // nunca resuelve
      renderPage();
      expect(screen.getByText(/cargando puntuaciones/i)).toBeInTheDocument();
    });

    it("oculta el spinner tras recibir datos", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/cargando puntuaciones/i)).toBeNull()
      );
    });

    it("muestra el placeholder de tabla mientras carga", () => {
      fetchLeaderboard.mockReturnValue(new Promise(() => {}));
      renderPage();
      // Mientras loading=true la tabla real no se renderiza — aparece el placeholder
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("muestra la tabla cuando la carga termina sin error", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    });
  });

  // ── Renderizado de datos ────────────────────────────────────────────────────

  describe("renderizado de datos", () => {
    it("renderiza las filas del leaderboard", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText("Ana")).toBeInTheDocument());
      expect(screen.getByText("120")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("renderiza múltiples filas", async () => {
      fetchLeaderboard.mockResolvedValue({
        ...SINGLE_ITEM_RESPONSE,
        items: [
          { globalPosition: 1, username: "Ana", bestScore: 120, totalGames: 4 },
          { globalPosition: 2, username: "Bob", bestScore: 90, totalGames: 2 },
        ],
      });
      renderPage();
      await waitFor(() => expect(screen.getByText("Ana")).toBeInTheDocument());
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("muestra estado vacío cuando items es []", async () => {
      fetchLeaderboard.mockResolvedValue(EMPTY_RESPONSE);
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/cargando puntuaciones/i)).toBeNull()
      );
      // La tabla se renderiza con 0 filas — no hay texto de usuario
      expect(screen.queryByText("Ana")).toBeNull();
    });

    it("rama items || []: respuesta sin items no rompe el render", async () => {
      // Rama: data.items || []  → items undefined → array vacío
      fetchLeaderboard.mockResolvedValue({ totalPages: 2 });
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    });

    it("rama totalPages || 1: respuesta sin totalPages usa 1 como fallback", async () => {
      fetchLeaderboard.mockResolvedValue({ items: [] }); // sin totalPages
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId("total-pages")).toHaveTextContent("1")
      );
    });

    it("pasa totalPages correcto a PaginationControls", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId("total-pages")).toHaveTextContent("3")
      );
    });

    it("renderiza el UserSearchBar", async () => {
      renderPage();
      expect(screen.getByTestId("user-search-bar")).toBeInTheDocument();
    });

    it("renderiza el enlace de volver al juego", async () => {
      renderPage();
      expect(screen.getByRole("link", { name: /volver al juego/i })).toBeInTheDocument();
    });
  });

  // ── Estado de error ─────────────────────────────────────────────────────────

  describe("estado de error", () => {
    it("muestra el mensaje de error cuando fetchLeaderboard falla", async () => {
      // Rama: .catch → setError(err.message || ...)
      fetchLeaderboard.mockRejectedValue(new Error("Error de servidor"));
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/error de servidor/i)).toBeInTheDocument()
      );
    });

    it("usa mensaje genérico si el error no tiene message", async () => {
      // Rama: err.message || "No se pudo cargar..."
      fetchLeaderboard.mockRejectedValue({});
      renderPage();
      await waitFor(() =>
        expect(
          screen.getByText(/no se pudo cargar la tabla de puntuaciones/i)
        ).toBeInTheDocument()
      );
    });

    it("oculta la tabla cuando hay error", async () => {
      fetchLeaderboard.mockRejectedValue(new Error("fallo"));
      renderPage();
      await waitFor(() => expect(screen.getByText(/fallo/i)).toBeInTheDocument());
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("no muestra el spinner tras recibir error", async () => {
      fetchLeaderboard.mockRejectedValue(new Error("fallo"));
      renderPage();
      await waitFor(() =>
        expect(screen.queryByText(/cargando puntuaciones/i)).toBeNull()
      );
    });
  });

  // ── Paginación: cambio de página ────────────────────────────────────────────

  describe("cambio de página", () => {
    it("llama a fetchLeaderboard con page=2 al ir a la siguiente página", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /siguiente/i }));

      await waitFor(() =>
        expect(fetchLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        )
      );
    });

    it("muestra el número de página actualizado en PaginationControls", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /siguiente/i }));

      await waitFor(() =>
        expect(screen.getByTestId("current-page")).toHaveTextContent("2")
      );
    });

    it("muestra spinner mientras carga la nueva página", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

      // La segunda llamada no resuelve → loading visible
      fetchLeaderboard.mockReturnValueOnce(new Promise(() => {}));
      await user.click(screen.getByRole("button", { name: /siguiente/i }));

      expect(screen.getByText(/cargando puntuaciones/i)).toBeInTheDocument();
    });
  });

  // ── Paginación: cambio de pageSize ──────────────────────────────────────────

  describe("cambio de pageSize", () => {
    it("resetea a page=1 al cambiar el tamaño de página", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

      // Avanzamos a página 2
      await user.click(screen.getByRole("button", { name: /siguiente/i }));
      await waitFor(() =>
        expect(screen.getByTestId("current-page")).toHaveTextContent("2")
      );

      // Cambiamos pageSize → debe volver a página 1
      await user.click(screen.getByRole("button", { name: /cambiar tamaño/i }));
      await waitFor(() =>
        expect(screen.getByTestId("current-page")).toHaveTextContent("1")
      );
    });

    it("llama a fetchLeaderboard con el nuevo pageSize", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /cambiar tamaño/i }));

      await waitFor(() =>
        expect(fetchLeaderboard).toHaveBeenCalledWith(
          expect.objectContaining({ pageSize: 10, page: 1 })
        )
      );
    });

    it("muestra el nuevo pageSize en PaginationControls", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /cambiar tamaño/i }));

      await waitFor(() =>
        expect(screen.getByTestId("page-size")).toHaveTextContent("10")
      );
    });
  });

  // ── Cleanup: active = false al desmontar ────────────────────────────────────

  describe("cleanup al desmontar (active flag)", () => {
    it("no actualiza estado si el componente se desmonta antes de que resuelva la API", async () => {
      // Rama: if (!active) return  →  evita setState tras unmount
      let resolvePromise;
      fetchLeaderboard.mockReturnValue(
        new Promise((res) => { resolvePromise = res; })
      );

      const { unmount } = renderPage();
      // Desmontamos antes de que la promesa resuelva
      unmount();
      // Resolvemos después del unmount — no debe causar errores de React
      resolvePromise(SINGLE_ITEM_RESPONSE);

      // Si el componente actualizara estado tras unmount, React lanzaría un warning
      // Este test verifica que no hay excepciones ni warnings
      await new Promise((r) => setTimeout(r, 100));
    });

    it("no muestra error si el componente se desmonta durante un fallo de API", async () => {
      let rejectPromise;
      fetchLeaderboard.mockReturnValue(
        new Promise((_, rej) => { rejectPromise = rej; })
      );

      const { unmount } = renderPage();
      unmount();
      rejectPromise(new Error("tarde"));

      await new Promise((r) => setTimeout(r, 100));
      // Sin excepciones = test pasa
    });
  });

  // ── Llamada inicial ─────────────────────────────────────────────────────────

  describe("llamada inicial a la API", () => {
    it("llama a fetchLeaderboard con page=1 y pageSize=25 al montar", async () => {
      renderPage();
      await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledTimes(1));
      expect(fetchLeaderboard).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    });

    it("solo llama una vez al montar (sin rerenders innecesarios)", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
      expect(fetchLeaderboard).toHaveBeenCalledTimes(1);
    });
  });
});
