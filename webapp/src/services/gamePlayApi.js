import i18n from "../i18n";
import { getBackendErrorMessage } from "./apiErrorHelper";

const GAMEY_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_GAMEY_URL) ||
  "http://localhost:4000";

function createPlayUrl() {
  const normalizedBaseUrl = GAMEY_BASE_URL.endsWith("/")
    ? GAMEY_BASE_URL.slice(0, -1)
    : GAMEY_BASE_URL;
  return `${normalizedBaseUrl}/game/play/`;
}

function createBotUrl(botId) {
  const url = new URL(GAMEY_BASE_URL);
  url.port = "4001";
  url.pathname = `/v1/choose/${botId}`;
  return url.toString();
}

function difficultyToBotId(difficulty) {
  switch (difficulty) {
    case "Facil":   return "random_bot";
    case "Media":   return "medium_bot";
    case "Dificil": return "hard_bot";
    default:        return "random_bot";
  }
}

export async function validateTwoPlayerMove({ board, selectedCell }) {
  const response = await fetch(createPlayUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board,
      selectedCell,
      mode: "1vs1",
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      getBackendErrorMessage(data, "game.error.serverValidationFailed")
    );
  }

  return {
    isValidMove: Boolean(data?.isValidMove),
    hasWon: Boolean(data?.hasWon),
    message: data?.message,
  };
}

export async function requestBotMove({ board, difficulty = "Facil" }) {
  const botId = difficultyToBotId(difficulty);
  const response = await fetch(createBotUrl(botId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(board),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(getBackendErrorMessage(data, "game.error.serverBotMoveFailed"));
  }

  if (!data?.coords) {
    throw new Error(i18n.t("game.error.botCoordsMissing"));
  }

  return {
    botId: data.bot_id ?? botId,
    coords: data.coords,
    apiVersion: data.api_version ?? null,
    hasWon: Boolean(data?.hasWon),
  };
}