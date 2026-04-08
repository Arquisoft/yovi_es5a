import { refreshToken as refreshAccessToken } from "./authApi";
import { useSessionStore } from "../store/sessionStore";


const USERS_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3000";

const inFlightRequests = new Map();

function createFinishedMatchUrl() {
  const normalizedBaseUrl = USERS_BASE_URL.endsWith("/") ? USERS_BASE_URL.slice(0, -1) : USERS_BASE_URL;
  return `${normalizedBaseUrl}/finished-match`;
}

function buildFinishedMatchPayload(matchSummary) {
  const mode = matchSummary.mode;
  console.log("Construyendo payload para matchSummary:", matchSummary);
  const commonPayload = {
    elapsedSeconds: matchSummary.elapsedSeconds,
    turnNumber: matchSummary.turnNumber,
    boardSize: matchSummary.boardSize,
    isDraw: Boolean(matchSummary.isDraw),
    mode,
  };

  if (mode === "1vs1") {
    return {
      ...commonPayload,
      playerName: matchSummary.playerName,
      guestName: matchSummary.guestName,
      winner: matchSummary.winner,
    };
  }

  if (mode === "1vsbot") {
    return {
      ...commonPayload,
      playerName: matchSummary.playerName ? matchSummary.playerName : "BOT",
      difficulty: matchSummary.difficulty,
      winner: matchSummary.winner,
    };
  }

  if (mode === "botvsbot") {
    return {
      ...commonPayload,
      difficulty: matchSummary.difficulty,
      winner: matchSummary.winner,
      bot1Name: matchSummary.bot1Name,
      bot2Name: matchSummary.bot2Name,
    };
  }

  return commonPayload;
}

export async function requestMatchScore(matchSummary) {
  const payload = buildFinishedMatchPayload(matchSummary);
  const requestKey = JSON.stringify(payload);

  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }

  const pendingRequest = (async () => {
    const { accessToken, refreshToken } = useSessionStore.getState();

    async function sendRequest(token) {
      return fetch(createFinishedMatchUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    }

    async function parseResponse(response) {
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return data;
    }

    try {
      let response;
      let data;

      try {
        response = await sendRequest(accessToken);
        data = await parseResponse(response);

        if (response.status === 401 && refreshToken) {
          try {
            const rotated = await refreshAccessToken({ refreshToken });

            useSessionStore.getState().updateTokenPair({
              accessToken: rotated.accessToken,
              refreshToken: rotated.refreshToken,
              accessTokenExpiresIn: rotated.accessTokenExpiresIn,
              refreshTokenExpiresIn: rotated.refreshTokenExpiresIn,
              });

            response = await sendRequest(rotated.accessToken);
            data = await parseResponse(response);

          } catch (refreshError) {
        
            useSessionStore.getState().clearSession?.();
            throw new Error("SESSION_EXPIRED");
          }
        }

      } catch (authError) {
          console.error("Error de autenticación:", authError);
          throw authError;
      }

        if (!response.ok) {
          throw new Error(data?.message || "No se pudo calcular la puntuación en users.");
        }

        const rawScore = data?.score ?? data?.points ?? data?.puntuacion;
        const parsedScore = Number(rawScore);

        if (Number.isNaN(parsedScore)) {
          throw new Error("La respuesta de users no incluye una puntuación válida.");
        }

        return {
          score: parsedScore,
          saved: Boolean(data?.saved),
          gameId: data?.gameId ?? null,
        };
      } catch (error) {
        console.error("Error calculando score:", error);
        throw error;
      } finally {
        inFlightRequests.delete(requestKey);
      }
    })();

  inFlightRequests.set(requestKey, pendingRequest);
  return pendingRequest;
}
