import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "../store/sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.getState().clearSession();
  });

  it("setSession persiste sesión autenticada", () => {
    useSessionStore.getState().setSession({
      user: { id: 1, username: "ana" },
      accessToken: "a",
      refreshToken: "r",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 259200,
    });

    const state = useSessionStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user.username).toBe("ana");
    expect(localStorage.getItem("yovi_session")).toContain("ana");
  });

  it("clearSession limpia estado y localStorage", () => {
    useSessionStore.getState().setSession({
      user: { id: 1, username: "ana" },
      accessToken: "a",
      refreshToken: "r",
    });

    useSessionStore.getState().clearSession();

    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("yovi_session")).toBeNull();
  });

  it("updateTokenPair actualiza tokens manteniendo usuario", () => {
    useSessionStore.getState().setSession({
      user: { id: 7, username: "maria" },
      accessToken: "old",
      refreshToken: "old_refresh",
      accessTokenExpiresIn: 100,
      refreshTokenExpiresIn: 200,
    });

    useSessionStore.getState().updateTokenPair({
      accessToken: "new",
      refreshToken: "new_refresh",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 259200,
    });

    const state = useSessionStore.getState();
    expect(state.user.username).toBe("maria");
    expect(state.accessToken).toBe("new");
    expect(state.refreshToken).toBe("new_refresh");
  });
});
