const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost', // poner mysql si no funciona
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'yovi_db',
  port: process.env.DB_PORT || 3306,
};


const pool = mysql.createPool(dbConfig);

async function getConnection() {
  return pool.getConnection();
}


module.exports = { getConnection };