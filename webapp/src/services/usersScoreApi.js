const USERS_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const inFlightRequests = new Map();

function createFinishedMatchUrl() {
  const normalizedBaseUrl = USERS_BASE_URL.endsWith("/") ? USERS_BASE_URL.slice(0, -1) : USERS_BASE_URL;
  return `${normalizedBaseUrl}/finished-match`;
}

function buildFinishedMatchPayload(matchSummary) {
  const mode = matchSummary.mode;
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
      winnerName: matchSummary.winnerName,
      loserName: matchSummary.loserName,
    };
  }

  if (mode === "1vsbot") {
    return {
      ...commonPayload,
      playerName: matchSummary.playerName,
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
    //cargaros el try catch cuando este el backend, esto lo hago para mockearlo y probar. Asi ademas sabeis ya que me teneis que devolver
    try {
      const response = await fetch(createFinishedMatchUrl(), {
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
      return {
        score: 200,
        saved: false,
        gameId: null,
      };
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();

  inFlightRequests.set(requestKey, pendingRequest);
  return pendingRequest;
}
