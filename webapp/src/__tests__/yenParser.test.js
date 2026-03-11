import { describe, it, expect } from "vitest";
import { parseCellId, boardToYen, yenToBoardState,makeTestTriangleBoard } from "../parsers/yenParser";

describe("parseCellId", () => {
  it("devuelve q y r numéricos cuando el id es válido", () => {
    expect(parseCellId("3,5")).toEqual({ q: 3, r: 5 });
  });

  it("devuelve null si no es string", () => {
    expect(parseCellId(null)).toBeNull();
    expect(parseCellId(123)).toBeNull();
  });

  it("devuelve null si no puede parsear los números", () => {
    expect(parseCellId("a,1")).toBeNull();
    expect(parseCellId("1,b")).toBeNull();
    expect(parseCellId("1")).toBeNull();
  });
});

describe("boardToYen", () => {
  it("convierte un tablero vacío al formato yen", () => {
    const result = boardToYen({ size: 3, turnNumber: 1, cells: [] });

    expect(result).toEqual({
      size: 3,
      turn: "R", // turno impar => "R"
      players: ["B", "R"],
      // size=3 => filas 1,2,3: ".", "../" => "./../..."
      layout: "./../...",
    });
  });

  it("mapea estados de celdas a símbolos R/B y puntos", () => {
    const cells = [
      // fila1: rowSize=1, q=2, r=0
      { id: "2,0", state: "player1" }, // "R"
      // fila2: rowSize=2, q=1, r=0..1
      { id: "1,0", state: "player2" }, // "B."
      { id: "1,1", state: null },
      // fila3: rowSize=3, q=0, r=0..2
      { id: "0,0", state: "player2" }, // "B.."
      { id: "0,1", state: null },
      { id: "0,2", state: null },
    ];

    const result = boardToYen({ size: 3, turnNumber: 2, cells });

    expect(result.size).toBe(3);
    expect(result.turn).toBe("B"); // turno par => "B"
    expect(result.layout).toBe("R/B./B..");
  });

  it("tolera celdas no-array y size no numérico", () => {
    const result = boardToYen({ size: "4", turnNumber: 1, cells: null });
    expect(result.size).toBe(4);
    expect(result.layout).toBe("./../.../....");
  });
});

describe("yenToBoardState", () => {
  it("devuelve null si el tamaño no es válido o no coincide con las filas", () => {
    expect(yenToBoardState({ size: "x", layout: "./." })).toBeNull();
    expect(yenToBoardState({ size: 2, layout: "././.." })).toBeNull(); // 3 filas pero size=2
  });

  it("convierte un layout válido a statesById y turnNumber", () => {
    const board = {
      size: 3,
      turn: "R",
      // filas: "R" (q=2), "B." (q=1), "B.." (q=0)
      layout: "R/B./B..",
    };

    const result = yenToBoardState(board);

    expect(result).not.toBeNull();
    expect(result.size).toBe(3);
    expect(result.turnNumber).toBe(1); // R => 1

    // fila 1: q=2
    expect(result.statesById["2,0"]).toBe("player1");

    // fila 2: q=1
    expect(result.statesById["1,0"]).toBe("player2");
    expect(result.statesById["1,1"]).toBeNull();

    // fila 3: q=0
    expect(result.statesById["0,0"]).toBe("player2");
    expect(result.statesById["0,1"]).toBeNull();
    expect(result.statesById["0,2"]).toBeNull();
  });

  it("devuelve null si alguna fila no tiene la longitud esperada", () => {
    const board = {
      size: 3,
      // fila1 len 1 ok, fila2 len 2 ok, fila3 debería len 3 pero tiene 2
      layout: "R/../B.",
      turn: "B",
    };

    expect(yenToBoardState(board)).toBeNull();
  });

  it("maneja turn desconocido devolviendo turnNumber null", () => {
    const board = { size: 1, layout: ".", turn: "X" };
    const result = yenToBoardState(board);

    expect(result.size).toBe(1);
    expect(result.turnNumber).toBeNull();
    expect(result.statesById["0,0"]).toBeNull();
  });
  it("serializa y deserializa un triángulo simple", () => {
    const { yen, back } = makeTestTriangleBoard(4, ["3,0", "2,1", "1,2", "0,3"]);

    expect(yen.layout).toBe("R/.R/..R/...R");
    expect(yen.turn).toBe("R");
    expect(back.size).toBe(4);
    expect(back.statesById["3,0"]).toBe("player1");
    expect(back.statesById["2,1"]).toBe("player1");
    expect(back.statesById["1,2"]).toBe("player1");
    expect(back.statesById["0,3"]).toBe("player1");
  });
});
