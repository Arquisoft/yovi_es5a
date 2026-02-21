// src/components/GameBoard.jsx

import React, { useMemo } from "react";
import BoardModel from "../game/BoardModel";
import KonvaRenderer from "../renderers/KonvaRenderer";

export default function GameBoard() {
  const board = useMemo(() => new BoardModel(8), []);

  return (
    <div>
      <KonvaRenderer board={board} />
    </div>
  );
}