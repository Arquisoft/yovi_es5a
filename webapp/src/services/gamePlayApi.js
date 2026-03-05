const GAMEY_BASE_URL = import.meta.env.VITE_GAMEY_URL || "http://localhost:4000";

function createPlayUrl() {
  const normalizedBaseUrl = GAMEY_BASE_URL.endsWith("/") ? GAMEY_BASE_URL.slice(0, -1) : GAMEY_BASE_URL;
  return `${normalizedBaseUrl}/game/play/`;
}

export async function validateTwoPlayerMove({ board, selectedCell }) {
//cargaros el try catch cuando este el backend, esto lo hago para mockearlo y probar. Asi ademas sabeis ya que me teneis que devolver
  try {
    const response = await fetch(createPlayUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board,
        selectedCell,
        mode:"1vs1",
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || "No se pudo validar el movimiento en el servidor.");

    }

    return {
      isValidMove: Boolean(data?.isValidMove),
      hasWon: Boolean(data?.hasWon),
      message: data?.message,
    };
  } catch (error) {
    return {
      isValidMove: true,
      hasWon: true,
      message: "Simulado"
    }
  }
}

export async function validateBotMove({ board, selectedCell, difficulty }) {
  try {
    const response = await fetch(createPlayUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board,
        selectedCell,
        difficulty,
        mode: "1vsbot",
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || "No se pudo validar el movimiento en el servidor.");
    }

    return {
      isValidMove: Boolean(data?.isValidMove),
      board: data?.board,
      hasPlayerWon: Boolean(data?.hasPlayerWon),
      hasBotWon: Boolean(data?.hasBotWon),
      message: data?.message,
    };
  } catch (error) {
    return {
      isValidMove: true,
      board: {
        size: 8,
        turn: "R",
        players: ["B", "R"],
        layout: "R/B./.../..../...../....../......./........",
      },
      hasPlayerWon: false,
      hasBotWon: true,
      message: "Simulado",
    };
  }
}
