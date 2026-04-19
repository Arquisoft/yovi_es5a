import { getBackendErrorMessage } from "./apiErrorHelper";

const USERS_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3000";

function createUrl(path, query = {}) {
  const normalizedBaseUrl = USERS_BASE_URL.endsWith("/") ? USERS_BASE_URL.slice(0, -1) : USERS_BASE_URL;
  const url = new URL(`${normalizedBaseUrl}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(getBackendErrorMessage(data, "leaderboard.error.loadFailed"));
  }

  return data;
}

export async function fetchLeaderboard({ page = 1, pageSize = 25 }) {
  return requestJson(createUrl("/leaderboard", { page, pageSize }));
}

export async function fetchUserSuggestions({ query, signal }) {
  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery.length <= 3) {
    return { items: [] };
  }

  return requestJson(createUrl("/leaderboard/suggest", { q: normalizedQuery }), { signal });
}

export async function resolveUserExact({ username }) {
  const normalized = String(username || "").trim();
  return requestJson(createUrl("/users/resolve", { username: normalized }));
}

export async function fetchUserProfile({ username }) {
  return requestJson(createUrl(`/users/${encodeURIComponent(username)}`));
}

export async function fetchUserHistory({
  username,
  page = 1,
  pageSize = 25,
  botPage,
  botPageSize,
  pvpPage,
  pvpPageSize,
}) {
  return requestJson(
    createUrl(`/users/${encodeURIComponent(username)}/history`, {
      page,
      pageSize,
      botPage,
      botPageSize,
      pvpPage,
      pvpPageSize,
    })
  );
}

export async function fetchCenteredLeaderboard({ username, page, pageSize = 25 }) {
  return requestJson(createUrl(`/users/${encodeURIComponent(username)}/centered-leaderboard`, { page, pageSize }));
}
