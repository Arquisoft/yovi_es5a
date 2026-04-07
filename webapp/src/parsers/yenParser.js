const PLAYER_SYMBOLS = {
  player1: "R",
  player2: "B",
};

export function parseCellId(cellId) {
  if (typeof cellId !== "string") return null;
  const [qValue, rValue] = cellId.split(",");
  const parsedQ = Number(qValue);
  const parsedR = Number(rValue);
  if (Number.isNaN(parsedQ) || Number.isNaN(parsedR)) return null;
  return { q: parsedQ, r: parsedR };
}

/**
 * Convierte coordenadas baricéntricas {x, y, z} del bot
 * al formato de celda {q, r} usado por el tablero.
 *
 * Relación:
 *   q = x
 *   r = 0        si x === size - 1 (ápex)
 *   r = y + 1    en el resto de filas
 */
export function barycentricToCell(coords, size) {
  const { x, y } = coords;
  if (x === size - 1) {
    return { q: x, r: 0 };
  }
  return { q: x, r: y + 1 };
}

export function boardToYen({ size, turnNumber, cells }) {
  const safeSize = Number(size);
  const safeCells = Array.isArray(cells) ? cells : [];
  const byId = new Map(safeCells.map((cell) => [cell.id, cell]));
  const rows = [];

  for (let rowIndex = 0; rowIndex < safeSize; rowIndex++) {
    const q = safeSize - 1 - rowIndex;
    const row = [];

    if (rowIndex === 0) {
      const cell = byId.get(`${q},0`);
      row.push(!cell || !cell.state ? "." : PLAYER_SYMBOLS[cell.state] || ".");
    } else {
      for (let r = 1; r <= rowIndex + 1; r++) {
        const cell = byId.get(`${q},${r}`);
        row.push(!cell || !cell.state ? "." : PLAYER_SYMBOLS[cell.state] || ".");
      }
    }

    rows.push(row.join(""));
  }

  return {
    size: safeSize,
    turn: turnNumber % 2,
    players: ["B", "R"],
    layout: rows.join("/"),
  };
}

function symbolToOwner(symbol) {
  if (symbol === "R") return "player1";
  if (symbol === "B") return "player2";
  return null;
}

export function yenToBoardState(board) {
  const parsedSize = Number(board?.size);
  const safeSize = Number.isNaN(parsedSize) ? null : parsedSize;
  const rows = typeof board?.layout === "string" ? board.layout.split("/") : [];

  if (!safeSize || rows.length !== safeSize) return null;

  const statesById = {};

  for (let rowSize = 1; rowSize <= safeSize; rowSize += 1) {
    const qValue = safeSize - rowSize;
    const rowIndex = rowSize - 1;
    const row = rows[rowIndex] || "";

    if (row.length !== rowSize) return null;

    for (let rValue = 0; rValue < rowSize; rValue += 1) {
      const symbol = row[rValue] || ".";
      statesById[`${qValue},${rValue}`] = symbolToOwner(symbol);
    }
  }

  const turnSymbol = board?.turn === "B" ? "B" : board?.turn === "R" ? "R" : null;
  const turnNumber = turnSymbol === "R" ? 1 : turnSymbol === "B" ? 2 : null;

  return { size: safeSize, turnNumber, statesById };
}

export function makeTestTriangleBoard(size, markedIds = [], firstPlayer = "player1") {
  const safeSize = Number(size);
  if (Number.isNaN(safeSize) || safeSize <= 0) {
    throw new Error("Invalid size in makeTestTriangleBoard");
  }

  const cells = [];
  for (let q = 0; q < safeSize; q += 1) {
    for (let r = 0; r < safeSize - q; r += 1) {
      cells.push({ q, r, id: `${q},${r}`, state: null });
    }
  }

  markedIds.forEach((id) => {
    const cell = cells.find((c) => c.id === id);
    if (cell) cell.state = firstPlayer;
  });

  const turnNumber = 1;
  const yen = boardToYen({ size: safeSize, turnNumber, cells });
  console.log(yen);
  const back = yenToBoardState(yen);

  return { size: safeSize, cells, yen, back };
}
