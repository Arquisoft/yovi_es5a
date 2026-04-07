const { getConnection } = require('../db');
const gameDb = require('../gameDb');
const userDb = require('../userDb');

class GameRepository {
  constructor(db = gameDb, conn = getConnection, userdb = userDb) {
    this.db = db;
    this.conn = conn;
    this.userdb = userdb;
  }

  async insertGame(boardSize, mode, connection) {
    return await this.db.insertGame(boardSize, mode, connection);
  }

  async insertUserGame(gameId, player1Id, player2Id, guestName, connection) {
    return await this.db.insertUserGame(gameId, player1Id, player2Id, guestName, connection);
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
    return await this.userdb.findUserByUsernameExact(username, connection);
  }

  async findBotIdByDifficulty(difficulty, connection) {
    return await this.db.findBotIdByDifficulty(difficulty, connection);
  }

  async insertFinishedGame(summary, connection) {
    return await this.db.insertFinishedGame(summary, connection);
  }

  async updateUserBotStats(userId, score, connection) {
    return await this.db.updateUserBotStats(userId, score, connection);
  }

  async getLeaderboardPage(page, pageSize, connection) {
    return await this.db.getLeaderboardPage(page, pageSize, connection);
  }

  async getUserRankById(userId, connection) {
    return await this.db.getUserRankById(userId, connection);
  }

  async getLeaderboardPageCenteredByUserId(userId, pageSize, requestedPage, connection) {
    return await this.db.getLeaderboardPageCenteredByUserId(userId, pageSize, requestedPage, connection);
  }

  async getUserSuggestionsByUsername(query, limit, connection) {
    return await this.db.getUserSuggestionsByUsername(query, limit, connection);
  }

  async getUserMatchHistory(userId, page, pageSize, connection) {
    return await this.db.getUserMatchHistory(userId, page, pageSize, connection);
  }

  async getUserVsUserMatchHistory(userId, page, pageSize, connection) {
    return await this.db.getUserVsUserMatchHistory(userId, page, pageSize, connection);
  }

  // Método para obtener conexión si se necesita transacción externa
  async getConnection() {
    return await this.conn();
  }
}

module.exports = GameRepository;