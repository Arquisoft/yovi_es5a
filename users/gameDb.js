const { getConnection } = require('./db');

// Funciones para games
async function insertGame(boardSize) {
  const connection = await getConnection();
  const [result] = await connection.execute(
    'INSERT INTO game (board_size) VALUES (?)',
    [boardSize]
  );
  return result.insertId;  // Retorna el ID de la partida
}

async function insertUserGame(gameId, player1Id, player2Id) {
  const connection = await getConnection();
  await connection.execute(
    'INSERT INTO userGames (id, player1_id, player2_id) VALUES (?, ?, ?)',
    [gameId, player1Id, player2Id]
  );
}

async function insertUserBotGame(gameId, userId, botId, difficulty) {
  const connection = await getConnection();
  await connection.execute(
    'INSERT INTO ubotGames (id, user_id, bot_id, difficulty) VALUES (?, ?, ?, ?)',
    [gameId, userId, botId, difficulty]
  );
}

async function insertBotGame(gameId, bot1Id, bot2Id, difficulty) {
  const connection = await getConnection();
  await connection.execute(
    'INSERT INTO botGames (id, bot1_id, bot2_id, difficulty) VALUES (?, ?, ?, ?)',
    [gameId, bot1Id, bot2Id, difficulty]
  );
}

async function updateGameWinner(gameId, winner) {
  const connection = await getConnection();
  await connection.execute(
    'UPDATE game SET winner = ? WHERE id = ?',
    [winner, gameId]
  );
}

module.exports = {
  insertGame,
  insertUserGame,
  insertUserBotGame,
  insertBotGame,
  updateGameWinner
};