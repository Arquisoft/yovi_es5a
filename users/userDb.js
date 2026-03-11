const { getConnection } = require('./db');

async function insertUser(username) {
  const connection = await getConnection();
  const [result] = await connection.execute(
    'INSERT INTO users (username) VALUES (?)',
    [username]
  );
  return result.insertId;
}

module.exports = { insertUser };