const { getConnection } = require('./db');

async function resolveConnection(connection) {
  return connection || getConnection();
}

async function insertUser(username, password,connection) {
  const activeConnection = await resolveConnection(connection);
  const [result] = await activeConnection.execute(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, password]
  );
  return result.insertId;
}

async function getUsersFromDB(connection) {
  const activeConnection = await resolveConnection(connection);
  const [rows] = await activeConnection.execute(
    'SELECT id, username, password, created_at FROM users'
  );
  return rows;
}


async function findUserByUsernameExact(username, connection) {
  const activeConnection = await resolveConnection(connection);
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const [rows] = await activeConnection.execute(
    `SELECT id, username, created_at, COALESCE(best_score, 0) AS best_score,
            COALESCE(total_games_1vsbot, 0) AS total_games_1vsbot, password
     FROM users
     WHERE LOWER(TRIM(username)) = ?
     LIMIT 1`,
    [normalizedUsername]
  );
  return rows[0] || null;
}

module.exports = { insertUser, findUserByUsernameExact, getUsersFromDB };