const userDb = require('../userDb');

class UserRepository {
  async insertUser(username) {
    return await userDb.insertUser(username);
  }

}

module.exports = UserRepository;