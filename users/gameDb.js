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

async function insertGameTx(connection, boardSize) {
  const [result] = await connection.execute(
    'INSERT INTO game (board_size) VALUES (?)',
    [boardSize]
  );
  return result.insertId;
}

async function insertUserGame(gameId, player1Id, player2Id) {
  const connection = await getConnection();
  await connection.execute(
    'INSERT INTO userGames (id, player1_id, player2_id) VALUES (?, ?, ?)',
    [gameId, player1Id, player2Id]
  );
}

async function insertUserGameTx(connection, gameId, player1Id, player2Id) {
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

async function insertUserBotGameTx(connection, gameId, userId, botId, difficulty) {
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

async function insertBotGameTx(connection, gameId, bot1Id, bot2Id, difficulty) {
  await connection.execute(
    'INSERT INTO botGames (id, bot1_id, bot2_id, difficulty) VALUES (?, ?, ?, ?)',
    [gameId, bot1Id, bot2Id, difficulty]
  );
}

async function updateGameWinner(gameId, winner, score) {
  const connection = await getConnection();
  await connection.execute(
    'UPDATE game SET winner = ?, score = ? WHERE id = ?',
    [winner, score, gameId]
  );
}

async function updateGameWinnerTx(connection, gameId, winner, score) {
  await connection.execute(
    'UPDATE game SET winner = ?, score = ? WHERE id = ?',
    [winner, score, gameId]
  );
}

module.exports = {
  insertGame,
  insertGameTx,
  insertUserGame,
  insertUserGameTx,
  insertUserBotGame,
  insertUserBotGameTx,
  insertBotGame,
  insertBotGameTx,
  updateGameWinner,
  updateGameWinnerTx
};