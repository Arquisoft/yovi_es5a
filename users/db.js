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
    for (let i = 0; i < 10; i++) {
      try {
        dbConnection = await mysql.createConnection(dbConfig);
        console.log("Connected to MySQL");
        break;
      } catch (err) {
        console.log(`MySQL not ready, retrying (${i+1}/10)...`);
        await new Promise(res => setTimeout(res, 2000));
      }
    }
  }
  return dbConnection;
}


module.exports = { getConnection };