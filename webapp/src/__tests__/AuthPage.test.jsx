import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "../pages/AuthPage";

const mockNavigate = vi.fn();
const mockSetSession = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../services/authApi", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../store/sessionStore", () => ({
  useSessionStore: vi.fn(),
}));

import { login, register } from "../services/authApi";
import { useSessionStore } from "../store/sessionStore";

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.mockImplementation((selector) =>
      selector({ setSession: mockSetSession })
    );
  });

  // ── Login: validación de campos vacíos ────────────────────────────────────
  // El componente valida primero el identifier; el mensaje real es
  // "Debes indicar un usuario.".

  it("muestra validación de login cuando falta el usuario", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      screen.getByText(/debes indicar un usuario/i)
    ).toBeInTheDocument();
  });

  // ── Registro: contraseñas no coinciden ────────────────────────────────────

  it("muestra validación de registro si contraseñas no coinciden", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("tab", { name: /registro/i }));
    await user.type(screen.getByLabelText(/nombre de usuario/i), "ana");
    await user.type(screen.getByLabelText(/^contraseña$/i), "123456");
    await user.type(screen.getByLabelText(/repite la contraseña/i), "654321");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  // ── Login exitoso ─────────────────────────────────────────────────────────
  // El label del campo identifier en el componente es "Usuario",
  // y el de la contraseña es "Contraseña".

  it("login exitoso guarda sesión y navega al inicio", async () => {
    const user = userEvent.setup();

    login.mockResolvedValue({
      user: { id: 1, username: "ana" },
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 259200,
    });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    // El label real del input es "Usuario" (htmlFor="identifier")
    await user.type(screen.getByLabelText(/^usuario$/i), "ana");
    // El label real del password es "Contraseña" (htmlFor="loginPassword")
    await user.type(screen.getByLabelText(/^contraseña$/i), "123456");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(login).toHaveBeenCalledWith({ identifier: "ana", password: "123456" });
    expect(mockSetSession).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  // ── Login: error de API ───────────────────────────────────────────────────

  it("muestra error cuando login devuelve fallo de API", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error("Credenciales inválidas"));

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/^usuario$/i), "ana");
    await user.type(screen.getByLabelText(/^contraseña$/i), "xxx");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument();
  });

  // ── Registro exitoso ──────────────────────────────────────────────────────

  it("registro exitoso cambia a tab de login", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("tab", { name: /registro/i }));
    await user.type(screen.getByLabelText(/nombre de usuario/i), "ana");
    await user.type(screen.getByLabelText(/^contraseña$/i), "123456");
    await user.type(screen.getByLabelText(/repite la contraseña/i), "123456");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/registro enviado/i)).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /iniciar sesión/i })
    ).toHaveAttribute("aria-selected", "true");
  });
});