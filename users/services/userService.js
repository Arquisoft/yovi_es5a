const UserRepository = require('../repositories/userRepository');

const userRepo = new UserRepository();

async function createUser(username, email, password) {
  if (!username) {
    throw new Error('Username is required');
  }
  try {
    const userId = await userRepo.insertUser(username, email, password);
    return `Hello ${username}! Welcome to the course! User created with ID: ${userId}`;
  } catch (err) {
    throw new Error('Database error: ' + err.message);
  }
}

async function getUserByUsername(username) {
  const users = await userRepo.getUsersFromDB();
  return users.find(user => user.username === username);
}

async function resolveUserByExactUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized) {
    return null;
  }
  return userRepo.findUserByUsernameExact(normalized);
}

async function resolveUserByExactEmail(email) {
  const normalized = String(email || '').trim();
  if(!normalized) {
    return null;
  }
  return userRepo.findUserByEmailExact(normalized);
}

module.exports = { 
  userRepo,
  createUser,
  resolveUserByExactUsername,
  resolveUserByExactEmail,
  getUserByUsername
};