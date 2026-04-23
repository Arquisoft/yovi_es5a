const UserRepository = require('../repositories/userRepository');

const userRepo = new UserRepository();

async function createUser(username, password) {
  if (!username) {
    throw new Error('Username is required');
  }
  try {
    const connection = await userRepo.getConnection();
    const userId = await userRepo.insertUser(username, password, connection);
    return `Hello ${username}! Welcome to the course! User created with ID: ${userId}`;
  } catch (err) {
    throw new Error('Database error: ' + err.message);
  }
}

async function getUserByUsername(username) {
  const conn = await userRepo.getConnection();
  const users = await userRepo.getUsersFromDB(conn);
  return users.find(user => user.username === username);
}

async function resolveUserByExactUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized) {
    return null;
  }
  return userRepo.findUserByUsernameExact(normalized);
}

module.exports = { 
  userRepo,
  createUser,
  resolveUserByExactUsername,
  getUserByUsername
};