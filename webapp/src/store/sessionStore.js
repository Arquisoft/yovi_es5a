import { create } from "zustand";

const SESSION_STORAGE_KEY = "yovi_session";

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors in browser privacy modes.
  }
}

const initialStoredSession = typeof window !== "undefined" ? readStoredSession() : null;

export const useSessionStore = create((set, get) => ({
  user: initialStoredSession?.user ?? null,
  accessToken: initialStoredSession?.accessToken ?? "",
  refreshToken: initialStoredSession?.refreshToken ?? "",
  accessTokenExpiresIn: initialStoredSession?.accessTokenExpiresIn ?? null,
  refreshTokenExpiresIn: initialStoredSession?.refreshTokenExpiresIn ?? null,

  isAuthenticated: Boolean(initialStoredSession?.user && initialStoredSession?.accessToken),

  setSession: ({ user, accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn }) => {
    const nextState = {
      user: user ?? null,
      accessToken: accessToken ?? "",
      refreshToken: refreshToken ?? "",
      accessTokenExpiresIn: accessTokenExpiresIn ?? null,
      refreshTokenExpiresIn: refreshTokenExpiresIn ?? null,
      isAuthenticated: Boolean(user && accessToken),
    };

    writeStoredSession(nextState.isAuthenticated ? nextState : null);
    set(nextState);
  },

  updateTokenPair: ({ accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn }) => {
    const current = get();
    const nextState = {
      ...current,
      accessToken: accessToken ?? current.accessToken,
      refreshToken: refreshToken ?? current.refreshToken,
      accessTokenExpiresIn: accessTokenExpiresIn ?? current.accessTokenExpiresIn,
      refreshTokenExpiresIn: refreshTokenExpiresIn ?? current.refreshTokenExpiresIn,
      isAuthenticated: Boolean(current.user && (accessToken ?? current.accessToken)),
    };

    writeStoredSession(nextState.isAuthenticated ? nextState : null);
    set(nextState);
  },

  clearSession: () => {
    writeStoredSession(null);
    set({
      user: null,
      accessToken: "",
      refreshToken: "",
      accessTokenExpiresIn: null,
      refreshTokenExpiresIn: null,
      isAuthenticated: false,
    });
  },
}));
