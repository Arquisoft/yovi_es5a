import React, { memo } from "react";
import { Stage, Layer, Line, Group } from "react-konva";

const HEX_SIZE = 30;
const HEX_DRAW_SIZE = HEX_SIZE * 1;

function axialToPixel(q, r, hexSize, size) {
  const rowIndex = (size - 1) - q;
  const j = rowIndex === 0 ? 0 : r - 1;

  const x = (j - rowIndex / 2) * Math.sqrt(3) * hexSize;
  const y = rowIndex * (3 / 2) * hexSize;
  return { x, y };
}

function hexPoints(size) {
  const points = [];
  const angleOffset = -Math.PI / 2;

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + angleOffset;
    points.push(size * Math.cos(angle));
    points.push(size * Math.sin(angle));
  }

  return points;
}

export default memo(function KonvaRenderer({ cells, onCellClick, selectedId, playerColors }) {
  const hex = hexPoints(HEX_DRAW_SIZE);
  const size = Math.max(...cells.map((c) => c.q)) + 1;

  const STAGE_WIDTH = 800;
  const STAGE_HEIGHT = 600;

  const pixels = cells.map((c) => axialToPixel(c.q, c.r, HEX_SIZE, size));
  const xs = pixels.map((p) => p.x);
  const ys = pixels.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const boardCenterX = (minX + maxX) / 2;
  const boardCenterY = (minY + maxY) / 2;
  const groupX = STAGE_WIDTH / 2 - boardCenterX;
  const groupY = STAGE_HEIGHT / 2 - boardCenterY;

  return (
    <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <Layer>
        <Group x={groupX} y={groupY}>
          {cells.map((cell) => {
            const { x, y } = axialToPixel(cell.q, cell.r, HEX_SIZE, size);

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
});
