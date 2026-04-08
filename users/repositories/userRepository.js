const { getConnection } = require('../db');
const userDb = require('../userDb');

class UserRepository {
  constructor(db = userDb, conn = getConnection) {
    this.db = db;
    this.conn = conn;
  }
  async insertUser(username, email, password,connection) {
    return await this.db.insertUser(username, email, password, connection);
  }

  async findUserByUsernameExact(username, connection) {
    return await this.db.findUserByUsernameExact(username, connection);
  }

  async findUserByEmailExact(email, connection) {
    return await this.db.findUserByEmailExact(email, connection);
  }


  async getUsersFromDB(connection) {
    return await this.db.getUsersFromDB(connection);
  }

   async getConnection() {
    return await this.conn();
  }
}

module.exports = UserRepository;
