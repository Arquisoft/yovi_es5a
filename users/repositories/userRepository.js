const { getConnection } = require('../db');
const userDb = require('../userDb');

class UserRepository {
  constructor(db = userDb, conn = getConnection) {
    this.db = db;
    this.conn = conn;
  }
  async insertUser(username) {
    return await this.db.insertUser(username);
  }


  async getConnection() {
    return await this.conn();
  }
}

module.exports = UserRepository;