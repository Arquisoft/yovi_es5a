const USERS_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3000";


export function createUrl(path) {
  const normalizedBaseUrl = USERS_BASE_URL.endsWith("/") ? USERS_BASE_URL.slice(0, -1) : USERS_BASE_URL;
  return `${normalizedBaseUrl}${path}`;
}

async function requestJson(path, payload) {
  const response = await fetch(createUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Error de autenticación");
  }

  return data;
}

export async function login({ identifier, password }) {
  return requestJson("/auth/login", { identifier, password });
}

export async function register({ username, password, confirmPassword }) {
  return requestJson("/auth/register", { username, password, confirmPassword });
}

export async function refreshToken({ refreshToken }) {
  return requestJson("/auth/refresh", { refreshToken });
}

export async function logout({ refreshToken }) {
  return requestJson("/auth/logout", { refreshToken });
}
