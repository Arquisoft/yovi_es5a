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

export default memo(function KonvaRenderer({ cells, onCellClick, selectedId, suggestionId, playerColors }) {
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
    // Contenedor relativo para superponer el overlay
    <div style={{ position: 'relative', width: STAGE_WIDTH, height: STAGE_HEIGHT }}>

      {/* Canvas Konva original — sin cambios */}
      <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
        <Layer>
          <Group x={groupX} y={groupY}>
            {cells.map((cell) => {
              const { x, y } = axialToPixel(cell.q, cell.r, HEX_SIZE, size);
              let fill = playerColors?.empty ?? "#ccc";
              if (cell.state === "player1") fill = playerColors?.player1 ?? "#e63946";
              if (cell.state === "player2") fill = playerColors?.player2 ?? "#1d4ed8";
              if (cell.id === suggestionId && cell.state == null) fill = playerColors?.suggestion ?? "#f5c518";
              if (cell.id === selectedId) fill = playerColors?.selected ?? "#2ecc71";
              const isSuggestion = cell.id === suggestionId && cell.state == null;
              return (
                <Line
                  key={cell.id}
                  points={hex}
                  x={x}
                  y={y}
                  closed
                  stroke="black"
                  strokeWidth={isSuggestion ? 4 : 2}
                  fill={fill}
                  onClick={() => onCellClick && onCellClick(cell.id)}
                  onTap={() => onCellClick && onCellClick(cell.id)}
                />
              );
            })}
          </Group>
        </Layer>
      </Stage>

      {/* Overlay HTML transparente con divs clicables por celda */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT, pointerEvents: 'none' }}>
        {cells.map((cell) => {
          const { x, y } = axialToPixel(cell.q, cell.r, HEX_SIZE, size);
          const screenX = groupX + x;
          const screenY = groupY + y;
          return (
            <div
              key={cell.id}
              id={`cell-${cell.q}-${cell.r}`}
              data-testid={`cell-${cell.q}-${cell.r}`}
              data-state={cell.state ?? 'empty'}
              style={{
                position: 'absolute',
                left: screenX - HEX_SIZE,
                top: screenY - HEX_SIZE,
                width: HEX_SIZE * 2,
                height: HEX_SIZE * 2,
                pointerEvents: 'all', // solo este div captura clicks
                cursor: 'pointer',
                // En producción puedes quitar el background:
                // background: 'rgba(255,0,0,0.1)',
              }}
              onClick={() => onCellClick && onCellClick(cell.id)}
            />
          );
        })}
      </div>

    </div>
  );
});