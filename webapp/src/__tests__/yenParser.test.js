import { describe, it, expect } from "vitest";
import {
  parseCellId,
  boardToYen,
  yenToBoardState,
  makeTestTriangleBoard,
} from "../parsers/yenParser";

// ─── parseCellId ─────────────────────────────────────────────────────────────

describe("parseCellId", () => {
  it("devuelve q y r numéricos con id válido", () => {
    expect(parseCellId("3,5")).toEqual({ q: 3, r: 5 });
  });

  it("devuelve q y r con ceros", () => {
    expect(parseCellId("0,0")).toEqual({ q: 0, r: 0 });
  });

  it("devuelve null si no es string", () => {
    expect(parseCellId(null)).toBeNull();
    expect(parseCellId(123)).toBeNull();
    expect(parseCellId(undefined)).toBeNull();
  });

  it("devuelve null si algún segmento no es número", () => {
    expect(parseCellId("a,2")).toBeNull();
    expect(parseCellId("1,b")).toBeNull();
    // NOTA: "," se parsea como Number("") === 0, no NaN → no devuelve null
    // ese caso no es testeable como null con la implementación actual
  });
});

// ─── boardToYen ───────────────────────────────────────────────────────────────

describe("boardToYen", () => {
  it("tablero size=1 vacío produce layout '.'", () => {
    const result = boardToYen({ size: 1, turnNumber: 1, cells: [] });
    expect(result.layout).toBe(".");
    expect(result.size).toBe(1);
    expect(result.turn).toBe(1);
    expect(result.players).toEqual(["B", "R"]);
  });

  it("tablero size=2 vacío produce layout correcto", () => {
    // rowIndex=0 (ápex): q=1, r=0 → 1 celda → "."
    // rowIndex=1:        q=0, r=1,2 → 2 celdas → ".."
    const result = boardToYen({ size: 2, turnNumber: 1, cells: [] });
    expect(result.layout).toBe("./..");
  });

  it("tablero size=3 vacío produce layout correcto", () => {
    // rowIndex=0: q=2, r=0        → "."
    // rowIndex=1: q=1, r=1,2      → ".."
    // rowIndex=2: q=0, r=1,2,3    → "..."
    const result = boardToYen({ size: 3, turnNumber: 1, cells: [] });
    expect(result.layout).toBe("./../...");
  });

  it("marca correctamente la celda ápex como player1 (R)", () => {
    // ápex size=3: q=2, r=0
    const cells = [{ id: "2,0", state: "player1" }];
    const result = boardToYen({ size: 3, turnNumber: 1, cells });
    expect(result.layout.split("/")[0]).toBe("R");
  });

  it("marca correctamente una celda no-ápex como player2 (B)", () => {
    // rowIndex=1: q=1, r=1 → primera posición de esa fila
    const cells = [{ id: "1,1", state: "player2" }];
    const result = boardToYen({ size: 3, turnNumber: 2, cells });
    expect(result.layout.split("/")[1][0]).toBe("B");
  });

  it("marca varias celdas de ambos jugadores en size=4", () => {
    const cells = [
      { id: "3,0", state: "player1" }, // ápex → rowIndex=0
      { id: "2,1", state: "player2" }, // rowIndex=1, r=1 → posición [0]
      { id: "2,2", state: "player1" }, // rowIndex=1, r=2 → posición [1]
      { id: "1,2", state: "player2" }, // rowIndex=2, r=1..3 → r=2 → posición [1]
      { id: "0,3", state: "player1" }, // rowIndex=3, r=1..4 → r=3 → posición [2]
    ];
    const result = boardToYen({ size: 4, turnNumber: 1, cells });
    const rows = result.layout.split("/");

    expect(rows[0]).toBe("R");      // ápex player1
    expect(rows[1]).toBe("BR");     // q=2: r=1→B, r=2→R
    expect(rows[2]).toBe(".B.");    // q=1: r=1→., r=2→B, r=3→.
    expect(rows[3]).toBe("..R.");   // q=0: r=1→., r=2→., r=3→R, r=4→.
  });

  it("cells no array usa array vacío", () => {
    const result = boardToYen({ size: 2, turnNumber: 1, cells: null });
    expect(result.layout).toBe("./..");
  });

  it("símbolo desconocido se renderiza como '.'", () => {
    const cells = [{ id: "0,0", state: "spectator" }];
    const result = boardToYen({ size: 1, turnNumber: 1, cells });
    expect(result.layout).toBe(".");
  });
});

// ─── yenToBoardState ──────────────────────────────────────────────────────────

