import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { login, register, refreshToken, logout } from "../services/authApi";

describe("authApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("login hace POST al endpoint esperado", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ accessToken: "a" }),
    });

    await login({ identifier: "ana", password: "123" });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/auth/login");
    expect(options.method).toBe("POST");
  });

  it("register hace POST y devuelve error de API", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: "email inválido" }),
    });

    await expect(register({
      email: "x",
      username: "ana",
      password: "123456",
      confirmPassword: "123456",
    })).rejects.toThrow(/email inválido/i);
  });

  it("refreshToken y logout llaman endpoints correctos", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ revoked: true }),
    });

    await refreshToken({ refreshToken: "r1" });
    await logout({ refreshToken: "r1" });

    expect(global.fetch.mock.calls[0][0]).toContain("/auth/refresh");
    expect(global.fetch.mock.calls[1][0]).toContain("/auth/logout");
  });
});
