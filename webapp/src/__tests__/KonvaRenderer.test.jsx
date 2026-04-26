import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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
      data-fill={props.fill}
      data-stroke={props.stroke}
      data-stroke-width={String(props.strokeWidth)}
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
    suggestion: "#ffff00",
  };

  function renderRenderer(extraProps = {}) {
    return render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={null}
        suggestionId={undefined}
        lastBotMoveId={undefined}
        playerColors={playerColors}
        {...extraProps}
      />
    );
  }

  it("renderiza Stage, Layer y Group centrado", () => {
    renderRenderer();

    expect(screen.getByTestId("stage")).toBeInTheDocument();
    expect(screen.getByTestId("layer")).toBeInTheDocument();
    expect(screen.getByTestId("group")).toBeInTheDocument();
  });

  it("renderiza una Line por cada celda", () => {
    renderRenderer();

    const hexes = screen.getAllByTestId("hex-cell");
    expect(hexes).toHaveLength(baseCells.length);
  });

  it("aplica el color correcto según el estado de la celda y la selección", () => {
    renderRenderer({ selectedId: "1,0" });

    const hexes = screen.getAllByTestId("hex-cell");
    const fills = hexes.map((el) => el.getAttribute("data-fill"));

    expect(fills).toEqual(["#eee", "#00ff00", "#0000ff"]);
  });

  it("usa colores por defecto cuando no se pasan playerColors", () => {
    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={() => {}}
        selectedId={null}
        suggestionId={undefined}
        lastBotMoveId={undefined}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");
    const fills = hexes.map((el) => el.getAttribute("data-fill"));

    expect(fills).toEqual(["#ccc", "#e63946", "#1d4ed8"]);
  });

  it("usa color de sugerencia cuando suggestionId apunta a celda vacía", () => {
    renderRenderer({ suggestionId: "2,0" });

    const hexes = screen.getAllByTestId("hex-cell");
    const fills = hexes.map((el) => el.getAttribute("data-fill"));

    expect(fills).toEqual(["#ffff00", "#ff0000", "#0000ff"]);
  });

  it("no aplica color de sugerencia si suggestionId apunta a celda ocupada", () => {
    renderRenderer({ suggestionId: "1,0" });

    const hexes = screen.getAllByTestId("hex-cell");
    const fills = hexes.map((el) => el.getAttribute("data-fill"));

    expect(fills).toEqual(["#eee", "#ff0000", "#0000ff"]);
  });

  it("usa stroke especial y grosor 5 para la última jugada del bot", () => {
    renderRenderer({ lastBotMoveId: "1,1" });

    const hexes = screen.getAllByTestId("hex-cell");

    const highlighted = hexes.filter(
      (el) =>
        el.getAttribute("data-stroke") === "#000000" &&
        el.getAttribute("data-stroke-width") === "5"
    );

    const normal = hexes.filter(
      (el) =>
        el.getAttribute("data-stroke") === "#1f1f1f" &&
        el.getAttribute("data-stroke-width") === "2"
    );

    expect(highlighted).toHaveLength(1);
    expect(normal).toHaveLength(2);
  });

  it("si selectedId coincide con lastBotMoveId, mantiene fill de selected y stroke de lastBotMove", () => {
    renderRenderer({ lastBotMoveId: "1,0", selectedId: "1,0" });

    const hexes = screen.getAllByTestId("hex-cell");

    const selectedLastBotMoveCell = hexes.find(
      (el) =>
        el.getAttribute("data-fill") === "#00ff00" &&
        el.getAttribute("data-stroke") === "#000000" &&
        el.getAttribute("data-stroke-width") === "5"
    );

    expect(selectedLastBotMoveCell).toBeDefined();

    const fills = hexes.map((el) => el.getAttribute("data-fill"));
    expect(fills).toContain("#eee");
    expect(fills).toContain("#00ff00");
    expect(fills).toContain("#0000ff");
  });

  it("llama a onCellClick con el id correcto al hacer click", async () => {
    const user = userEvent.setup();
    const clickedIds = [];

    render(
      <KonvaRenderer
        cells={baseCells}
        onCellClick={(id) => clickedIds.push(id)}
        selectedId={null}
        suggestionId={undefined}
        lastBotMoveId={undefined}
        playerColors={playerColors}
      />
    );

    const hexes = screen.getAllByTestId("hex-cell");
    await user.click(hexes[1]);

    expect(clickedIds).toEqual(["1,0"]);
  });
});