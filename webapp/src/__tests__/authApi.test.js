import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { login, register, refreshToken, logout } from "../services/authApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(body = {}) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchError(body = {}) {
  global.fetch.mockResolvedValue({
    ok: false,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchJsonThrows() {
  global.fetch.mockResolvedValue({
    ok: false,
    json: vi.fn().mockRejectedValue(new SyntaxError("invalid json")),
  });
}

function lastCall() {
  return global.fetch.mock.calls[global.fetch.mock.calls.length - 1];
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("authApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("hace POST a /auth/login", async () => {
      mockFetchOk({ accessToken: "a" });
      await login({ identifier: "ana", password: "123" });

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toContain("/auth/login");
      expect(options.method).toBe("POST");
    });

    it("envía Content-Type: application/json", async () => {
      mockFetchOk({ accessToken: "a" });
      await login({ identifier: "ana", password: "123" });

      const [, options] = global.fetch.mock.calls[0];
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    it("serializa identifier y password en el body", async () => {
      mockFetchOk({ accessToken: "a" });
      await login({ identifier: "ana", password: "secret" });

      const [, options] = global.fetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ identifier: "ana", password: "secret" });
    });

    it("devuelve los datos de la respuesta en caso de éxito", async () => {
      mockFetchOk({ accessToken: "tok123", refreshToken: "ref456" });
      const result = await login({ identifier: "ana", password: "123" });
      expect(result).toEqual({ accessToken: "tok123", refreshToken: "ref456" });
    });

    it("lanza Error con message del servidor cuando ok=false", async () => {
      mockFetchError({ message: "Credenciales incorrectas" });
      await expect(login({ identifier: "ana", password: "bad" }))
        .rejects.toThrow(/credenciales incorrectas/i);
    });

    it("lanza Error con error del servidor si no hay message", async () => {
      // Rama: data?.message || data?.error || "Error de autenticación"
      mockFetchError({ error: "Unauthorized" });
      await expect(login({ identifier: "ana", password: "bad" }))
        .rejects.toThrow(/unauthorized/i);
    });

    it("lanza mensaje genérico si el cuerpo no tiene message ni error", async () => {
      // Rama: ambos undefined → "Error de autenticación"
      mockFetchError({});
      await expect(login({ identifier: "ana", password: "bad" }))
        .rejects.toThrow(/error de autenticación/i);
    });

    it("lanza mensaje genérico si response.json() falla (body vacío / no-JSON)", async () => {
      // Rama: catch en el try { data = await response.json() } → data = null
      // Luego !response.ok → throw con data?.message = undefined → fallback
      mockFetchJsonThrows();
      await expect(login({ identifier: "ana", password: "bad" }))
        .rejects.toThrow(/error de autenticación/i);
    });

    it("construye la URL correctamente sin doble barra cuando USERS_BASE_URL termina en /", async () => {
      // createUrl normaliza la base: elimina la barra final antes de concatenar
      // Verificamos que la URL no contenga doble barra
      mockFetchOk({ accessToken: "a" });
      await login({ identifier: "ana", password: "123" });

      const [url] = global.fetch.mock.calls[0];
      expect(url).not.toContain("//auth");
    });
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe("register", () => {
    it("hace POST a /auth/register", async () => {
      mockFetchOk({ id: 1 });
      await register({ email: "a@b.com", username: "ana", password: "123456", confirmPassword: "123456" });

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toContain("/auth/register");
      expect(options.method).toBe("POST");
    });

    it("serializa todos los campos en el body", async () => {
      mockFetchOk({ id: 1 });
      await register({ email: "a@b.com", username: "ana", password: "pass", confirmPassword: "pass" });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({
        email: "a@b.com",
        username: "ana",
        password: "pass",
        confirmPassword: "pass",
      });
    });

    it("devuelve los datos del servidor en caso de éxito", async () => {
      mockFetchOk({ id: 42, username: "ana" });
      const result = await register({
        email: "a@b.com", username: "ana", password: "pass", confirmPassword: "pass",
      });
      expect(result).toEqual({ id: 42, username: "ana" });
    });

    it("lanza Error con message cuando ok=false", async () => {
      mockFetchError({ message: "email inválido" });
      await expect(
        register({ email: "x", username: "ana", password: "123456", confirmPassword: "123456" })
      ).rejects.toThrow(/email inválido/i);
    });

    it("lanza Error con error cuando no hay message", async () => {
      mockFetchError({ error: "Conflict" });
      await expect(
        register({ email: "x", username: "ana", password: "123456", confirmPassword: "123456" })
      ).rejects.toThrow(/conflict/i);
    });

    it("lanza mensaje genérico si no hay message ni error", async () => {
      mockFetchError({});
      await expect(
        register({ email: "x", username: "ana", password: "123456", confirmPassword: "123456" })
      ).rejects.toThrow(/error de autenticación/i);
    });

    it("lanza mensaje genérico si response.json() falla", async () => {
      mockFetchJsonThrows();
      await expect(
        register({ email: "x", username: "ana", password: "123456", confirmPassword: "123456" })
      ).rejects.toThrow(/error de autenticación/i);
    });
  });

  // ── refreshToken ───────────────────────────────────────────────────────────

  describe("refreshToken", () => {
    it("hace POST a /auth/refresh", async () => {
      mockFetchOk({ accessToken: "new" });
      await refreshToken({ refreshToken: "r1" });

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toContain("/auth/refresh");
      expect(options.method).toBe("POST");
    });

    it("serializa el refreshToken en el body", async () => {
      mockFetchOk({ accessToken: "new" });
      await refreshToken({ refreshToken: "r1" });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ refreshToken: "r1" });
    });

    it("devuelve los datos del servidor en caso de éxito", async () => {
      mockFetchOk({ accessToken: "newTok" });
      const result = await refreshToken({ refreshToken: "r1" });
      expect(result).toEqual({ accessToken: "newTok" });
    });

    it("lanza Error con message cuando ok=false", async () => {
      mockFetchError({ message: "Token expirado" });
      await expect(refreshToken({ refreshToken: "bad" }))
        .rejects.toThrow(/token expirado/i);
    });

    it("lanza mensaje genérico si response.json() falla", async () => {
      mockFetchJsonThrows();
      await expect(refreshToken({ refreshToken: "bad" }))
        .rejects.toThrow(/error de autenticación/i);
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("hace POST a /auth/logout", async () => {
      mockFetchOk({ revoked: true });
      await logout({ refreshToken: "r1" });

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toContain("/auth/logout");
      expect(options.method).toBe("POST");
    });

    it("serializa el refreshToken en el body", async () => {
      mockFetchOk({ revoked: true });
      await logout({ refreshToken: "r1" });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ refreshToken: "r1" });
    });

    it("devuelve los datos del servidor en caso de éxito", async () => {
      mockFetchOk({ revoked: true });
      const result = await logout({ refreshToken: "r1" });
      expect(result).toEqual({ revoked: true });
    });

    it("lanza Error con message cuando ok=false", async () => {
      mockFetchError({ message: "Sesión no encontrada" });
      await expect(logout({ refreshToken: "bad" }))
        .rejects.toThrow(/sesión no encontrada/i);
    });

    it("lanza mensaje genérico si response.json() falla", async () => {
      mockFetchJsonThrows();
      await expect(logout({ refreshToken: "bad" }))
        .rejects.toThrow(/error de autenticación/i);
    });
  });

  // ── Integración: orden de llamadas ──────────────────────────────────────────

  describe("secuencia de llamadas", () => {
    it("refreshToken y logout llaman sus endpoints en el orden correcto", async () => {
      mockFetchOk({ accessToken: "new" });
      await refreshToken({ refreshToken: "r1" });

      mockFetchOk({ revoked: true });
      await logout({ refreshToken: "r1" });

      expect(global.fetch.mock.calls[0][0]).toContain("/auth/refresh");
      expect(global.fetch.mock.calls[1][0]).toContain("/auth/logout");
    });

    it("cada llamada es independiente — no comparten estado", async () => {
      mockFetchOk({ accessToken: "a" });
      await login({ identifier: "ana", password: "123" });

      mockFetchOk({ id: 1 });
      await register({ email: "b@c.com", username: "bob", password: "pass", confirmPassword: "pass" });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[0][0]).toContain("/auth/login");
      expect(global.fetch.mock.calls[1][0]).toContain("/auth/register");
    });
  });
});
