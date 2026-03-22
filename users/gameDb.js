const { getConnection } = require('./db');

async function resolveConnection(connection) {
  return connection || getConnection();
}

// Funciones para games
async function insertGame(boardSize, mode = null, connection) {
  const activeConnection = await resolveConnection(connection);
  const [result] = await activeConnection.execute(
    'INSERT INTO game (board_size, mode) VALUES (?, ?)',
    [boardSize, mode]
  );
  return result.insertId;  // Retorna el ID de la partida
}

async function insertUserGame(gameId, player1Id, player2Id, connection) {
  const activeConnection = await resolveConnection(connection);
  await activeConnection.execute(
    'INSERT INTO userGames (id, player1_id, player2_id) VALUES (?, ?, ?)',
    [gameId, player1Id, player2Id]
  );
}

async function insertUserBotGame(gameId, userId, botId, difficulty, connection) {
  const activeConnection = await resolveConnection(connection);
  await activeConnection.execute(
    'INSERT INTO ubotGames (id, user_id, bot_id, difficulty) VALUES (?, ?, ?, ?)',
    [gameId, userId, botId, difficulty]
  );
}

async function insertBotGame(gameId, bot1Id, bot2Id, difficulty, connection) {
  const activeConnection = await resolveConnection(connection);
  await activeConnection.execute(
    'INSERT INTO botGames (id, bot1_id, bot2_id, difficulty) VALUES (?, ?, ?, ?)',
    [gameId, bot1Id, bot2Id, difficulty]
  );
}

async function updateGameWinner(gameId, winner, connection) {
  const activeConnection = await resolveConnection(connection);
  await activeConnection.execute(
    'UPDATE game SET winner = ? WHERE id = ?',
    [winner, gameId]
  );
}

async function findUserIdByUsername(username, connection) {
  const activeConnection = await resolveConnection(connection);
  const [rows] = await activeConnection.execute(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  return rows[0]?.id || null;
}

async function findBotIdByDifficulty(difficulty, connection) {
  const activeConnection = await resolveConnection(connection);
  const [rows] = await activeConnection.execute(
    'SELECT id FROM bots WHERE difficulty = ? ORDER BY id ASC LIMIT 1',
    [difficulty]
  );
  return rows[0]?.id || null;
}

async function insertFinishedGame(summary, connection) {
  const activeConnection = await resolveConnection(connection);
  const [result] = await activeConnection.execute(
    `INSERT INTO game (board_size, mode, winner, total_turns, elapsed_seconds, score, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      summary.boardSize,
      summary.mode,
      summary.winner,
      summary.totalTurns,
      summary.elapsedSeconds,
      summary.score
    ]
  );
  return result.insertId;
}

module.exports = {
  insertGame,
  insertUserGame,
  insertUserBotGame,
  insertBotGame,
  updateGameWinner,
  findUserIdByUsername,
  findBotIdByDifficulty,
  insertFinishedGame
};