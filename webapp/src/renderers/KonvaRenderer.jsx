// src/renderers/KonvaRenderer.jsx

import React from "react";
import { Stage, Layer, Line } from "react-konva";

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

export default function KonvaRenderer({ board }) {
  const cells = board.getCells();
  const hex = hexPoints(HEX_SIZE);

  // centrar tablero
  const offsetX = 300;
  const offsetY = 100;

  return (
    <Stage width={800} height={600}>
      <Layer>
        {cells.map((cell) => {
          const { x, y } = axialToPixel(cell.q, cell.r, HEX_SIZE);

          return (
            <Line
              key={cell.id}
              points={hex}
              x={x + offsetX}
              y={y + offsetY}
              closed
              stroke="black"
              strokeWidth={2}
              fill="#ccc"
            />
          );
        })}
      </Layer>
    </Stage>
  );
}