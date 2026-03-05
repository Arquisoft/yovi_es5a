const GAMEY_BASE_URL = import.meta.env.VITE_GAMEY_URL || "http://localhost:4000";

function createPlayUrl() {
  const normalizedBaseUrl = GAMEY_BASE_URL.endsWith("/") ? GAMEY_BASE_URL.slice(0, -1) : GAMEY_BASE_URL;
  return `${normalizedBaseUrl}/game/play/`;
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
    //Esta parte de aqui es solo para comprobar la funcionalidad mientras se desarrolla el backend, eliminar cuando el backend esté listo

  }

  return {
    isValidMove: Boolean(data?.isValidMove),
    hasWon: Boolean(data?.hasWon),
    message: data?.message,
  };
}
