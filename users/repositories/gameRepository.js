const { getConnection } = require('../db');
const gameDb = require('../gameDb');

class GameRepository {
  constructor(db = gameDb, conn = getConnection) {
    this.db = db;
    this.conn = conn;
  }

  async insertGame(connection, boardSize) {
    return await this.db.insertGameTx(connection, boardSize);
  }

  

  async insertUserGame(connection, gameId, player1Id, player2Id) {
    return await this.db.insertUserGameTx(connection, gameId, player1Id, player2Id);
  }

  async insertUserBotGame(connection, gameId, userId, botId, difficulty) {
    return await this.db.insertUserBotGameTx(connection, gameId, userId, botId, difficulty);
  }

  async insertBotGame(connection, gameId, bot1Id, bot2Id, difficulty) {
    return await this.db.insertBotGameTx(connection, gameId, bot1Id, bot2Id, difficulty);
  }

  async updateGameWinner(connection, gameId, winner, score) {
    return await this.db.updateGameWinnerTx(connection, gameId, winner, score);
  }

  // Método para obtener conexión si se necesita transacción externa
  async getConnection() {
    return await this.conn();
  }
}

module.exports = GameRepository;