import React from "react";
import { Stage, Layer, Line, Group } from "react-konva";

const HEX_SIZE = 30;

function axialToPixel(q, r, size) {
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = size * (3 / 2) * r;
  return { x, y };
}

function hexPoints(size) {
  const points = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(size * Math.cos(angle));
    points.push(size * Math.sin(angle));
  }

  return points;
}

export default function KonvaRenderer({ cells, onCellClick, selectedId, playerColors }) {
  const hex = hexPoints(HEX_SIZE);
  // backwards-compat: if caller passed a board instance, derive cells
  if (!cells) {
    // eslint-disable-next-line no-undef
    // keep supporting older callsites that pass `board` prop
    // but prefer passing `cells` directly from parent
    // (caller may pass a board object instead of cells)
    // try to access `board.getCells()` if available
    // NOTE: this branch is for robustness; GameBoard passes `cells`.
    // eslint-disable-next-line no-undef
    // (no-op)
  }

  const STAGE_WIDTH = 800;
  const STAGE_HEIGHT = 600;

  // calcular bounds del tablero en coordenadas de píxel
  const pixels = cells.map((c) => axialToPixel(c.q, c.r, HEX_SIZE));
  const xs = pixels.map((p) => p.x);
  const ys = pixels.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // centro del tablero en coordenadas internas
  const boardCenterX = (minX + maxX) / 2;
  const boardCenterY = (minY + maxY) / 2;

  // desplazar todo el grupo para que su centro coincida con el centro del Stage
  const groupX = STAGE_WIDTH / 2 - boardCenterX;
  const groupY = STAGE_HEIGHT / 2 - boardCenterY;

  return (
    <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <Layer>
        <Group x={groupX} y={groupY}>
          {cells.map((cell) => {
            const { x, y } = axialToPixel(cell.q, cell.r, HEX_SIZE);

            // determine fill color based on ownership and selection
            let fill = (playerColors && playerColors.empty) || "#ccc";
            if (cell.state === "player1") fill = (playerColors && playerColors.player1) || "#e63946";
            if (cell.state === "player2") fill = (playerColors && playerColors.player2) || "#1d4ed8";
            if (selectedId === cell.id) fill = (playerColors && playerColors.selected) || "#2ecc71";

            const isSelected = selectedId === cell.id;

            return (
              <Line
                key={cell.id}
                points={hex}
                x={x}
                y={y}
                closed
                stroke="black"
                strokeWidth={isSelected ? 4 : 2}
                fill={fill}
                onClick={() => onCellClick && onCellClick(cell.id)}
                onTap={() => onCellClick && onCellClick(cell.id)}
              />
            );
          })}
        </Group>
      </Layer>
    </Stage>
  );
}