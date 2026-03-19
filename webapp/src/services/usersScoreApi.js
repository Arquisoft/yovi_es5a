//const USERS_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
//Lo comentado hay que descomentarlo en release, lo hago asi para poder probarlo con el backend simulado. Ademas asi ya sabeis que me teneis que devolver
const USERS_BASE_URL = "http://localhost:3000";
function createFinishedMatchUrl() {
  const normalizedBaseUrl = USERS_BASE_URL.endsWith("/") ? USERS_BASE_URL.slice(0, -1) : USERS_BASE_URL;
  return `${normalizedBaseUrl}/finished-match`;
}

function buildFinishedMatchPayload(matchSummary) {
  const commonPayload = {
    elapsedSeconds: matchSummary.elapsedSeconds,
    turnNumber: matchSummary.turnNumber,
    boardSize: matchSummary.boardSize,
  };

  if (matchSummary.mode === "1vs1") {
    return {
      ...commonPayload,
      mode: "1vs1",
      winnerName: matchSummary.winnerName,
      loserName: matchSummary.loserName,
    };
  }

  return {
    ...commonPayload,
    mode: "1vsbot",
    playerName: matchSummary.playerName,
    difficulty: matchSummary.difficulty,
    winner: matchSummary.winner,
  };
}

export async function requestMatchScore(matchSummary) {
  //cargaros el try catch cuando este el backend, esto lo hago para mockearlo y probar. Asi ademas sabeis ya que me teneis que devolver
  try {
    const payload = buildFinishedMatchPayload(matchSummary);

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
    };
  } catch (error) {
    console.error("Error calculando score:", error);
    return {
      score: 200
    };
  }

}
