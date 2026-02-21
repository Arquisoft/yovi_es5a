// src/game/BoardModel.js

export default class BoardModel {
  constructor(size = 8) {
    this.size = size;
    this.cells = this.generateTriangle(size);
    this.turnNumber = 1; // numeric turn counter; 1 => player1, 2 => player2, etc.
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

  getTurnNumber() {
    return this.turnNumber;
  }

  getCurrentPlayer() {
    return this.turnNumber % 2 === 1 ? 'player1' : 'player2';
  }

  // compatibility alias for older callsites
  getCurrentTurn() {
    return this.getCurrentPlayer();
  }

  nextTurn() {
    this.turnNumber += 1;
  }

  setCellOwner(cellId, player) {
    const cell = this.cells.find((c) => c.id === cellId);
    if (cell) {
      cell.state = player;
    }
  }
}