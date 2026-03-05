const PLAYER_SYMBOLS = {
  player1: "R",
  player2: "B",
};

export function parseCellId(cellId) {
  if (typeof cellId !== "string") {
    return null;
  }

  const [qValue, rValue] = cellId.split(",");
  const parsedQ = Number(qValue);
  const parsedR = Number(rValue);

  if (Number.isNaN(parsedQ) || Number.isNaN(parsedR)) {
    return null;
  }

  return { q: parsedQ, r: parsedR };
}

export function boardToYen({ size, turnNumber, cells }) {
  const safeSize = Number(size);
  const safeCells = Array.isArray(cells) ? cells : [];
  const currentTurn = turnNumber % 2 === 1 ? "R" : "B";

  const byId = new Map(safeCells.map((cell) => [cell.id, cell]));
  const rows = [];

  for (let rowSize = 1; rowSize <= safeSize; rowSize += 1) {
    const qValue = safeSize - rowSize;
    const row = [];

    for (let rValue = 0; rValue < rowSize; rValue += 1) {
      const cell = byId.get(`${qValue},${rValue}`);
      if (!cell || !cell.state) {
        row.push(".");
      } else {
        row.push(PLAYER_SYMBOLS[cell.state] || ".");
      }
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
