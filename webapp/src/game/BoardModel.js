// src/game/BoardModel.js

export default class BoardModel {
  constructor(size = 8) {
    this.size = size;
    this.cells = this.generateTriangle(size);
  }

  generateTriangle(size) {
    const cells = [];

    for (let q = 0; q < size; q++) {
      for (let r = 0; r < size - q; r++) {
        cells.push({
          q,
          r,
          id: `${q},${r}`,
          state: null, // futuro: player1, player2, etc
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
}