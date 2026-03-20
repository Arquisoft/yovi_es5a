/* import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KonvaRenderer from "../renderers/KonvaRenderer";

// Mock de react-konva a componentes simples HTML
vi.mock("react-konva", () => ({
  Stage: ({ children }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }) => <div data-testid="layer">{children}</div>,
  Group: ({ children, x, y }) => (
    <div data-testid="group" data-x={x} data-y={y}>
      {children}
    </div>
  ),
  Line: (props) => (
    <div
      data-testid="hex-cell"
      data-id={props["data-id"] ?? props.id}
      data-x={props.x}
      data-y={props.y}
      data-stroke-width={props.strokeWidth}
      data-fill={props.fill}
      // Un solo handler para evitar dobles llamadas
      onClick={props.onClick}
    />
  ),
}));

describe("KonvaRenderer", () => {
  const baseCells = [
    { id: "2,0", q: 2, r: 0, state: null },
    { id: "1,0", q: 1, r: 0, state: "player1" },
    { id: "1,1", q: 1, r: 1, state: "player2" },
  ];

  const playerColors = {
    empty: "#eee",
    player1: "#ff0000",
    player2: "#0000ff",
    selected: "#00ff00",
  };

  it("renderiza un Stage, Layer y un Group centrado", () => {
    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={null}
        playerColors={playerColors}
      />
    );

    expect(screen.getByTestId("stage")).toBeInTheDocument();
    expect(screen.getByTestId("layer")).toBeInTheDocument();
    expect(screen.getByTestId("group")).toBeInTheDocument();
  });

  it("renderiza una Line por cada celda", () => {
    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={null}
        playerColors={playerColors}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");
    expect(hexes).toHaveLength(baseCells.length);
  });

  it("aplica el color correcto según el estado de la celda y la selección", () => {
    const selectedId = "1,0";

    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={selectedId}
        playerColors={playerColors}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");

    // baseCells[0] -> state null => empty
    expect(hexes[0]).toHaveAttribute("data-fill", "#eee");

    // baseCells[1] -> player1 y además seleccionada => selected tiene prioridad
    expect(hexes[1]).toHaveAttribute("data-fill", "#00ff00");

    // baseCells[2] -> player2, no seleccionada
    expect(hexes[2]).toHaveAttribute("data-fill", "#0000ff");
  });

  it("usa colores por defecto cuando no se pasan playerColors", () => {
    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={null}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");

    // empty por defecto
    expect(hexes[0]).toHaveAttribute("data-fill", "#ccc");
    // player1 por defecto
    expect(hexes[1]).toHaveAttribute("data-fill", "#e63946");
    // player2 por defecto
    expect(hexes[2]).toHaveAttribute("data-fill", "#1d4ed8");
  });

  it("aumenta strokeWidth cuando la celda está seleccionada", () => {
    const selectedId = "1,1";

    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={selectedId}
        playerColors={playerColors}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");

    // no seleccionadas => 2
    expect(hexes[0]).toHaveAttribute("data-stroke-width", "2");
    expect(hexes[1]).toHaveAttribute("data-stroke-width", "2");
    // seleccionada => 4
    expect(hexes[2]).toHaveAttribute("data-stroke-width", "4");
  });

  it("llama a onCellClick con el id de la celda al hacer click", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={handleClick}
        selectedId={null}
        playerColors={playerColors}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");
    await user.click(hexes[1]);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith("1,0");
  });
});
 */