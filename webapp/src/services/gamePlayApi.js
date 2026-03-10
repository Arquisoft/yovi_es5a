const GAMEY_BASE_URL = import.meta.env.VITE_GAMEY_URL || "http://localhost:5000";

function createPlayUrl() {
  const normalizedBaseUrl = GAMEY_BASE_URL.endsWith("/")
    ? GAMEY_BASE_URL.slice(0, -1)
    : GAMEY_BASE_URL;
  return `${normalizedBaseUrl}/game/play/`;
}

function turnToIndex(turn) {
  return turn === "B" ? 0 : 1;
}

/**
 * boardStore: punta = q=size-1,r=0 (arriba). Fila visual = r.
 * Fila r tiene (r+1) celdas: q de (size-1-r) a (size-1), izq→der.
 *
 * Rust from_index: fila 0=punta, fila r tiene (r+1) celdas.
 * rowStart = r*(r+1)/2, col = q-(size-1-r)
 */
function cellToIndex(q, r, size) {
  const rowStart = (r * (r + 1)) / 2;
  const col = q - (size - 1 - r);
  return rowStart + col;
}

function normalizeBoard(board) {
  return {
    size: board.size,
    turn: turnToIndex(board.turn),
    players: board.players,
    layout: board.layout,
  };
}

async function postToPlayApi(body) {
  const response = await fetch(createPlayUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Error en el servidor.");
  return data;
}

export async function validateTwoPlayerMove({ board, selectedCell }) {
  const normalizedBoard = normalizeBoard(board);
  const cellIndex = cellToIndex(selectedCell.q, selectedCell.r, board.size);

  const data = await postToPlayApi({
    board: normalizedBoard,
    selectedCell: { cellIndex },
    mode: "1vs1",
  });

  return {
    isValidMove: Boolean(data?.isValidMove),
    hasWon: Boolean(data?.hasWon),
    message: data?.message,
  };
}

export async function validateBotMove({ board, selectedCell, difficulty }) {
  const normalizedBoard = normalizeBoard(board);
  const cellIndex = cellToIndex(selectedCell.q, selectedCell.r, board.size);

  const data = await postToPlayApi({
    board: normalizedBoard,
    selectedCell: { cellIndex },
    difficulty,
    mode: "1vsbot",
  });

  return {
    isValidMove: Boolean(data?.isValidMove),
    board: data?.board,
    hasPlayerWon: Boolean(data?.hasPlayerWon),
    hasBotWon: Boolean(data?.hasBotWon),
    message: data?.message,
  };
}
