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

export default function KonvaRenderer({ board }) {
  const cells = board.getCells();
  const hex = hexPoints(HEX_SIZE);

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

            return (
              <Line
                key={cell.id}
                points={hex}
                x={x}
                y={y}
                closed
                stroke="black"
                strokeWidth={2}
                fill="#ccc"
              />
            );
          })}
        </Group>
      </Layer>
    </Stage>
  );
}