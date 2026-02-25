const GameRepository = require('../repositories/gameRepository');

const gameRepo = new GameRepository();

async function createUserVsUserGame(player1Id, player2Id, boardSize) {
  if (!player1Id || !player2Id || !boardSize) {
    throw new Error('player1Id, player2Id, and boardSize are required');
  }
  if (player1Id === player2Id) {
    throw new Error('Players must be different');
  }
  const connection = await gameRepo.getConnection();
  try {
    await connection.beginTransaction();
    const gameId = await gameRepo.insertGame(boardSize);
    await gameRepo.insertUserGame(gameId, player1Id, player2Id);
    await connection.commit();
    return `Game created with ID: ${gameId}`;
  } catch (err) {
    await connection.rollback();
    throw new Error('Database error: ' + err.message);
  }
}

async function createUserVsBotGame(userId, botId, boardSize, difficulty) {
  if (!userId || !botId || !boardSize || !difficulty) {
    throw new Error('userId, botId, boardSize, and difficulty are required');
  }
  const connection = await gameRepo.getConnection();
  try {
    await connection.beginTransaction();
    const gameId = await gameRepo.insertGame(boardSize);
    await gameRepo.insertUserBotGame(gameId, userId, botId, difficulty);
    await connection.commit();
    return `Game created with ID: ${gameId}`;
  } catch (err) {
    await connection.rollback();
    throw new Error('Database error: ' + err.message);
  }
}

async function createBotVsBotGame(bot1Id, bot2Id, boardSize, difficulty) {
  if (!bot1Id || !bot2Id || !boardSize || !difficulty) {
    throw new Error('bot1Id, bot2Id, boardSize, and difficulty are required');
  }
  if (bot1Id === bot2Id) {
    throw new Error('Bots must be different');
  }
  const connection = await gameRepo.getConnection();
  try {
    await connection.beginTransaction();
    const gameId = await gameRepo.insertGame(boardSize);
    await gameRepo.insertBotGame(gameId, bot1Id, bot2Id, difficulty);
    await connection.commit();
    return `Game created with ID: ${gameId}`;
  } catch (err) {
    await connection.rollback();
    throw new Error('Database error: ' + err.message);
  }
}

async function finishGame(gameId, winner) {
  if (!gameId || !winner) {
    throw new Error('gameId and winner are required');
  }
  if (!['player1', 'player2', 'draw'].includes(winner)) {
    throw new Error('Winner must be player1, player2, or draw');
  }
  try {
    await gameRepo.updateGameWinner(gameId, winner);
    return `Game ${gameId} finished with winner: ${winner}`;
  } catch (err) {
    throw new Error('Database error: ' + err.message);
  }
}

module.exports = {
  createUserVsUserGame,
  createUserVsBotGame,
  createBotVsBotGame,
  finishGame
};