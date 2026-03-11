const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'mysql', // poner mysql si no funciona
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'yovi_db',
  port: process.env.DB_PORT || 3306,
};

let dbConnection;

async function getConnection() {
  if (!dbConnection) {
    dbConnection = await mysql.createConnection(dbConfig);
  }
  return dbConnection;
}

module.exports = { getConnection };