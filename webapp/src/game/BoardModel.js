// src/game/BoardModel.js

export default class BoardModel {
  constructor(size = 8) {
    this.size = size;
    this.cells = this.generateTriangle(size);
    this.currentTurn = 'player1';
  }

  generateTriangle(size) {
    const cells = [];

    for (let q = 0; q < size; q++) {
      for (let r = 0; r < size - q; r++) {
        cells.push({
          q,
          r,
          id: `${q},${r}`,
          state: null, 
        });
      }
    }

    return cells;
  }

  getCells() {
    return this.cells;
  }

  getSize() {
    return this.size;
  }

  getCurrentTurn() {
    return this.currentTurn;
  }

  nextTurn() {
    this.currentTurn = this.currentTurn === 'player1' ? 'player2' : 'player1';
  }

  setCellOwner(cellId, player) {
    const cell = this.cells.find((c) => c.id === cellId);
    if (cell) {
      cell.state = player;
    }
  }
}