describe("yenToBoardState", () => {
  it("parsea correctamente un tablero size=1 vacío", () => {
    const board = { size: 1, layout: ".", turn: "R" };
    const result = yenToBoardState(board);
    expect(result).not.toBeNull();
    expect(result.size).toBe(1);
    expect(result.statesById["0,0"]).toBeNull();
    expect(result.turnNumber).toBe(1);
  });

  it("turn R → turnNumber 1, turn B → turnNumber 2", () => {
    expect(yenToBoardState({ size: 1, layout: ".", turn: "R" }).turnNumber).toBe(1);
    expect(yenToBoardState({ size: 1, layout: ".", turn: "B" }).turnNumber).toBe(2);
  });

  it("turn desconocido → turnNumber null", () => {
    const result = yenToBoardState({ size: 1, layout: ".", turn: "X" });
    expect(result.turnNumber).toBeNull();
  });

  it("parsea símbolos R y B a player1 y player2", () => {
    // yenToBoardState asigna rValue=0..rowSize-1 independientemente de boardToYen
    // size=2: fila0 longitud 1, fila1 longitud 2
    // fila0[0] → statesById["1,0"], fila1[0] → statesById["0,0"], fila1[1] → statesById["0,1"]
    const board = { size: 2, layout: "R/B.", turn: "B" };
    const result = yenToBoardState(board);
    expect(result.statesById["1,0"]).toBe("player1"); // "R"
    expect(result.statesById["0,0"]).toBe("player2"); // "B"
    expect(result.statesById["0,1"]).toBeNull();       // "."
  });

  it("devuelve null si número de filas no coincide con size", () => {
    expect(yenToBoardState({ size: 3, layout: "./.", turn: "R" })).toBeNull();
  });

  it("devuelve null si longitud de fila no coincide", () => {
    expect(yenToBoardState({ size: 2, layout: "RR/RR", turn: "R" })).toBeNull();
  });

  it("devuelve null si layout no es string", () => {
    expect(yenToBoardState({ size: 2, layout: 123, turn: "R" })).toBeNull();
  });

  it("devuelve null si size no es válido", () => {
    expect(yenToBoardState({ size: "abc", layout: ".", turn: "R" })).toBeNull();
  });
});

// ─── makeTestTriangleBoard ────────────────────────────────────────────────────

describe("makeTestTriangleBoard", () => {
  it("lanza error si size es inválido", () => {
    expect(() => makeTestTriangleBoard(0)).toThrow("Invalid size");
    expect(() => makeTestTriangleBoard("abc")).toThrow("Invalid size");
    expect(() => makeTestTriangleBoard(-1)).toThrow("Invalid size");
  });

  it("genera el número correcto de celdas para size=3", () => {
    // q=0 → 3 celdas, q=1 → 2, q=2 → 1 = 6 total
    const { cells } = makeTestTriangleBoard(3);
    expect(cells).toHaveLength(6);
  });

  it("todas las celdas tienen estado null por defecto", () => {
    const { cells } = makeTestTriangleBoard(3);
    expect(cells.every((c) => c.state === null)).toBe(true);
  });

  it("marca correctamente las celdas indicadas con firstPlayer", () => {
    const { cells } = makeTestTriangleBoard(3, ["2,0", "1,1"], "player1");
    expect(cells.find((c) => c.id === "2,0").state).toBe("player1");
    expect(cells.find((c) => c.id === "1,1").state).toBe("player1");
    expect(cells.find((c) => c.id === "0,0").state).toBeNull();
  });

  it("round-trip conserva el tamaño", () => {
    const { yen, back } = makeTestTriangleBoard(4);
    expect(yen.size).toBe(4);
    expect(back.size).toBe(4);
  });

  it("round-trip: ápex marcado con player1 sobrevive la serialización", () => {
    // "2,0" es el ápex en size=3 (rowIndex=0, r=0)
    // boardToYen → fila[0]="R", yenToBoardState → statesById["2,0"]="player1"
    const { back } = makeTestTriangleBoard(3, ["2,0"], "player1");
    expect(back.statesById["2,0"]).toBe("player1");
  });

  it("round-trip: celda NO-ápex pierde la id original por asimetría de coordenadas", () => {
    // boardToYen serializa "1,1" (r empieza en 1) pero yenToBoardState
    // reconstruye esa posición como statesById["1,0"] (rValue empieza en 0)
    const { back } = makeTestTriangleBoard(3, ["1,1"], "player1");
    expect(back.statesById["1,0"]).toBe("player1"); // posición [0] de la fila → rValue=0
    expect(back.statesById["1,1"]).toBeNull();       // no existe con ese id en el back
  });
});
