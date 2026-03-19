const { getConnection } = require('../db');
const gameDb = require('../gameDb');

class GameRepository {
  constructor(db = gameDb, conn = getConnection) {
    this.db = db;
    this.conn = conn;
  }

  async insertGame(boardSize, mode, connection) {
    return await this.db.insertGame(boardSize, mode, connection);
  }

  async insertUserGame(gameId, player1Id, player2Id, connection) {
    return await this.db.insertUserGame(gameId, player1Id, player2Id, connection);
  }

  async insertUserBotGame(gameId, userId, botId, difficulty, connection) {
    return await this.db.insertUserBotGame(gameId, userId, botId, difficulty, connection);
  }

  async insertBotGame(gameId, bot1Id, bot2Id, difficulty, connection) {
    return await this.db.insertBotGame(gameId, bot1Id, bot2Id, difficulty, connection);
  }

  async updateGameWinner(gameId, winner, connection) {
    return await this.db.updateGameWinner(gameId, winner, connection);
  }

  async findUserIdByUsername(username, connection) {
    return await this.db.findUserIdByUsername(username, connection);
  }

  async findBotIdByDifficulty(difficulty, connection) {
    return await this.db.findBotIdByDifficulty(difficulty, connection);
  }

  async insertFinishedGame(summary, connection) {
    return await this.db.insertFinishedGame(summary, connection);
  }

  // Método para obtener conexión si se necesita transacción externa
  async getConnection() {
    return await this.conn();
  }
}

module.exports = GameRepository;