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

async function insertUserGame(gameId, player1Id, player2Id, guestNameOrConnection, connection) {
  const guestName =
    guestNameOrConnection && typeof guestNameOrConnection === 'object' && typeof guestNameOrConnection.execute === 'function'
      ? null
      : guestNameOrConnection;
  const inferredConnection =
    guestNameOrConnection && typeof guestNameOrConnection === 'object' && typeof guestNameOrConnection.execute === 'function'
      ? guestNameOrConnection
      : connection;

  const activeConnection = await resolveConnection(inferredConnection);
  await activeConnection.execute(
    'INSERT INTO userGames (id, player1_id, player2_id, guest_name) VALUES (?, ?, ?, ?)',
    [gameId, player1Id, player2Id ?? null, guestName ?? null]
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


async function updateUserBotStats(userId, score, connection) {
  const activeConnection = await resolveConnection(connection);
  await activeConnection.execute(
    `UPDATE users
     SET
       total_games_1vsbot = COALESCE(total_games_1vsbot, 0) + 1,
       best_score = GREATEST(COALESCE(best_score, 0), ?),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [score, userId]
  );
}



async function getLeaderboardPage(page, pageSize, connection) {
  const activeConnection = await resolveConnection(connection);
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 25));
  const offset = Math.max(0, (Math.floor(Number(page) || 1) - 1) * safePageSize);

  const [countRows] = await activeConnection.execute(
    'SELECT COUNT(*) AS total FROM users'
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await activeConnection.query(
    `SELECT
       u.id,
       u.username,
       COALESCE(u.best_score, 0) AS best_score,
       COALESCE(u.total_games_1vsbot, 0) AS total_games,
       ranked.global_position
     FROM users u
     JOIN (
       SELECT
         id,
         ROW_NUMBER() OVER (
           ORDER BY COALESCE(best_score, 0) DESC, COALESCE(total_games_1vsbot, 0) DESC, id ASC
         ) AS global_position
       FROM users
     ) ranked ON ranked.id = u.id
     ORDER BY ranked.global_position ASC
     LIMIT ${safePageSize} OFFSET ${offset}`
  );

  return { rows, total };
}

async function getUserRankById(userId, connection) {
  const activeConnection = await resolveConnection(connection);
  const [rows] = await activeConnection.execute(
    `SELECT ranked.global_position
     FROM (
       SELECT
         id,
         ROW_NUMBER() OVER (
           ORDER BY COALESCE(best_score, 0) DESC, COALESCE(total_games_1vsbot, 0) DESC, id ASC
         ) AS global_position
       FROM users
     ) ranked
     WHERE ranked.id = ?
     LIMIT 1`,
    [userId]
  );
  return Number(rows[0]?.global_position || 0);
}

async function getLeaderboardPageCenteredByUserId(userId, pageSize, requestedPage, connection) {
  const activeConnection = await resolveConnection(connection);
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 25));

  const [countRows] = await activeConnection.execute('SELECT COUNT(*) AS total FROM users');
  const total = Number(countRows[0]?.total || 0);
  const rank = await getUserRankById(userId, activeConnection);

  if (!rank) {
    return {
      rows: [],
      total,
      userRank: 0,
      currentPage: 1,
      totalPages: 1,
    };
  }

  const calculatedPage = Math.max(1, Math.ceil(rank / safePageSize));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = requestedPage ? Math.min(Math.max(1, requestedPage), totalPages) : calculatedPage;
  const offset = Math.max(0, (currentPage - 1) * safePageSize);

  const [rows] = await activeConnection.query(
    `SELECT
       u.id,
       u.username,
       COALESCE(u.best_score, 0) AS best_score,
       COALESCE(u.total_games_1vsbot, 0) AS total_games,
       ranked.global_position
     FROM users u
     JOIN (
       SELECT
         id,
         ROW_NUMBER() OVER (
           ORDER BY COALESCE(best_score, 0) DESC, COALESCE(total_games_1vsbot, 0) DESC, id ASC
         ) AS global_position
       FROM users
     ) ranked ON ranked.id = u.id
     ORDER BY ranked.global_position ASC
     LIMIT ${safePageSize} OFFSET ${offset}`
  );

  return {
    rows,
    total,
    userRank: rank,
    currentPage,
    totalPages,
  };
}

async function getUserSuggestionsByUsername(query, limit = 10, connection) {
  const activeConnection = await resolveConnection(connection);
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(10, Math.floor(Number(limit) || 10)));
  const [rows] = await activeConnection.execute(
    `SELECT username
     FROM users
     WHERE LOWER(username) LIKE ?
     ORDER BY username ASC
     LIMIT ${safeLimit}`,
    [`%${normalizedQuery}%`]
  );
  return rows;
}

async function getUserMatchHistory(userId, page, pageSize, connection) {
  const activeConnection = await resolveConnection(connection);
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 25));
  const offset = Math.max(0, (Math.floor(Number(page) || 1) - 1) * safePageSize);

  const [countRows] = await activeConnection.execute(
    `SELECT COUNT(*) AS total
     FROM game g
     INNER JOIN ubotGames ub ON ub.id = g.id
     WHERE ub.user_id = ? AND g.mode = '1vsbot'`,
    [userId]
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await activeConnection.execute(
    `SELECT
       g.id,
       g.score,
       g.board_size,
       g.total_turns,
       g.elapsed_seconds,
       g.winner,
       g.finished_at,
       ub.difficulty,
       b.name AS bot_name
     FROM game g
     INNER JOIN ubotGames ub ON ub.id = g.id
     INNER JOIN bots b ON b.id = ub.bot_id
     WHERE ub.user_id = ?
       AND g.mode = '1vsbot'
     ORDER BY g.finished_at DESC, g.id DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    [userId]
  );

  return { rows, total };
}

async function getUserVsUserMatchHistory(userId, page, pageSize, connection) {
  const activeConnection = await resolveConnection(connection);
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 25));
  const offset = Math.max(0, (Math.floor(Number(page) || 1) - 1) * safePageSize);

  const [countRows] = await activeConnection.execute(
    `SELECT COUNT(*) AS total
     FROM game g
     INNER JOIN userGames ug ON ug.id = g.id
     WHERE g.mode = '1vs1'
       AND ug.player1_id = ?`,
    [userId]
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await activeConnection.execute(
    `SELECT
       g.id,
       g.score,
       g.board_size,
       g.total_turns,
       g.elapsed_seconds,
       g.winner,
       g.finished_at,
       p1.username AS player1_name,
       COALESCE(ug.guest_name, p2.username, 'Invitado') AS player2_name,
       CASE
         WHEN g.winner = 'player1' THEN p1.username
         WHEN g.winner = 'player2' THEN COALESCE(ug.guest_name, p2.username, 'Invitado')
         WHEN g.winner = 'draw' THEN 'Empate'
         ELSE 'Desconocido'
       END AS winner_name
     FROM game g
     INNER JOIN userGames ug ON ug.id = g.id
     INNER JOIN users p1 ON p1.id = ug.player1_id
     LEFT JOIN users p2 ON p2.id = ug.player2_id
     WHERE g.mode = '1vs1'
       AND ug.player1_id = ?
     ORDER BY g.finished_at DESC, g.id DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    [userId]
  );

  return { rows, total };
}

module.exports = {
  insertGame,
  insertUserGame,
  insertUserBotGame,
  insertBotGame,
  updateGameWinner,
  findBotIdByDifficulty,
  findUserIdByUsername,
  insertFinishedGame,
  updateUserBotStats,
  getLeaderboardPage,
  getUserRankById,
  getLeaderboardPageCenteredByUserId,
  getUserSuggestionsByUsername,
  getUserMatchHistory,
  getUserVsUserMatchHistory,
};