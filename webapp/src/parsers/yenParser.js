const PLAYER_SYMBOLS = {
  player1: "B",
  player2: "R",
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
 * Fila visual = r (0=punta arriba, size-1=base).
 * Dentro de fila r: q de (size-1-r) [izq] a (size-1) [der].
 * YEN fila r: col=0=izq → q=size-1-r, col=r=der → q=size-1
 */
export function boardToYen({ size, turnNumber, cells }) {
  const safeSize = Number(size);
  const safeCells = Array.isArray(cells) ? cells : [];
  const currentTurn = turnNumber % 2 === 1 ? "B" : "R";
  const byId = new Map(safeCells.map((cell) => [cell.id, cell]));
  const rows = [];

  for (let r = 0; r < safeSize; r += 1) {
    const row = [];
    for (let q = safeSize - 1 - r; q < safeSize; q += 1) {
      const cell = byId.get(`${q},${r}`);
      row.push(cell?.state ? (PLAYER_SYMBOLS[cell.state] || ".") : ".");
    }
    rows.push(row.join(""));
  }

  return {
    size: safeSize,
    turn: currentTurn,
    players: ["B", "R"],
    layout: rows.join("/"),
  };
}

function symbolToOwner(symbol) {
  if (symbol === "B") return "player1";
  if (symbol === "R") return "player2";
  return null;
}

export function yenToBoardState(board) {
  const parsedSize = Number(board?.size);
  const safeSize = Number.isNaN(parsedSize) ? null : parsedSize;
  const rows = typeof board?.layout === "string" ? board.layout.split("/") : [];
  if (!safeSize || rows.length !== safeSize) return null;

  const statesById = {};

  for (let r = 0; r < safeSize; r += 1) {
    const row = rows[r] || "";
    if (row.length !== r + 1) return null;
    let colIndex = 0;
    for (let q = safeSize - 1 - r; q < safeSize; q += 1) {
      statesById[`${q},${r}`] = symbolToOwner(row[colIndex] || ".");
      colIndex += 1;
    }
  }

  const turnNumber = board?.turn === 0 ? 1 : 2;
  return { size: safeSize, turnNumber, statesById };
}

export function makeTestTriangleBoard(size, markedIds = [], firstPlayer = "player1") {
  const safeSize = Number(size);
  if (Number.isNaN(safeSize) || safeSize <= 0) throw new Error("Invalid size");

  const cells = [];
  for (let q = 0; q < safeSize; q += 1) {
    for (let r = safeSize - 1 - q; r < safeSize; r += 1) {
      cells.push({ q, r, id: `${q},${r}`, state: null });
    }
  }

  markedIds.forEach((id) => {
    const cell = cells.find((c) => c.id === id);
    if (cell) cell.state = firstPlayer;
  });

  const yen = boardToYen({ size: safeSize, turnNumber: 1, cells });
  console.log(yen);
  return { size: safeSize, cells, yen, back: yenToBoardState(yen) };
}
