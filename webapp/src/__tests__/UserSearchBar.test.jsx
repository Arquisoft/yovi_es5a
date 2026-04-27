import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UserSearchBar from "../components/UserSearchBar";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock("../services/leaderboardApi", () => ({
  fetchUserSuggestions: vi.fn(),
  resolveUserExact: vi.fn(),
}));

import { fetchUserSuggestions, resolveUserExact } from "../services/leaderboardApi";

// ── Helper ────────────────────────────────────────────────────────────────────

function renderSearchBar() {
  return render(
    <MemoryRouter>
      <UserSearchBar />
    </MemoryRouter>
  );
}

function getInput() {
  return screen.getByLabelText(/buscar jugadores/i);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("UserSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por defecto la API devuelve sugerencias vacías — cada test sobreescribe si necesita
    fetchUserSuggestions.mockResolvedValue({ items: [] });
  });

  // ── Renderizado inicial ─────────────────────────────────────────────────────

  describe("renderizado inicial", () => {
    it("muestra el input de búsqueda", () => {
      renderSearchBar();
      expect(getInput()).toBeInTheDocument();
    });

    it("no muestra sugerencias ni error al montar", () => {
      renderSearchBar();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByText(/no se pudieron/i)).toBeNull();
    });
  });

  // ── Rama: query demasiado corta (≤ 3 caracteres) ───────────────────────────
  // debouncedQuery.trim().length <= 3  →  NO llama a la API, limpia sugerencias

  describe("query demasiado corta (≤ 3 chars)", () => {
    it("no llama a fetchUserSuggestions con 1 carácter", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(getInput(), "a");
      // Esperamos más que el debounce (400 ms) para asegurarnos
      await new Promise((r) => setTimeout(r, 600));

      expect(fetchUserSuggestions).not.toHaveBeenCalled();
    });

    it("no llama a fetchUserSuggestions con exactamente 3 caracteres", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(getInput(), "ana");
      await new Promise((r) => setTimeout(r, 600));

      expect(fetchUserSuggestions).not.toHaveBeenCalled();
    });

    it("limpia sugerencias previas si el usuario borra hasta ≤ 3 chars", async () => {
      const user = userEvent.setup();
      // Primero llenamos sugerencias con una query larga
      fetchUserSuggestions.mockResolvedValue({ items: ["Anabel", "Anabela"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(fetchUserSuggestions).toHaveBeenCalled(), { timeout: 2000 });
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Borramos hasta 3 chars — deben desaparecer las sugerencias
      await user.clear(getInput());
      await user.type(getInput(), "ana");
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull(), { timeout: 2000 });
    });

    it("no muestra error al tener query corta", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(getInput(), "ab");
      await new Promise((r) => setTimeout(r, 600));

      expect(screen.queryByText(/no se pudieron/i)).toBeNull();
    });
  });

  // ── Rama: query suficiente (> 3 chars), API con éxito ──────────────────────

  describe("sugerencias con éxito (query > 3 chars)", () => {
    it("llama a fetchUserSuggestions con el query correcto", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({ items: ["Anabel"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(fetchUserSuggestions).toHaveBeenCalled(), { timeout: 2000 });

      expect(fetchUserSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({ query: "anabe" })
      );
    });

    it("renderiza cada sugerencia como botón en un listbox", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({ items: ["Anabel", "Anabela"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
        timeout: 2000,
      });

      const list = screen.getByRole("listbox");
      expect(within(list).getByRole("button", { name: "Anabel" })).toBeInTheDocument();
      expect(within(list).getByRole("button", { name: "Anabela" })).toBeInTheDocument();
    });

    it("API devuelve items undefined: no muestra lista", async () => {
      // Rama: response.items || []  →  items undefined → lista vacía
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({});
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(fetchUserSuggestions).toHaveBeenCalled(), { timeout: 2000 });

      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("no muestra error tras respuesta exitosa", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({ items: ["Anabel"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(fetchUserSuggestions).toHaveBeenCalled(), { timeout: 2000 });

      expect(screen.queryByText(/no se pudieron/i)).toBeNull();
    });
  });

  // ── Rama: AbortError (silencioso) ───────────────────────────────────────────
  // err.name === "AbortError"  →  return sin setError

  describe("AbortError silencioso", () => {
    it("no muestra error cuando fetchUserSuggestions lanza AbortError", async () => {
      const user = userEvent.setup();
      const abortErr = new DOMException("Aborted", "AbortError");
      fetchUserSuggestions.mockRejectedValue(abortErr);
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(fetchUserSuggestions).toHaveBeenCalled(), { timeout: 2000 });

      // Esperamos un tick extra para que el catch se resuelva
      await new Promise((r) => setTimeout(r, 100));
      expect(screen.queryByText(/no se pudieron/i)).toBeNull();
    });

    it("no limpia sugerencias previas cuando ocurre un AbortError", async () => {
      // Las sugerencias del ciclo anterior deben seguir visibles
      const user = userEvent.setup();
      fetchUserSuggestions
        .mockResolvedValueOnce({ items: ["Anabel"] }) // primer debounce
        .mockRejectedValueOnce(new DOMException("Aborted", "AbortError")); // segundo

      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
        timeout: 2000,
      });

      // Escribe más — dispara segundo debounce que aborta
      await user.type(getInput(), "l");
      await new Promise((r) => setTimeout(r, 600));

      // Las sugerencias del primer ciclo aún se muestran (no se limpiaron)
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  // ── Rama: error real en fetchUserSuggestions ────────────────────────────────
  // err.name !== "AbortError"  →  setSuggestions([]) + setError(...)

  describe("error en fetchUserSuggestions", () => {
    it("muestra el mensaje de error cuando la API falla", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockRejectedValue(new Error("Network error"));
      renderSearchBar();

      await user.type(getInput(), "anabe");
      await waitFor(
        () => expect(screen.getByText(/no se pudieron cargar sugerencias/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it("limpia las sugerencias cuando la API falla", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions
        .mockResolvedValueOnce({ items: ["Anabel"] })
        .mockRejectedValueOnce(new Error("fail"));

      renderSearchBar();

      // Primer ciclo: sugerencias OK
      await user.type(getInput(), "anabe");
      await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
        timeout: 2000,
      });

      // Segundo ciclo: falla → lista debe desaparecer
      await user.clear(getInput());
      await user.type(getInput(), "xyzwq");
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull(), { timeout: 2000 });
    });
  });

  // ── Rama: handleSuggestionClick ─────────────────────────────────────────────

  describe("clic en sugerencia", () => {
    it("navega al perfil del usuario al hacer clic en una sugerencia", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({ items: ["Anabel"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      const btn = await screen.findByRole("button", { name: "Anabel" }, { timeout: 2000 });
      await user.click(btn);

      expect(mockedNavigate).toHaveBeenCalledWith("/user/Anabel");
    });

    it("encodes el username en la URL al navegar desde sugerencia", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({ items: ["Ana García"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      const btn = await screen.findByRole("button", { name: "Ana García" }, { timeout: 2000 });
      await user.click(btn);

      expect(mockedNavigate).toHaveBeenCalledWith("/user/Ana%20Garc%C3%ADa");
    });

    it("no llama a resolveUserExact al clic en sugerencia", async () => {
      const user = userEvent.setup();
      fetchUserSuggestions.mockResolvedValue({ items: ["Anabel"] });
      renderSearchBar();

      await user.type(getInput(), "anabe");
      const btn = await screen.findByRole("button", { name: "Anabel" }, { timeout: 2000 });
      await user.click(btn);

      expect(resolveUserExact).not.toHaveBeenCalled();
    });
  });

  // ── Rama: handleSubmit — query vacía ───────────────────────────────────────
  // !normalized  →  return sin llamar a la API

  describe("handleSubmit con query vacía", () => {
    it("no llama a resolveUserExact si el input está vacío", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.keyboard("{Enter}");

      expect(resolveUserExact).not.toHaveBeenCalled();
      expect(mockedNavigate).not.toHaveBeenCalled();
    });

    it("no llama a resolveUserExact si el input es solo espacios", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(getInput(), "   ");
      await user.keyboard("{Enter}");

      expect(resolveUserExact).not.toHaveBeenCalled();
      expect(mockedNavigate).not.toHaveBeenCalled();
    });
  });

  // ── Rama: handleSubmit — coincidencia exacta ────────────────────────────────

  describe("handleSubmit con coincidencia exacta", () => {
    it("navega al perfil con el username devuelto por la API", async () => {
      const user = userEvent.setup();
      resolveUserExact.mockResolvedValue({ username: "Ana" });
      renderSearchBar();

      await user.type(getInput(), "Ana");
      await user.keyboard("{Enter}");

      await waitFor(() => expect(resolveUserExact).toHaveBeenCalled(), { timeout: 2000 });
      expect(mockedNavigate).toHaveBeenCalledWith("/user/Ana");
    });

    it("encodes el username en la URL al navegar desde submit", async () => {
      const user = userEvent.setup();
      resolveUserExact.mockResolvedValue({ username: "Ana García" });
      renderSearchBar();

      await user.type(getInput(), "Ana García");
      await user.keyboard("{Enter}");

      await waitFor(() => expect(mockedNavigate).toHaveBeenCalled(), { timeout: 2000 });
      expect(mockedNavigate).toHaveBeenCalledWith("/user/Ana%20Garc%C3%ADa");
    });

    it("llama a resolveUserExact con el query sin espacios extra", async () => {
      const user = userEvent.setup();
      resolveUserExact.mockResolvedValue({ username: "Ana" });
      renderSearchBar();

      await user.type(getInput(), "  Ana  ");
      await user.keyboard("{Enter}");

      await waitFor(() =>
        expect(resolveUserExact).toHaveBeenCalledWith({ username: "Ana" })
      );
    });
  });

  // ── Rama: handleSubmit — usuario no encontrado ──────────────────────────────
  // catch  →  setError("Usuario no encontrado")

  describe("handleSubmit con error", () => {
    it("muestra 'Usuario no encontrado' cuando la API lanza error", async () => {
      const user = userEvent.setup();
      resolveUserExact.mockRejectedValue(new Error("Not found"));
      renderSearchBar();

      await user.type(getInput(), "fantasma");
      await user.keyboard("{Enter}");

      await waitFor(
        () => expect(screen.getByText(/usuario no encontrado/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it("no navega cuando la API devuelve error", async () => {
      const user = userEvent.setup();
      resolveUserExact.mockRejectedValue(new Error("Not found"));
      renderSearchBar();

      await user.type(getInput(), "fantasma");
      await user.keyboard("{Enter}");

      await waitFor(() => expect(screen.getByText(/usuario no encontrado/i)).toBeInTheDocument());
      expect(mockedNavigate).not.toHaveBeenCalled();
    });

    it("el error de submit se sobreescribe con el de sugerencias si ocurre después", async () => {
      const user = userEvent.setup();
      resolveUserExact.mockRejectedValue(new Error("Not found"));
      fetchUserSuggestions.mockRejectedValue(new Error("Network"));
      renderSearchBar();

      // Primero submit falla
      await user.type(getInput(), "fantas");
      await user.keyboard("{Enter}");
      await waitFor(() => expect(screen.getByText(/usuario no encontrado/i)).toBeInTheDocument());

      // Luego el debounce de sugerencias también falla — sobreescribe el error
      await waitFor(
        () => expect(screen.getByText(/no se pudieron cargar sugerencias/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });
  });
});
