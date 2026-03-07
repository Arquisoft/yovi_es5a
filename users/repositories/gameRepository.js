const { getConnection } = require('../db');
const gameDb = require('../gameDb');

class GameRepository {
  async insertGame(boardSize) {
    return await gameDb.insertGame(boardSize);
  }

  async insertUserGame(gameId, player1Id, player2Id) {
    return await gameDb.insertUserGame(gameId, player1Id, player2Id);
  }

  async insertUserBotGame(gameId, userId, botId, difficulty) {
    return await gameDb.insertUserBotGame(gameId, userId, botId, difficulty);
  }

  async insertBotGame(gameId, bot1Id, bot2Id, difficulty) {
    return await gameDb.insertBotGame(gameId, bot1Id, bot2Id, difficulty);
  }

  async updateGameWinner(gameId, winner) {
    return await gameDb.updateGameWinner(gameId, winner);
  }

  // Método para obtener conexión si se necesita transacción externa
  async getConnection() {
    return await getConnection();
  }
}

module.exports = GameRepository;