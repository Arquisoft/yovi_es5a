const { getConnection } = require('../db');
const gameDb = require('../gameDb');

class GameRepository {
  constructor(db = gameDb, conn = getConnection) {
    this.db = db;
    this.conn = conn;
  }

  async insertGame(boardSize) {
    return await this.db.insertGame(boardSize);
  }

  async insertUserGame(gameId, player1Id, player2Id) {
    return await this.db.insertUserGame(gameId, player1Id, player2Id);
  }

  async insertUserBotGame(gameId, userId, botId, difficulty) {
    return await this.db.insertUserBotGame(gameId, userId, botId, difficulty);
  }

  async insertBotGame(gameId, bot1Id, bot2Id, difficulty) {
    return await this.db.insertBotGame(gameId, bot1Id, bot2Id, difficulty);
  }

  async updateGameWinner(gameId, winner) {
    return await this.db.updateGameWinner(gameId, winner);
  }

  // Método para obtener conexión si se necesita transacción externa
  async getConnection() {
    return await this.conn();
  }
}

module.exports = GameRepository;