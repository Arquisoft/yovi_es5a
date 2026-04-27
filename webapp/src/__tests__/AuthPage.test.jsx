import React from "react";
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

  // ────────────────────────────────────────────────────────────────
  it("muestra validación de login cuando falta el usuario", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /entrar/i }));

    // Texto real del error: "Introduce un nombre de usuario o correo"
    expect(
      screen.getByText(/nombre de usuario/i)
    ).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────────────
  it("muestra validación de registro si contraseñas no coinciden", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    // El tab se llama "Registrarse"
    await user.click(screen.getByRole("tab", { name: /registrarse/i }));

    await user.type(screen.getByLabelText(/correo electrónico/i), "ana@example.com");
    await user.type(screen.getByLabelText(/nombre/i), "ana");
    await user.type(screen.getByLabelText(/^contraseña$/i), "123456");
    await user.type(screen.getByLabelText(/repite/i), "654321");


    await user.click(screen.getByRole("button", { name: /crear/i }));

    expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────
  it("login exitoso guarda sesión y navega al inicio", async () => {
    const user = userEvent.setup();

    login.mockResolvedValue({
      user: { id: 1, username: "ana", email: "ana@example.com" },
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

    // Label real: "Usuario o correo electrónico"
    await user.type(screen.getByLabelText(/usuario/i), "ana");

    // Label real: "Contraseña"
    await user.type(screen.getByLabelText(/^contraseña$/i), "123456");

    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(login).toHaveBeenCalledWith({ identifier: "ana", password: "123456" });
    expect(mockSetSession).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  // ────────────────────────────────────────────────────────────────
  it("muestra error cuando login devuelve fallo de API", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error("Credenciales inválidas"));

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/usuario/i), "ana");
    await user.type(screen.getByLabelText(/^contraseña$/i), "xxx");

    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument();
  });

  // ────────────────────────────────────────────────────────────────
  it("registro exitoso cambia a tab de login", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("tab", { name: /registrarse/i }));

    await user.type(screen.getByLabelText(/correo electrónico/i), "ana@example.com");
    await user.type(screen.getByLabelText(/nombre/i), "ana");
    await user.type(screen.getByLabelText(/^contraseña$/i), "123456");
    await user.type(screen.getByLabelText(/repite/i), "123456");


    await user.click(screen.getByRole("button", { name: /crear/i }));

    // Texto real: t("auth.success.registrationSent")
    expect(await screen.findByText(/registro/i)).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: /iniciar sesión/i })
    ).toHaveAttribute("aria-selected", "true");
  });
});
